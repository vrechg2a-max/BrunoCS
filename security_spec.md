# Security Specification — ObraControl (Firestore Zero-Trust Rules)

## 1. Data Invariants & Master Source of Truth

1. **Construction Ownership (`constructions/{constructionId}`)**:
   - Every construction document is strictly owned by `ownerId == request.auth.uid` with a verified email (`request.auth.token.email_verified == true`).
   - `ownerId` and `createdAt` are immutable after creation.
   - `createdAt` and `updatedAt` must strictly match `request.time`.
   - Once a construction reaches terminal state `status == 'concluida'`, subsequent modifications are blocked (`existing().status != 'concluida'`).

2. **Construction Photos Subcollection (`constructions/{constructionId}/photos/{photoId}`)**:
   - Master Gate: Single-document operations (`get`, `create`, `update`, `delete`) verify parent construction existence and `ownerId == request.auth.uid` via `get()`.
   - `photo.constructionId` must equal the `{constructionId}` path parameter and is immutable.
   - `allow list` validates `resource.data.ownerId == request.auth.uid` directly without `get()` lookups to prevent O(n) read cost amplification.

3. **Expenses Ledger (`expenses/{expenseId}`)**:
   - Global Consistency Invariant: Creating an expense requires `exists()` and `get()` validation confirming `constructions/$(incoming().constructionId)` exists and belongs to `request.auth.uid`.
   - `constructionId`, `ownerId`, and `createdAt` are immutable after creation.
   - `valor` must be a finite positive number (`valor > 0 && valor <= 100000000`).
   - `categoria` and `formaPagamento` are strictly constrained to allowlisted accounting enums matching `firebase-blueprint.json`.
   - `allow list` enforces `resource.data.ownerId == request.auth.uid` directly on queried documents.

---

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Collection | Malicious Payload / Condition | Expected Result |
|---|---------------|-------------------|-------------------------------|-----------------|
| 1 | **Identity Spoofing** | `constructions` | `{ ..., "ownerId": "victim_uid" }` | `PERMISSION_DENIED` |
| 2 | **Shadow Field Injection (Create)** | `constructions` | `{ ...validConstruction, "isAdmin": true }` | `PERMISSION_DENIED` |
| 3 | **Shadow Field Injection (Update)** | `expenses` | `update({ "valor": 500, "approvedBy": "root", "updatedAt": serverTimestamp() })` | `PERMISSION_DENIED` |
| 4 | **ID Poisoning (>128 chars / invalid chars)** | `constructions` | Document ID `"../admin$$" + "a".repeat(200)` | `PERMISSION_DENIED` |
| 5 | **Orphaned Expense Creation** | `expenses` | `{ ...validExpense, "constructionId": "non_existent_obra" }` | `PERMISSION_DENIED` |
| 6 | **Cross-Tenant Expense Injection** | `expenses` | `{ ...validExpense, "constructionId": "other_user_obra_id" }` | `PERMISSION_DENIED` |
| 7 | **Timestamp Forgery** | `expenses` | `{ ...validExpense, "createdAt": "2020-01-01T00:00:00Z" }` | `PERMISSION_DENIED` |
| 8 | **Immutable Field Tampering** | `expenses` | `update({ "constructionId": "another_obra", "updatedAt": serverTimestamp() })` | `PERMISSION_DENIED` |
| 9 | **Terminal State Bypass** | `constructions` | Updating `orcamentoTotal` after `existing().status == "concluida"` | `PERMISSION_DENIED` |
| 10 | **Value / Type Poisoning** | `expenses` | `update({ "valor": -999999, "updatedAt": serverTimestamp() })` or string `"1000"` | `PERMISSION_DENIED` |
| 11 | **Unverified Email Spoofing** | `constructions` | Auth token with `email_verified: false` attempting `create` | `PERMISSION_DENIED` |
| 12 | **Cross-Tenant List Scraping** | `expenses` | `getDocs(collection(db, "expenses"))` without `where("ownerId", "==", uid)` | `PERMISSION_DENIED` |
