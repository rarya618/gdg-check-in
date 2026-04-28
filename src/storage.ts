import type { Attendee } from './types';

const ATTENDEES_KEY = 'gdg_attendees';
const COUNTER_KEY = 'gdg_ticket_counter';

export function getAttendees(): Attendee[] {
  try {
    return JSON.parse(localStorage.getItem(ATTENDEES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveAttendee(attendee: Attendee): void {
  const attendees = getAttendees();
  attendees.push(attendee);
  localStorage.setItem(ATTENDEES_KEY, JSON.stringify(attendees));
}

export function nextTicketNumber(): string {
  const current = parseInt(localStorage.getItem(COUNTER_KEY) ?? '0', 10);
  const next = current + 1;
  localStorage.setItem(COUNTER_KEY, String(next));
  return `TKT-${String(next).padStart(4, '0')}`;
}

export function isEmailRegistered(email: string): boolean {
  return getAttendees().some(
    (a) => a.email.toLowerCase() === email.toLowerCase()
  );
}
