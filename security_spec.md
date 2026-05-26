# Security Specification - Certificate Management System

## Data Invariants
1. **Organization Settings**: Every user has exactly one organization settings document at `/settings/{userId}`. They can only read and write their own.
2. **Representatives**: Each organization can have a list of legal representatives. These are sub-resources of the organization settings.
3. **Courses**: Courses are owned by the creator (`createdBy`). Only the owner can manage them.
4. **Enrollments**: Enrollments belong to a course. Only the course creator can manage enrollments.
5. **Certificate Verification**: Anyone can 'get' a single enrollment document to verify a certificate (via QR), but they cannot 'list' enrollments.

## The "Dirty Dozen" Payloads (Attacks)
1. **Identity Spoofing (Settings)**: User A tries to write to `settings/UserB`.
2. **Identity Spoofing (Courses)**: User A tries to create a course with `createdBy: UserB`.
3. **Relational Bypass**: User A tries to create an enrollment for a course owned by User B.
4. **Privilege Escalation**: User A tries to update a course they don't own.
5. **Shadow Field Injection**: User A tries to add a `verifiedByAdmin: true` field to their course.
6. **ID Poisoning**: User A tries to use a 2MB string as a course ID.
7. **Resource Exhaustion**: User A tries to store a 500KB string in a course name field.
8. **PII Leak (List)**: User A tries to list all enrollments (contains student names/RUTs).
9. **Timestamp Spoofing**: User A tries to set a `createdAt` in the past.
10. **State Corruption**: User A tries to change the `courseId` of an existing enrollment.
11. **Representative hijacking**: User A tries to delete a representative of User B.
12. **Signature Forgery**: User A tries to update another user's representative signature.

## Test Runner Plan
I will create `firestore.rules.test.ts` to verify these constraints.
