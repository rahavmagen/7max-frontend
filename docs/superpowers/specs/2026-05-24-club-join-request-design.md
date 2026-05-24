# Club Join Request — Design Spec

## Goal

Allow new players to request access to the 7MAX club website via a public-facing join form. Admins review and approve/reject requests. Approval auto-creates the player account.

## Architecture

**Backend (Spring Boot):**
- New `join_requests` DB table + `JoinRequest` entity
- New `JoinRequestController` with public submit endpoint and admin-only review endpoints
- `JoinRequestService` handles approval logic (creates Player + User in one transaction)
- `SecurityConfig` permits `POST /api/join` without auth

**Frontend (React):**
- New `JoinRequest.jsx` page at public route `/join` (no auth required in React Router)
- `KashcashDeposits.jsx` renamed to `OpenRequests.jsx`, gains a join requests section at the top
- Nav link renamed "Open Requests"; badge count = pending joins + pending KashCash
- New API functions in `api.js`

---

## Backend

### Entity: `JoinRequest`

Table: `join_requests`

| Field | Type | Notes |
|-------|------|-------|
| id | BIGINT PK | auto-increment |
| username | VARCHAR | ClubGG username, required |
| full_name | VARCHAR | required |
| phone | VARCHAR | required; becomes password on approval |
| club_player_id | VARCHAR | optional |
| status | VARCHAR | PENDING / APPROVED / REJECTED |
| created_at | TIMESTAMP | set on insert |
| reviewed_at | TIMESTAMP | set on approve/reject |

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/join` | None | Submit a join request |
| GET | `/api/join/pending` | ADMIN/MANAGER | List PENDING requests |
| GET | `/api/join/history` | ADMIN/MANAGER | List APPROVED + REJECTED requests |
| POST | `/api/join/{id}/approve` | ADMIN/MANAGER | Approve: create Player + User, mark APPROVED |
| POST | `/api/join/{id}/reject` | ADMIN/MANAGER | Mark REJECTED |

### POST /api/join — Request body
```json
{ "username": "liorar", "fullName": "לירון", "phone": "052-1234567", "clubPlayerId": "2163-3811" }
```
- Returns `200 { "success": true }` or `400 { "error": "Username already exists" }` if username taken in players or pending requests.

### POST /api/join/{id}/approve — Logic
1. Validate request exists and is PENDING
2. Create `Player` (username, fullName, phone, clubPlayerId, active=true, balance=0, creditTotal=0)
3. Create `User` (username=same, passwordHash=BCrypt(phone), role=PLAYER, player=created player, mustChangePassword=false)
4. Set request status=APPROVED, reviewedAt=now()
5. Return `200 { "success": true }`

### GET /api/join/pending — Response
```json
[{ "id": 1, "username": "newplayer1", "fullName": "ישראל כהן", "phone": "052-1234567", "clubPlayerId": "3421-1122", "createdAt": "2026-05-24T10:00:00" }]
```

### SecurityConfig change
Add `/api/join` (POST) to the list of permitted-without-auth endpoints (alongside `/api/auth/login`).

---

## Frontend

### New page: `JoinRequest.jsx` — route `/join`

- Public route — added to `App.jsx` **outside** the auth-protected area (like the Login route)
- Layout mirrors Login page: centered card, dark background, `/7maxlogo.png` at top
- Form fields:
  - ClubGG Username (required)
  - Full Name (required)
  - Phone (required)
  - ClubGG Player ID (optional, labeled as such)
- Info box below the submit button (always visible, not a result):
  ```
  To be approved, you must first join the club on ClubGG.
  👉 [Join the club app] (links to https://clubgg.app.link/QyU3JGEfS2b)
  Club ID: 770299
  ```
- On submit success: show a green success message in place of the form ("Request sent! You will receive access once approved.")
- On submit error (e.g. username already exists): show inline error, form stays

### Modified: `KashcashDeposits.jsx` → `OpenRequests.jsx`

File renamed to `OpenRequests.jsx`. Internal changes:
- Page title changes from "KashCash Deposits" to "Open Requests"
- New section rendered **above** the existing KashCash pending section:
  - Header: "Pending Join Requests" (indigo accent)
  - Table columns: Username, Full Name, Phone, ClubGG ID, Date, Actions
  - Each row has Approve (green) and Reject (red) buttons
  - On approve/reject → refresh both join requests and KashCash lists
- Existing rejected history: collapsible "Rejected Requests" section below the join pending section
- KashCash section header renamed to "KashCash Deposits (Open)" to distinguish it

### Modified: `App.jsx`

- Import `OpenRequests` instead of `KashcashDeposits`
- Route `/open-requests` replaces `/kashcash-deposits`
- Nav link text: "Open Requests"
- Badge polling: `GET /api/join/pending` count + existing KashCash pending count → combined badge number

### New API functions in `api.js`

```js
export const submitJoinRequest = (data) => axios.post(`${API}/join`, data);
export const getPendingJoinRequests = () => axios.get(`${API}/join/pending`, authHeader());
export const getJoinHistory = () => axios.get(`${API}/join/history`, authHeader());
export const approveJoinRequest = (id) => axios.post(`${API}/join/${id}/approve`, {}, authHeader());
export const rejectJoinRequest = (id) => axios.post(`${API}/join/${id}/reject`, {}, authHeader());
```

---

## Data Flow

```
User visits /join
  → fills form → POST /api/join (no auth)
  → success message shown

Admin visits /open-requests
  → sees pending join requests at top
  → clicks Approve → POST /api/join/{id}/approve
     → Player + User created, request marked APPROVED, row disappears
  → clicks Reject → POST /api/join/{id}/reject
     → request marked REJECTED, row disappears, appears in history section below
```

---

## Edge Cases

- **Duplicate username on submit:** backend checks both `players` table and `join_requests` (PENDING) — returns 400 with "Username already taken or request already pending"
- **Approve fails (username conflict created between submit and approve):** return 400, admin sees error, request stays PENDING
- **Route `/join` accessible while logged in:** allowed — no redirect, user just sees the join form

---

## Files Changed

| File | Change |
|------|--------|
| `tracker/.../entity/JoinRequest.java` | New |
| `tracker/.../repository/JoinRequestRepository.java` | New |
| `tracker/.../service/JoinRequestService.java` | New |
| `tracker/.../controller/JoinRequestController.java` | New |
| `tracker/.../config/SchemaMigration.java` | Add join_requests table creation |
| `tracker/.../security/SecurityConfig.java` | Permit POST /api/join |
| `poker-frontend/src/pages/JoinRequest.jsx` | New |
| `poker-frontend/src/pages/OpenRequests.jsx` | New (was KashcashDeposits.jsx) |
| `poker-frontend/src/api.js` | Add 5 join request functions |
| `poker-frontend/src/App.jsx` | Add /join route, rename /open-requests, update badge |
