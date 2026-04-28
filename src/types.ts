export interface Attendee {
  ticketNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  checkinDate: string; // ISO 8601 UTC
}

export type AdminRole = 'superadmin' | 'organiser' | 'team_member';

export interface Admin {
  email: string;
  role: AdminRole;
  addedAt: string;
}

export type EventStatus = 'open' | 'closed';

export interface GDGEvent {
  id: string;
  name: string;
  description?: string;
  date: string;
  createdAt: string;
  status: EventStatus;
  assignedTeams?: Record<string, true>;
}

export interface Team {
  id: string;
  name: string;
  createdAt: string;
  members?: Record<string, true>;
}
