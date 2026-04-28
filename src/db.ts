import { ref, push, set, update, onValue, runTransaction, get, remove } from 'firebase/database';
import { db } from './firebase';
import type { Attendee, GDGEvent, Admin, AdminRole, EventStatus, Team } from './types';

// Firebase keys can't contain dots — encode email by replacing . with ,
export function emailToKey(email: string) {
  return email.toLowerCase().replace(/\./g, ',');
}

export async function getAdmin(email: string): Promise<Admin | null> {
  const snap = await get(ref(db, `admins/${emailToKey(email)}`));
  if (!snap.exists()) return null;
  return snap.val() as Admin;
}

export async function seedAdmin(email: string, role: AdminRole): Promise<void> {
  const key = emailToKey(email);
  const snap = await get(ref(db, `admins/${key}`));
  if (!snap.exists()) {
    await set(ref(db, `admins/${key}`), { email, role, addedAt: new Date().toISOString() });
  }
}

export function listenAdmins(callback: (admins: Admin[]) => void): () => void {
  const adminsRef = ref(db, 'admins');
  return onValue(adminsRef, (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val() as Record<string, Admin>;
    const admins = Object.values(data).sort((a, b) => a.email.localeCompare(b.email));
    callback(admins);
  });
}

export async function addAdmin(email: string, role: AdminRole): Promise<void> {
  const key = emailToKey(email);
  await set(ref(db, `admins/${key}`), {
    email: email.toLowerCase(),
    role,
    addedAt: new Date().toISOString(),
  });
}

export async function removeAdmin(email: string): Promise<void> {
  await remove(ref(db, `admins/${emailToKey(email)}`));
}

export async function updateAdminRole(email: string, role: AdminRole): Promise<void> {
  await set(ref(db, `admins/${emailToKey(email)}/role`), role);
}

export function listenEvents(
  callback: (events: GDGEvent[]) => void,
  onError?: (err: Error) => void
): () => void {
  const eventsRef = ref(db, 'events');
  const unsub = onValue(
    eventsRef,
    (snap) => {
      if (!snap.exists()) { callback([]); return; }
      const data = snap.val() as Record<string, Omit<GDGEvent, 'id'>>;
      const events = Object.entries(data)
      // @ts-ignore
        .map(([id, val]) => ({ status: 'open' as EventStatus, ...val, id }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      callback(events);
    },
    (err) => onError?.(err)
  );
  return unsub;
}

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

export async function updateEvent(
  eventId: string,
  data: Partial<Pick<GDGEvent, 'name' | 'date' | 'description' | 'status'>>
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.date !== undefined) updates.date = data.date;
  if (data.status !== undefined) updates.status = data.status;
  if (data.description !== undefined) {
    updates.description = data.description || null; // null removes the field
  }
  await update(ref(db, `events/${eventId}`), updates);
}

export async function deleteEvent(eventId: string): Promise<void> {
  await remove(ref(db, `events/${eventId}`));
}

export function listenAttendees(
  eventId: string,
  callback: (attendees: Attendee[]) => void
): () => void {
  const attendeesRef = ref(db, `events/${eventId}/attendees`);
  const unsub = onValue(attendeesRef, (snap) => {
    if (!snap.exists()) { callback([]); return; }
    const data = snap.val() as Record<string, Attendee>;
    const attendees = Object.values(data).sort((a, b) =>
      a.checkinDate.localeCompare(b.checkinDate)
    );
    callback(attendees);
  });
  return unsub;
}

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
    ticketNumber: `TKT-${String(ticketNum).padStart(4, '0')}`,
    checkinDate: new Date().toISOString(),
  };

  const attendeesRef = ref(db, `events/${eventId}/attendees`);
  const newRef = push(attendeesRef);
  await set(newRef, attendee);
  return attendee;
}

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

export async function assignTeamToEvent(eventId: string, teamId: string): Promise<void> {
  await set(ref(db, `events/${eventId}/assignedTeams/${teamId}`), true);
}

export async function removeTeamFromEvent(eventId: string, teamId: string): Promise<void> {
  await remove(ref(db, `events/${eventId}/assignedTeams/${teamId}`));
}

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

export async function createTeam(name: string): Promise<string> {
  const newRef = push(ref(db, 'teams'));
  await set(newRef, { name, createdAt: new Date().toISOString() });
  return newRef.key!;
}

export async function deleteTeam(teamId: string): Promise<void> {
  await remove(ref(db, `teams/${teamId}`));
}

export async function addTeamMember(teamId: string, email: string): Promise<void> {
  await set(ref(db, `teams/${teamId}/members/${emailToKey(email)}`), true);
}

export async function removeTeamMember(teamId: string, email: string): Promise<void> {
  await remove(ref(db, `teams/${teamId}/members/${emailToKey(email)}`));
}
