/**
 * Database access layer for the GDG Check-In app.
 *
 * All reads and writes to Firebase Realtime Database go through this module.
 * Firebase RTDB path structure:
 *
 *   admins/
 *     {emailKey}/          — Admin record (role, addedAt)
 *   events/
 *     {eventId}/           — GDGEvent fields (name, date, status, …)
 *       attendees/
 *         {ticketNumber}/  — Attendee record
 *       ticketCounter      — Atomic integer for walk-in ticket numbering
 *       assignedTeams/
 *         {teamId}         — true (presence flag)
 *   teams/
 *     {teamId}/            — Team record (name, createdAt)
 *       members/
 *         {emailKey}       — true (presence flag)
 *
 * Listener functions (listenXxx) return an unsubscribe callback — call it in
 * a useEffect cleanup to avoid memory leaks.
 */
import { ref, push, set, update, onValue, runTransaction, get, remove } from 'firebase/database';
import { db } from './firebase';
import type { Attendee, GDGEvent, Admin, AdminRole, EventStatus, Team } from './types';

/**
 * Converts an email address into a Firebase-safe key.
 * Firebase RTDB forbids `.` in path segments, so we replace each `.` with `,`.
 * The encoding is reversible: `,` → `.`.
 */
export function emailToKey(email: string) {
  return email.toLowerCase().replace(/\./g, ',');
}

/** Fetches a single admin record by email. Returns `null` if the email is not in the admins list. */
export async function getAdmin(email: string): Promise<Admin | null> {
  const snap = await get(ref(db, `admins/${emailToKey(email)}`));
  if (!snap.exists()) return null;
  return snap.val() as Admin;
}

/**
 * Writes an admin record only if one does not already exist for this email.
 * Used at app startup to ensure at least one superadmin is always present.
 */
export async function seedAdmin(email: string, role: AdminRole): Promise<void> {
  const key = emailToKey(email);
  const snap = await get(ref(db, `admins/${key}`));
  if (!snap.exists()) {
    await set(ref(db, `admins/${key}`), { email, role, addedAt: new Date().toISOString() });
  }
}

/**
 * Subscribes to the full admins list in real time.
 * Delivers an alphabetically sorted array on every change.
 * @returns Unsubscribe function — call in a useEffect cleanup.
 */
export function listenAdmins(callback: (admins: Admin[]) => void): () => void {
  const adminsRef = ref(db, 'admins');
  return onValue(adminsRef, (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val() as Record<string, Admin>;
    const admins = Object.values(data).sort((a, b) => a.email.localeCompare(b.email));
    callback(admins);
  });
}

/** Creates or overwrites an admin record. Overwrites silently if the email already exists. */
export async function addAdmin(email: string, role: AdminRole, teamId?: string): Promise<void> {
  const key = emailToKey(email);
  const payload: Record<string, unknown> = {
    email: email.toLowerCase(),
    role,
    addedAt: new Date().toISOString(),
  };
  if (teamId) payload.teamId = teamId;
  await set(ref(db, `admins/${key}`), payload);
}

/** Updates only the `teamId` field for an existing admin. */
export async function updateAdminTeam(email: string, teamId: string): Promise<void> {
  await set(ref(db, `admins/${emailToKey(email)}/teamId`), teamId);
}

/** Permanently removes an admin. No-op if the email does not exist. */
export async function removeAdmin(email: string): Promise<void> {
  await remove(ref(db, `admins/${emailToKey(email)}`));
}

/** Updates only the `role` field for an existing admin without touching other fields. */
export async function updateAdminRole(email: string, role: AdminRole): Promise<void> {
  await set(ref(db, `admins/${emailToKey(email)}/role`), role);
}

/**
 * Subscribes to all events in real time, sorted newest-first by `createdAt`.
 * Missing `status` fields in legacy nodes default to `'open'`.
 * @param onError Optional error handler (e.g. permission denied on sign-out).
 * @returns Unsubscribe function — call in a useEffect cleanup.
 */
export function listenEvents(
  callback: (events: GDGEvent[]) => void,
  onError?: (err: Error) => void,
  teamId?: string
): () => void {
  const eventsRef = ref(db, 'events');
  const unsub = onValue(
    eventsRef,
    (snap) => {
      if (!snap.exists()) { callback([]); return; }
      const data = snap.val() as Record<string, any>;
      const events = Object.entries(data)
        .map(([id, val]) => {
          const attendees = val.attendees ? Object.values(val.attendees) as Attendee[] : [];
          const { attendees: _a, ticketCounter: _t, ...eventData } = val;
          return {
            status: 'open' as EventStatus,
            ...eventData,
            id,
            attendeeCount: attendees.length,
            checkedInCount: attendees.filter((a) => a.checkinDate).length,
          } as GDGEvent;
        })
        .filter((e) => !teamId || e.assignedTeams?.[teamId] === true)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      callback(events);
    },
    (err) => onError?.(err)
  );
  return unsub;
}

/**
 * Creates a new event using a Firebase push-key as the ID.
 * New events default to `status: 'open'`.
 * @returns The Firebase push-key (`eventId`) of the newly created event.
 */
export async function createEvent(
  data: Pick<GDGEvent, 'name' | 'date' | 'description'>
): Promise<string> {
  const eventsRef = ref(db, 'events');
  const newRef = push(eventsRef);
  const payload: Record<string, unknown> = {
    name: data.name,
    date: data.date,
    status: 'open',
    createdAt: new Date().toISOString(),
  };
  if (data.description) payload.description = data.description;
  await set(newRef, payload);
  return newRef.key!;
}

/**
 * Partially updates an event's mutable fields.
 * Passing `description: ''` removes the field from the database (sets it to `null`).
 */
export async function updateEvent(
  eventId: string,
  data: Partial<Pick<GDGEvent, 'name' | 'date' | 'description' | 'status' | 'cloudCreditsUrl'>>
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.date !== undefined) updates.date = data.date;
  if (data.status !== undefined) updates.status = data.status;
  if (data.description !== undefined) {
    updates.description = data.description || null;
  }
  if (data.cloudCreditsUrl !== undefined) {
    updates.cloudCreditsUrl = data.cloudCreditsUrl || null;
  }
  await update(ref(db, `events/${eventId}`), updates);
}

/** Records the moment an attendee clicks the Cloud Credits button. */
export async function markCloudCreditsClicked(eventId: string, email: string): Promise<void> {
  const result = await findAttendeeByEmail(eventId, email);
  if (!result) return;
  await update(ref(db, `events/${eventId}/attendees/${result.key}`), {
    cloudCreditsClickedAt: new Date().toISOString(),
  });
}

/**
 * Permanently deletes an event node and all its nested data (attendees, ticketCounter, assignedTeams).
 * This is irreversible — confirm with the user before calling.
 */
export async function deleteEvent(eventId: string): Promise<void> {
  await remove(ref(db, `events/${eventId}`));
}

/**
 * Subscribes to all attendees for an event in real time.
 * Sort order: checked-in attendees first (by check-in time), then remaining alphabetically by full name.
 * @returns Unsubscribe function — call in a useEffect cleanup.
 */
export function listenAttendees(
  eventId: string,
  callback: (attendees: Attendee[]) => void
): () => void {
  const attendeesRef = ref(db, `events/${eventId}/attendees`);
  const unsub = onValue(attendeesRef, (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val() as Record<string, Attendee>;
    const attendees = Object.values(data).sort((a, b) => {
      if (a.checkinDate && b.checkinDate) return a.checkinDate.localeCompare(b.checkinDate);
      if (a.checkinDate) return -1;
      if (b.checkinDate) return 1;
      return `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
    });
    callback(attendees);
  });
  return unsub;
}

/**
 * Checks in a walk-in attendee who was not pre-registered via Bevy.
 *
 * Uses a Firebase transaction on `ticketCounter` to assign a globally unique,
 * sequential ticket number (`GDGWALKIN0001`, `GDGWALKIN0002`, …) without races
 * when multiple staff devices check in attendees simultaneously.
 *
 * @returns The newly created Attendee record including the generated ticket number.
 */
export async function checkInAttendee(
  eventId: string,
  input: Pick<Attendee, 'firstName' | 'lastName' | 'email'>
): Promise<Attendee> {
  const counterRef = ref(db, `events/${eventId}/ticketCounter`);
  let ticketNum = 1;
  await runTransaction(counterRef, (current: number | null) => {
    ticketNum = (current ?? 0) + 1;
    return ticketNum;
  });

  const attendee: Attendee = {
    ...input,
    ticketNumber: `GDGWALKIN${String(ticketNum).padStart(4, '0')}`,
    checkinDate: new Date().toISOString(),
    source: 'walk-in',
  };

  const attendeesRef = ref(db, `events/${eventId}/attendees`);
  const newRef = push(attendeesRef);
  await set(newRef, attendee);
  return attendee;
}

/**
 * Scans all attendees for the given event and returns the first whose email matches (case-insensitive).
 *
 * Returns both the Firebase node key and the attendee record so the caller can
 * pass the key directly to `markCheckedIn` without a second lookup.
 *
 * @returns `{ key, attendee }` if found, or `null` if no attendee has that email.
 */
export async function findAttendeeByEmail(
  eventId: string,
  email: string
): Promise<{ key: string; attendee: Attendee } | null> {
  const snap = await get(ref(db, `events/${eventId}/attendees`));
  if (!snap.exists()) return null;
  const data = snap.val() as Record<string, Attendee>;
  const entry = Object.entries(data).find(
    ([, a]) => a.email?.toLowerCase() === email.toLowerCase()
  );
  if (!entry) return null;
  return { key: entry[0], attendee: entry[1] };
}

/**
 * Stamps a pre-registered attendee as checked in by writing the current UTC timestamp
 * to their `checkinDate` field.
 *
 * @param key The Firebase node key (ticket number for Bevy attendees, push-key for walk-ins).
 * @returns The updated Attendee with `checkinDate` set.
 */
export async function markCheckedIn(
  eventId: string,
  key: string,
  attendee: Attendee
): Promise<Attendee> {
  const checkinDate = new Date().toISOString();
  await update(ref(db, `events/${eventId}/attendees/${key}`), { checkinDate });
  return { ...attendee, checkinDate };
}

/**
 * Removes the `checkinDate` from an attendee, effectively undoing their check-in.
 * Looks up the attendee by email first, then sets `checkinDate` to `null`
 * (Firebase RTDB deletes a field when set to null).
 * No-op if the email is not found.
 */
export async function undoCheckIn(eventId: string, email: string): Promise<void> {
  const result = await findAttendeeByEmail(eventId, email);
  if (!result) return;
  await update(ref(db, `events/${eventId}/attendees/${result.key}`), { checkinDate: null });
}

/**
 * Bulk-imports attendees parsed from a Bevy CSV export.
 *
 * Deduplication is by ticket number: any attendee whose `ticketNumber` already
 * exists as a key under `events/{eventId}/attendees` is skipped. This makes
 * re-importing the same CSV safe.
 *
 * All new records are written in a single `update()` call so the operation is
 * atomic — partial imports cannot happen if the function throws mid-way.
 *
 * @returns `{ imported, skipped }` counts for UI feedback.
 */
export async function importBevyAttendees(
  eventId: string,
  attendees: Omit<Attendee, 'source'>[]
): Promise<{ imported: number; skipped: number }> {
  const snap = await get(ref(db, `events/${eventId}/attendees`));
  const existing = snap.exists() ? new Set(Object.keys(snap.val())) : new Set<string>();

  const updates: Record<string, Attendee> = {};
  let imported = 0;
  let skipped = 0;

  for (const a of attendees) {
    if (existing.has(a.ticketNumber)) {
      skipped++;
    } else {
      updates[`events/${eventId}/attendees/${a.ticketNumber}`] = { ...a, source: 'bevy' };
      imported++;
    }
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(db), updates);
  }

  return { imported, skipped };
}

/**
 * One-shot fetch of all attendees for an event (no real-time subscription).
 * Used by the CSV export feature which only needs a point-in-time snapshot.
 */
export async function getAttendees(eventId: string): Promise<Attendee[]> {
  const snap = await get(ref(db, `events/${eventId}/attendees`));
  if (!snap.exists()) return [];
  const data = snap.val() as Record<string, Attendee>;
  return Object.values(data);
}

/**
 * Returns `true` if any attendee in the event has the given email (case-insensitive).
 * Used by the public consumer check-in form to gate the QR self-service flow.
 */
export async function isEmailRegistered(
  eventId: string,
  email: string
): Promise<boolean> {
  const snap = await get(ref(db, `events/${eventId}/attendees`));
  if (!snap.exists()) return false;
  const data = snap.val() as Record<string, Attendee>;
  return Object.values(data).some(
    (a) => a.email.toLowerCase() === email.toLowerCase()
  );
}

/** Adds a team to an event's `assignedTeams` map. Idempotent — safe to call if already assigned. */
export async function assignTeamToEvent(eventId: string, teamId: string): Promise<void> {
  await set(ref(db, `events/${eventId}/assignedTeams/${teamId}`), true);
}

/** Removes a team from an event's `assignedTeams` map. No-op if not currently assigned. */
export async function removeTeamFromEvent(eventId: string, teamId: string): Promise<void> {
  await remove(ref(db, `events/${eventId}/assignedTeams/${teamId}`));
}

/**
 * Subscribes to all teams in real time, sorted oldest-first by `createdAt`.
 * @returns Unsubscribe function — call in a useEffect cleanup.
 */
export function listenTeams(callback: (teams: Team[]) => void): () => void {
  const teamsRef = ref(db, 'teams');
  return onValue(teamsRef, (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val() as Record<string, Omit<Team, 'id'>>;
    const teams = Object.entries(data)
      .map(([id, val]) => ({ ...val, id }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    callback(teams);
  });
}

/**
 * Creates a new team.
 * @returns The Firebase push-key (`teamId`) of the new team.
 */
export async function createTeam(name: string): Promise<string> {
  const newRef = push(ref(db, 'teams'));
  await set(newRef, { name, createdAt: new Date().toISOString() });
  return newRef.key!;
}

/**
 * Subscribes to a single team in real time.
 * @returns Unsubscribe function — call in a useEffect cleanup.
 */
export function listenTeam(teamId: string, callback: (team: Team | null) => void): () => void {
  const teamRef = ref(db, `teams/${teamId}`);
  return onValue(teamRef, (snap) => {
    if (!snap.exists()) { callback(null); return; }
    callback({ ...snap.val(), id: teamId } as Team);
  });
}

/** Sets or clears the globalAccess flag on a team. */
export async function setTeamGlobalAccess(teamId: string, value: boolean): Promise<void> {
  await set(ref(db, `teams/${teamId}/globalAccess`), value || null);
}

/** Permanently deletes a team node and all its members. */
export async function deleteTeam(teamId: string): Promise<void> {
  await remove(ref(db, `teams/${teamId}`));
}

/** Adds a member to a team using their email key. Idempotent. */
export async function addTeamMember(teamId: string, email: string): Promise<void> {
  await set(ref(db, `teams/${teamId}/members/${emailToKey(email)}`), true);
}

/** Removes a member from a team. No-op if the member is not in the team. */
export async function removeTeamMember(teamId: string, email: string): Promise<void> {
  await remove(ref(db, `teams/${teamId}/members/${emailToKey(email)}`));
}
