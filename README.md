# GDG Check-In

Event check-in management app for Google Developer Groups. Staff can import attendees from Bevy, check people in at the door, manage teams, run a merch draw, and share a public QR code for self-service check-in.

Built with React 19, TypeScript, Material UI, and Firebase Realtime Database.

---

## Features

- **Bevy CSV import** — upload the attendee export from Bevy to pre-load the guest list. Re-importing is safe: existing tickets are merged in place, so check-ins are never lost.
- **Staff check-in** — look up attendees by email, confirm pre-registered guests, or add walk-ins on the spot.
- **Real-time dashboard** — live attendee table with check-in / undo per row, search, and a checked-in counter.
- **Public QR check-in** — shareable URL and QR code for a self-service consumer form; a separate kiosk display mode shows just the QR.
- **Permanent team links** — each team gets a slug (`?team=<slug>`) that always resolves to that team's currently live event, so printed signage doesn't need reprinting between events.
- **Merch draw** — draw random winners from the checked-in pool, with a visible shuffle, an undo for no-shows, and a reset.
- **Cloud credits link** — an optional per-event URL surfaced as a button on the check-in success screen; clicks are recorded per attendee.
- **Event management** — create, edit, open/close, and delete events.
- **Teams** — organise volunteers into teams, assign them to events, and optionally grant a team access to every event.
- **Role-based access** — three roles (`superadmin`, `organiser`, `team_member`) control what each user can see and do.
- **CSV export** — download all attendees as a CSV in the same shape as the Bevy export, ready for Bevy's Bulk Upload.

---

## Tech Stack

| Layer | Library |
|---|---|
| UI framework | React 19 + TypeScript 6 |
| Component library | Material UI v9 (Tailwind v4 is wired up via `@tailwindcss/vite` for utility classes) |
| Build tool | Vite 8 |
| Database & Auth | Firebase Realtime Database + Google Sign-In |
| Hosting | Firebase Hosting |
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
cp .env.example .env
#    Fill in the VITE_FIREBASE_* values from your Firebase project settings.
#    src/firebase.ts reads them via import.meta.env — no code changes needed.

# 3. Start the dev server
npm run dev
```

### Other scripts

```bash
npm run build    # Type-check and build for production
npm run preview  # Serve the production build locally
npm run lint     # Run ESLint
npm run deploy   # firebase deploy --only hosting
```

---

## URL Routing

The app serves several distinct surfaces from a single origin, selected by query parameters:

| URL | Surface |
|---|---|
| `/` | Admin app (requires Google sign-in) |
| `/?event=<id>` | Public consumer check-in form |
| `/?event=<id>&display=qr` | Kiosk QR code display |
| `/?team=<slug>` | Team's live event → consumer check-in form |
| `/?team=<slug>&display=qr` | Team's live event → kiosk QR display |

`?team=` also accepts a raw team ID, so links created before slugs existed keep working.

**How a team link picks its event:** only *open* events assigned to the team are candidates. An event dated today or later beats one already past, and within each group the one nearest today wins — so a link left running across a weekend of events moves on by itself.

---

## Project Structure

```
src/
  firebase.ts          # Firebase app, db, auth, analytics, and googleProvider singletons
  db.ts                # All Firebase Realtime Database reads and writes
  types.ts             # Shared TypeScript interfaces and types
  App.tsx              # Root component — URL routing + AdminApp shell
  theme.ts             # MUI theme customisation
  components/
    AuthGate.tsx        # Google sign-in gate; resolves role and team from admins table
    AppLogo.tsx         # GDG logo mark
    EventsList.tsx      # List of all events with status chips
    EventItem.tsx       # Single event row
    CreateEventForm.tsx # Modal form to create a new event
    Dashboard.tsx       # Real-time attendee table + Add / QR dialogs
    CheckInForm.tsx     # Staff check-in form (email lookup flow)
    EventSettings.tsx   # Event detail settings (name, walk-in defaults, cloud credits, export, import, delete)
    BevyImport.tsx      # Bevy CSV parse → preview → import flow
    LuckyDraw.tsx       # Merch draw stage — random winners from the checked-in pool
    OrganisersPage.tsx  # Manage admin users and roles
    TeamsPage.tsx       # Create / manage teams, members, slugs, and global access
    ConsumerCheckIn.tsx # Public self-service check-in form for attendees
    PublicQRDisplay.tsx # Kiosk screen showing the event's QR code
    TeamLanding.tsx     # Resolves ?team=<slug> to the team's live event, then renders the form or kiosk
```

`src/storage.ts` is an unused localStorage module left from before the Firebase migration; nothing imports it.

---

## Database Schema

Firebase Realtime Database path structure:

```
admins/
  {emailKey}/           email, role, addedAt, teamId?
events/
  {eventId}/            name, date, description?, status, createdAt,
                        cloudCreditsUrl?, walkInTicketTitle?, walkInTicketVenue?
    attendees/
      {ticketNumber}/   firstName, lastName, email, source, checkinDate?,
                        cloudCreditsClickedAt?, jobTitle?, company?, ticketType?,
                        ticketTitle?, ticketVenue?, bevyOrderNumber?
    ticketCounter       integer — auto-incremented for walk-in ticket numbers
    assignedTeams/
      {teamId}          true (presence flag)
teams/
  {teamId}/             name, slug?, createdAt, globalAccess?
    members/
      {emailKey}        true (presence flag)
```

`attendeeCount` and `checkedInCount` on an event are derived in `listenEvents` and are not stored.

> **Email keys:** Firebase RTDB forbids `.` in path segments. All email-based keys replace every `.` with `,` (see `emailToKey` in `db.ts`).

---

## Roles

| Role | Events | Organisers | Teams |
|---|---|---|---|
| `superadmin` | All events | Full access | Full access |
| `organiser` | Events assigned to their team | Manage admins on their own team | — |
| `team_member` | Check-in tab only, on their team's events | — | — |

A team with `globalAccess` enabled lets its organisers and members see every event, regardless of assignment.

A first superadmin must be seeded manually via `seedAdmin` in `db.ts` (or directly in the Firebase console).

---

## Bevy Import

1. In Bevy, open the event → **Registrations** tab → **Download** → **Download CSV**.
2. In the app, open **Settings** for the event and use **Import from Bevy**. Upload the file as-is.
3. A preview table shows the parsed rows before any data is written.
4. Confirm to import. Tickets that already exist are merged rather than replaced — CSV fields overwrite the stored record, while fields the CSV doesn't carry (`checkinDate`, `cloudCreditsClickedAt`, …) are preserved. Re-importing is safe and backfills new columns.

Columns are located by **header name** (case-insensitive), so extra or reordered columns import fine. Recognised headers:

```
Order number | Ticket number | First Name | Last Name | Email | Title (or Job Title)
Company | Ticket Type | Ticket title | Ticket venue | Checkin Date (UTC)
```

Rows without a ticket number or email are skipped, as is Bevy's internal support address. A non-empty `Checkin Date (UTC)` seeds the attendee as already checked in.

**Export** produces a CSV in the same shape, so it can be pushed back through Bevy's Bulk Upload on the Registrations tab.

---

## Walk-in Check-in

Walk-ins are attendees who arrive without a Bevy registration:

1. Staff opens the **Dashboard** and clicks **Add**.
2. Enter the attendee's email — if no record is found, a name form appears.
3. A unique ticket number (`GDGWALKIN0001`, `GDGWALKIN0002`, …) is assigned atomically using a Firebase transaction to prevent duplicates when multiple devices check in simultaneously.

Walk-ins are stamped with the event's configured **walk-in ticket title** and **venue** (Event Settings). These also serve as the fallback values when exporting the CSV.

---

## Check-in Status

Each event has a `status` field (`open` or `closed`) toggled from Event Settings:

- **Open** — the public consumer check-in form is active, and the event is a candidate for its teams' permanent links.
- **Closed** — the public form shows a "check-ins closed" message; staff can still check in from the admin dashboard.
