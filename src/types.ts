/**
 * Represents a single event attendee stored under `events/{eventId}/attendees/{ticketNumber}`.
 *
 * Bevy-imported attendees use their Bevy ticket number as the key.
 * Walk-ins get an auto-generated key (`GDGWALKIN0001`, etc.) assigned at check-in time.
 */
export interface Attendee {
  /** Primary key. Bevy ticket number or generated GDGWALKIN#### for walk-ins. */
  ticketNumber: string;
  /** Bevy order number — present only for Bevy-imported attendees. */
  bevyOrderNumber?: string;
  firstName: string;
  lastName: string;
  email: string;
  /** ISO 8601 UTC timestamp set when the attendee is checked in. Absent means not yet checked in. */
  checkinDate?: string;
  /** ISO 8601 UTC timestamp set when the attendee clicks the Cloud Credits button. */
  cloudCreditsClickedAt?: string;
  /** 'bevy' = imported from Bevy CSV; 'walk-in' = added at the door. */
  source: 'bevy' | 'walk-in';
  jobTitle?: string;
  company?: string;
  ticketType?: string;
}

/**
 * Access levels for admin users.
 * - `superadmin` — full access: events, organisers, teams, settings.
 * - `organiser`  — events and teams, but cannot manage other admins.
 * - `team_member` — read-only team view; cannot create or edit events.
 */
export type AdminRole = 'superadmin' | 'organiser' | 'team_member';

/**
 * An admin user stored under `admins/{emailKey}`.
 * Email keys replace `.` with `,` because Firebase RTDB forbids dots in keys.
 */
export interface Admin {
  email: string;
  role: AdminRole;
  /** ISO 8601 timestamp of when the admin was added. */
  addedAt: string;
  /** Team this admin belongs to. Absent for superadmin. */
  teamId?: string;
}

/**
 * Whether a GDGEvent is accepting check-ins.
 * - `open`   — public check-in form is active.
 * - `closed` — public form shows a "check-ins closed" message.
 */
export type EventStatus = 'open' | 'closed';

/**
 * An event stored under `events/{id}`.
 * The `id` field is the Firebase push-key and is not persisted in the node itself;
 * it is injected when reading from the database.
 */
export interface GDGEvent {
  /** Firebase push-key (injected on read, not stored in the node). */
  id: string;
  name: string;
  description?: string;
  /** Date string in `YYYY-MM-DD` format (no time component). */
  date: string;
  /** ISO 8601 timestamp of creation. */
  createdAt: string;
  status: EventStatus;
  /**
   * Set of team IDs assigned to this event, stored as `{ [teamId]: true }`.
   * Using a Record rather than an array keeps Firebase RTDB updates atomic.
   */
  assignedTeams?: Record<string, true>;
  /** Total number of registered attendees — injected by listenEvents, not stored in DB. */
  attendeeCount?: number;
  /** Number of attendees who have checked in — injected by listenEvents, not stored in DB. */
  checkedInCount?: number;
  /** Optional URL shown as a button on the check-in success screen (e.g. a Google Cloud Credits redemption link). */
  cloudCreditsUrl?: string;
}

/**
 * A volunteer / organiser team stored under `teams/{id}`.
 * Members are stored as `{ [emailKey]: true }` using the same dot→comma encoding as admins.
 */
export interface Team {
  /** Firebase push-key (injected on read, not stored in the node). */
  id: string;
  name: string;
  /** ISO 8601 timestamp of creation. */
  createdAt: string;
  /**
   * Set of member email keys, stored as `{ [emailToKey(email)]: true }`.
   * Absent when the team has no members yet.
   */
  members?: Record<string, true>;
  /** When true, members of this team can see all events regardless of assignment. */
  globalAccess?: boolean;
}
