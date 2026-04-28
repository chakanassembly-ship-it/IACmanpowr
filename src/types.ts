export interface Department {
  id: string;
  name: string;
  description?: string;
  hasLines?: boolean;
  targets?: {
    A: number;
    B: number;
    C: number;
    G: number;
  };
}

export interface Line {
  id: string;
  name: string;
  departmentId: string;
  description?: string;
  requirements: {
    A: number;
    B: number;
    C: number;
    G: number;
  };
}

export interface ManpowerRecord {
  id: string;
  date: string;
  departmentId: string;
  lineId?: string; // Optional if department has no lines
  shift: 'A' | 'B' | 'C' | 'G';
  count: number;
  otCount: number;
  recordedBy: string;
  timestamp: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'hr' | 'supervisor';
  name?: string;
  password?: string;
  assignedLines?: string[];
  assignedDepts?: string[];
}
