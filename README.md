# GDG Check-In

Event check-in management app for Google Developer Groups. Staff can import attendees from Bevy, check people in at the door, manage teams, and share a public QR code for self-service check-in.

Built with React 19, TypeScript, Material UI, and Firebase Realtime Database.

---

## Features

- **Bevy CSV import** — upload the attendee export from Bevy to pre-load the guest list; already-imported tickets are automatically skipped.
- **Staff check-in** — look up attendees by email, confirm pre-registered guests, or add walk-ins on the spot.
- **Real-time dashboard** — live attendee table with check-in / undo per row, search, and a checked-in counter.
- **Public QR check-in** — shareable URL and QR code for a self-service consumer form; a separate kiosk display mode shows just the QR.
- **Event management** — create, edit, open/close, and delete events.
- **Teams** — organise volunteers into teams and assign them to events.
- **Role-based access** — three roles (`superadmin`, `organiser`, `team_member`) control what each user can see and do.
- **CSV export** — download all attendees (registered and checked-in) as a CSV at any time.

---

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | React 19 + TypeScript |
| Component library | Material UI v9 |
| Build tool | Vite |
| Database & Auth | Firebase Realtime Database + Google Sign-In |
| QR codes | qrcode.react |

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Firebase project with **Realtime Database** and **Authentication (Google provider)** enabled.

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure Firebase
#    Replace the values in src/firebase.ts with your own project credentials.

# 3. Start the dev server
npm run dev
```

### Other scripts

```bash
npm run build    # Type-check and build for production
npm run preview  # Serve the production build locally
npm run lint     # Run ESLint
```

---

## URL Routing

The app serves three distinct surfaces from a single origin, selected by query parameters:

| URL | Surface |
|---|---|
| `/` | Admin app (requires Google sign-in) |
| `/?event=<id>` | Public consumer check-in form |
| `/?event=<id>&display=qr` | Kiosk QR code display |

---

## Project Structure

```
src/
  firebase.ts          # Firebase app, db, auth, and googleProvider singletons
  db.ts                # All Firebase Realtime Database reads and writes
  types.ts             # Shared TypeScript interfaces and types
  App.tsx              # Root component — URL routing + AdminApp shell
  theme.ts             # MUI theme customisation
  components/
    AuthGate.tsx        # Google sign-in gate; resolves role from admins table
    AppLogo.tsx         # GDG logo mark
    EventsList.tsx      # List of all events with status chips
    EventItem.tsx       # Single event row
    CreateEventForm.tsx # Modal form to create a new event
    Dashboard.tsx       # Real-time attendee table + Add / QR dialogs
    CheckInForm.tsx     # Staff check-in form (email lookup flow)
    EventSettings.tsx   # Event detail settings (name, status, teams, export, import, delete)
    BevyImport.tsx      # Bevy CSV parse → preview → import flow
    OrganisersPage.tsx  # Superadmin: manage admin users and roles
    TeamsPage.tsx       # Create / manage volunteer teams and members
    ConsumerCheckIn.tsx # Public self-service check-in form for attendees
    PublicQRDisplay.tsx # Kiosk screen showing the event's QR code
```

---

## Database Schema

Firebase Realtime Database path structure:

```
admins/
  {emailKey}/           email, role, addedAt
events/
  {eventId}/            name, date, description?, status, createdAt
    attendees/
      {ticketNumber}/   firstName, lastName, email, source, checkinDate?, jobTitle?, company?, ticketType?, bevyOrderNumber?
    ticketCounter       integer — auto-incremented for walk-in ticket numbers
    assignedTeams/
      {teamId}          true (presence flag)
teams/
  {teamId}/             name, createdAt
    members/
      {emailKey}        true (presence flag)
```

> **Email keys:** Firebase RTDB forbids `.` in path segments. All email-based keys replace every `.` with `,` (see `emailToKey` in `db.ts`).

---

## Roles

| Role | Events | Organisers | Teams |
|---|---|---|---|
| `superadmin` | Full access | Full access | Full access |
| `organiser` | Full access | — | Full access |
| `team_member` | — | — | Read-only |

A first superadmin must be seeded manually via `seedAdmin` in `db.ts` (or directly in the Firebase console).

---

## Bevy Import

1. In Bevy, export attendees for the event as a CSV.
2. In the app, open **Settings** for the event and use **Import from Bevy**.
3. A preview table shows the parsed rows before any data is written.
4. Confirm to import — tickets that already exist in the database are skipped automatically, so re-importing is safe.

Expected CSV column order:
```
Order Number | Ticket Number | First Name | Last Name | Email | Job Title | Company | Ticket Type
```

---

## Walk-in Check-in

Walk-ins are attendees who arrive without a Bevy registration:

1. Staff opens the **Dashboard** and clicks **Add**.
2. Enter the attendee's email — if no record is found, a name form appears.
3. A unique ticket number (`GDGWALKIN0001`, `GDGWALKIN0002`, …) is assigned atomically using a Firebase transaction to prevent duplicates when multiple devices check in simultaneously.

---

## Check-in Status

Each event has a `status` field (`open` or `closed`) toggled from Event Settings:

- **Open** — the public consumer check-in form is active.
- **Closed** — the public form shows a "check-ins closed" message; staff can still check in from the admin dashboard.
