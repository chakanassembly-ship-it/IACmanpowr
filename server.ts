import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { format } from "date-fns";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase for server-side tasks
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function sendScheduledReport() {
  console.log("[Scheduler] Starting morning manpower report sequence...");
  
  try {
    const today = format(new Date(), "yyyy-MM-dd");
    
    // 1. Fetch settings
    const settingsSnap = await getDoc(doc(db, "settings", "email"));
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    
    const serviceId = settings.serviceId || process.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = settings.templateId || process.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = settings.publicKey || process.env.VITE_EMAILJS_PUBLIC_KEY;
    const receiverEmail = settings.receiverEmail || process.env.VITE_REPORT_RECEIVER_EMAIL || "chakanassembly@gmail.com";

    if (!serviceId || !templateId || !publicKey) {
      console.error("[Scheduler] Error: EmailJS not configured in Firestore settings or Env.");
      return;
    }

    // 2. Fetch Data
    const deptsSnap = await getDocs(collection(db, "departments"));
    const deptMap = Object.fromEntries(deptsSnap.docs.map(d => [d.id, d.data().name]));
    
    const linesSnap = await getDocs(collection(db, "lines"));
    const lines = linesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const recordsQuery = query(collection(db, "records"), where("date", "==", today), orderBy("timestamp", "desc"));
    const recordsSnap = await getDocs(recordsQuery);
    const records = recordsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (records.length === 0) {
      console.log(`[Scheduler] No records found for ${today}. Skipping email.`);
      return;
    }

    // 3. Process Summary (simplified logic mirror of Dashboard.tsx)
    let totalPresence = 0;
    let totalOT = 0;
    const summary: Record<string, any> = {};

    records.forEach((r: any) => {
      totalPresence += r.count;
      totalOT += r.otCount;
      const key = `${r.departmentId}-${r.lineId}`;
      if (!summary[key]) {
        const line: any = lines.find((l: any) => l.id === r.lineId);
        summary[key] = {
          lineName: line?.name || "Unknown",
          deptName: deptMap[r.departmentId] || "Unknown",
          A: 0, B: 0, C: 0, G: 0, otA: 0, otB: 0, otC: 0, otG: 0, total: 0
        };
      }
      const shift = r.shift as "A" | "B" | "C" | "G";
      summary[key][shift] += r.count;
      summary[key][`ot${shift}`] += r.otCount;
      summary[key].total += (r.count + r.otCount);
    });

    // 4. Format Report
    let reportBody = `AUTOMATED MORNING REPORT - ${format(new Date(), "dd MMM yyyy")}\n`;
    reportBody += `Total Presence: ${totalPresence}\n`;
    reportBody += `Total Overtime: ${totalOT}\n`;
    reportBody += `-------------------------------------------\n\n`;
    
    Object.values(summary).forEach((item: any) => {
      reportBody += `[${item.deptName}] ${item.lineName}:\n`;
      reportBody += `  Shift A: ${item.A} (OT: ${item.otA})\n`;
      reportBody += `  Shift B: ${item.B} (OT: ${item.otB})\n`;
      reportBody += `  Shift C: ${item.C} (OT: ${item.otC})\n`;
      reportBody += `  Shift G: ${item.G} (OT: ${item.otG})\n`;
      reportBody += `  Line Total: ${item.total}\n`;
      reportBody += `-------------------------------------------\n`;
    });

    // 5. Send via EmailJS REST API
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: receiverEmail,
          report_date: format(new Date(), "dd-MM-yyyy"),
          message: reportBody,
          subject: `Scheduled Manpower Report: ${format(new Date(), "dd MMM yyyy")}`
        }
      })
    });

    if (response.ok) {
      console.log("[Scheduler] Scheduled report sent successfully.");
    } else {
      const err = await response.text();
      if (err.includes("non-browser")) {
        console.error("[Scheduler] EmailJS API Error: Access denied for server environment.");
        console.error("[Scheduler] SOLUTION: Enable 'Allow API access from non-browser environments' in https://dashboard.emailjs.com/admin/account/security");
      } else {
        console.error("[Scheduler] EmailJS API Error:", err);
      }
    }
  } catch (error) {
    console.error("[Scheduler] Critical failure in report sequence:", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Manual Trigger Endpoint for testing
  app.get("/api/trigger-report", async (req, res) => {
    await sendScheduledReport();
    res.json({ message: "Report sequence triggered manually" });
  });

  // Schedule Morning Report at 09:30 AM IST (04:00 UTC)
  // Cron: 0 30 4 * * * (Minutes Hours Day Month DayOfWeek)
  cron.schedule("0 30 4 * * *", () => {
    sendScheduledReport();
  }, {
    timezone: "UTC" // We'll stick to UTC to avoid environment drifting
  });

  console.log("[System] Manpower Reporting Scheduler Initialized: Target 04:00 UTC (09:30 IST)");

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
