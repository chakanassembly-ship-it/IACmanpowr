# Security Specification

## Data Invariants
1. `users`: A user document must have a `role` (admin, hr, supervisor) and an `email`. Authenticated users can only be created via Admin component (using secondary Auth instance) or Login component (for initial setup/social login if enabled).
2. `departments`: Only admins can create, update, or delete departments.
3. `lines`: Only admins can create, update, or delete lines. A line must belong to a valid department.
4. `records`: A record must have a valid `departmentId`, `shift`, `count`, `otCount`, and `recordedBy`. `recordedBy` must match the current user's UID. Only admins can delete records. HR and Supervisors can read records for monitoring.
5. `settings`: Only admins can read/write global settings.

## The Dirty Dozen Payloads (Target: Denied)
1. **Malicious Role Escalation**: User tries to update their own `users/{userId}` role to 'admin'.
2. **Anonymous Record**: Unauthenticated user tries to add a document to `records`.
3. **Identity Spoofing**: User 'A' tries to create a record with `recordedBy` set to User 'B'.
4. **Stale Cleanup**: Non-admin user tries to batch delete records from `records`.
5. **System Settings Hijack**: Supervisor tries to update `settings/email` to their own email receiver.
6. **Negative Manpower**: User tries to submit a record with `count: -5`.
7. **Line Poisoning**: Admin tries to create a line with a 1MB description string.
8. **Department Orphan**: Non-admin trying to create a department.
9. **Role Modification Gap**: User trying to add `isAdmin: true` field to their user profile.
10. **Record Deletion**: Supervisor trying to delete a record they submitted (Only admins should delete).
11. **PII Leak**: Unauthenticated user trying to list all `users`.
12. **Future Timestamp**: User trying to submit a record with a `timestamp` in the future (not using server timestamp).

## Test Runner (firestore.rules)
Implementation follows after providing this spec.
