import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import Checkbox from '@mui/material/Checkbox';
import Alert from '@mui/material/Alert';
import CheckIcon from '@mui/icons-material/Check';
import DownloadIcon from '@mui/icons-material/Download';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import { updateEvent, deleteEvent, listenTeams, assignTeamToEvent, removeTeamFromEvent, getAttendees } from '../db';
import type { GDGEvent, Team } from '../types';
import { WALK_IN_TICKET_TITLES, WALK_IN_TICKET_VENUES } from '../types';
import BevyImport from './BevyImport';

interface Props {
  event: GDGEvent;
  onEventUpdated: (updated: GDGEvent) => void;
  onDeleted: () => void;
}

/**
 * A settings section: hairline-bordered panel with a title, a one-line
 * explanation, and an optional action aligned to the title row.
 */
function Section({
  title,
  description,
  info,
  action,
  children,
}: {
  title: string;
  description?: string;
  info?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: { xs: 2.5, md: 3 } }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{title}</Typography>
            {info && (
              <Tooltip title={info} placement="top" arrow>
                <IconButton size="small" sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}>
                  <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, maxWidth: '60ch' }}>
              {description}
            </Typography>
          )}
        </Box>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

/**
 * Settings for a single event, in one column ordered by how often it's touched:
 * the live check-in switch, the event's details, what walk-ins get stamped with,
 * the teams running it, the guest list in and out, then deletion.
 *
 * Edits to the form fields are held locally and committed together from the
 * save bar that appears once something changes; every other control on the page
 * writes immediately.
 *
 * `onEventUpdated` is called whenever local state changes (name, date, status,
 * assignedTeams) so the parent (`AdminApp`) can keep its `activeEvent` in sync
 * without re-fetching.
 */
export default function EventSettings({ event, onEventUpdated, onDeleted }: Props) {
  const initial = {
    name: event.name,
    date: event.date,
    description: event.description ?? '',
    cloudCreditsUrl: event.cloudCreditsUrl ?? '',
    walkInTicketTitle: event.walkInTicketTitle ?? WALK_IN_TICKET_TITLES[0],
    walkInTicketVenue: event.walkInTicketVenue ?? WALK_IN_TICKET_VENUES[0],
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => listenTeams(setTeams), []);

  const dirty = (Object.keys(initial) as Array<keyof typeof initial>).some((k) => form[k] !== initial[k]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setSaveSuccess(false);
    setSaveError('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setSaveError('Give the event a name.'); return; }
    if (!form.date) { setSaveError('Pick a date for the event.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      await updateEvent(event.id, {
        name: form.name.trim(),
        date: form.date,
        description: form.description.trim(),
        cloudCreditsUrl: form.cloudCreditsUrl.trim(),
        walkInTicketTitle: form.walkInTicketTitle,
        walkInTicketVenue: form.walkInTicketVenue,
      });
      const updated = { ...event, name: form.name.trim(), date: form.date, description: form.description.trim() || undefined, cloudCreditsUrl: form.cloudCreditsUrl.trim() || undefined, walkInTicketTitle: form.walkInTicketTitle, walkInTicketVenue: form.walkInTicketVenue };
      onEventUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      setSaveError('Changes were not saved. Check your connection and try again.');
    }
    setSaving(false);
  }

  async function handleToggleStatus() {
    setToggling(true);
    const newStatus = event.status === 'open' ? 'closed' : 'open';
    try {
      await updateEvent(event.id, { status: newStatus });
      onEventUpdated({ ...event, status: newStatus });
    } catch {
      // ignore
    }
    setToggling(false);
  }

  async function handleExport() {
    setExporting(true);
    try {
      const attendees = (await getAttendees(event.id)).filter((a) => a.checkinDate);
      const header = 'first_name,last_name,email,checked_in,job_title,company,ticket_type,ticket_title,ticket_venue';
      const rows = attendees.map((a) =>
        [a.firstName, a.lastName, a.email, a.checkinDate ? 'true' : 'false', a.jobTitle ?? '', a.company ?? '', a.ticketType ?? '', a.ticketTitle || event.walkInTicketTitle || 'General Admission', a.ticketVenue || event.walkInTicketVenue || 'In-person']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      );
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendees-${event.id}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // the browser surfaces its own download failures
    }
    setExporting(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteEvent(event.id);
      onDeleted();
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const isOpen = event.status === 'open';

  return (
    <Box sx={{ pb: 8 }}>
      <Box sx={{ px: { xs: 2.5, md: 4 }, py: 1.75, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Everything about {event.name}, from the door to the guest list.
        </Typography>
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 4 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

        {/* Check-in status — the one control likely to be flipped mid-event, so it leads */}
        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: isOpen ? '#CEEAD6' : 'divider',
            bgcolor: isOpen ? '#E6F4EA' : 'background.paper',
            borderRadius: 3,
            p: { xs: 2.5, md: 3 },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            transition: 'background-color .2s ease, border-color .2s ease',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                flexShrink: 0,
                bgcolor: isOpen ? '#34A853' : 'grey.400',
              }}
            />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 15 }}>
                {isOpen ? 'Check-ins are open' : 'Check-ins are closed'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {isOpen
                  ? 'Anyone with the check-in link can sign themselves in.'
                  : 'The public link shows a closed message. Staff can still check people in here.'}
              </Typography>
            </Box>
          </Box>
          <Switch
            checked={isOpen}
            onChange={handleToggleStatus}
            disabled={toggling}
            color="primary"
            slotProps={{ input: { 'aria-label': 'Open check-ins' } }}
          />
        </Paper>

        <Box component="form" onSubmit={handleSave} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Section title="Event details" description="Shown to attendees on the public check-in page.">
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <TextField name="name" label="Event name" value={form.name} onChange={handleChange} fullWidth sx={{ flex: 2 }} />
                <TextField
                  name="date"
                  label="Date"
                  type="date"
                  value={form.date}
                  onChange={handleChange}
                  sx={{ flex: 1 }}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Box>
              <TextField
                name="description"
                label="Description"
                value={form.description}
                onChange={handleChange}
                multiline
                rows={3}
                fullWidth
                helperText="Optional"
              />
            </Box>
          </Section>

          <Section
            title="At the door"
            description="Applied to people added as walk-ins, and used as the fallback when exporting the CSV."
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
                <TextField
                  name="walkInTicketTitle"
                  label="Walk-in ticket title"
                  select
                  value={form.walkInTicketTitle}
                  onChange={handleChange}
                  fullWidth
                >
                  {WALK_IN_TICKET_TITLES.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  name="walkInTicketVenue"
                  label="Walk-in ticket venue"
                  select
                  value={form.walkInTicketVenue}
                  onChange={handleChange}
                  fullWidth
                >
                  {WALK_IN_TICKET_VENUES.map((v) => (
                    <MenuItem key={v} value={v}>{v}</MenuItem>
                  ))}
                </TextField>
              </Box>
              <TextField
                name="cloudCreditsUrl"
                label="Cloud credits link"
                type="url"
                value={form.cloudCreditsUrl}
                onChange={handleChange}
                fullWidth
                helperText="Optional. Shown as a button on the screen attendees see after checking in."
              />
            </Box>
          </Section>

          {/* Save bar — rides the bottom of the viewport while there is something to save */}
          {(dirty || saveError) && (
            <Box
              sx={{
                position: 'sticky',
                bottom: 16,
                zIndex: 5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: saveError ? 'error.light' : 'divider',
                borderRadius: 9999,
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                px: 2.5,
                py: 1.5,
              }}
            >
              <Typography variant="body2" color={saveError ? 'error.main' : 'text.secondary'}>
                {saveError || 'You have unsaved changes.'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  onClick={() => { setForm(initial); setSaveError(''); }}
                  disabled={saving}
                  sx={{ borderRadius: 9999, px: 2.5, color: 'text.secondary' }}
                >
                  Discard
                </Button>
                <Button type="submit" variant="contained" disabled={saving} sx={{ borderRadius: 9999, px: 3 }}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </Box>
            </Box>
          )}
          {saveSuccess && (
            <Alert
              icon={<CheckIcon fontSize="small" />}
              severity="success"
              sx={{ borderRadius: 3 }}
            >
              Changes saved.
            </Alert>
          )}
        </Box>

        <Section title="Teams" description="Teams assigned here can find this event and run check-in for it.">
          {teams.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No teams yet. Create one in Organisers, then come back to assign it.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {teams.map((team, i) => {
                const assigned = !!event.assignedTeams?.[team.id];
                return (
                  <Box
                    key={team.id}
                    component="label"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      borderTop: i === 0 ? 'none' : '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Checkbox
                      checked={assigned}
                      onChange={() =>
                        assigned
                          ? removeTeamFromEvent(event.id, team.id).then(() =>
                              onEventUpdated({ ...event, assignedTeams: { ...event.assignedTeams, [team.id]: undefined as unknown as true } })
                            )
                          : assignTeamToEvent(event.id, team.id).then(() =>
                              onEventUpdated({ ...event, assignedTeams: { ...event.assignedTeams, [team.id]: true } })
                            )
                      }
                      size="small"
                      color="primary"
                      sx={{ p: 0.5 }}
                    />
                    <Typography sx={{ fontSize: 14, fontWeight: assigned ? 700 : 400 }}>{team.name}</Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </Section>

        <Section
          title="Guest list"
          description="Load your registrations before doors open, and take the check-in record back out afterwards."
          info="In Bevy, open your event, go to the Registrations tab, click Download and choose Download CSV. Upload that file as is. Exporting gives you a CSV in the same shape — use Bulk Upload on the Registrations tab to sync it back."
          action={
            <Button
              variant="outlined"
              startIcon={exporting ? <CircularProgress size={14} color="inherit" /> : <DownloadIcon fontSize="small" />}
              onClick={handleExport}
              disabled={exporting}
              sx={{ borderRadius: 9999, px: 2.5, whiteSpace: 'nowrap', borderColor: 'divider', color: 'text.primary' }}
            >
              Export CSV
            </Button>
          }
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload the attendee CSV exported from Bevy to pre-load the guest list. Tickets already imported are updated in place, so check-ins are never lost.
          </Typography>
          <BevyImport eventId={event.id} />
        </Section>

        {/* Delete — kept quiet until asked for, so it doesn't compete with everything above */}
        <Box sx={{ px: { xs: 0.5, md: 1 }, pt: 1 }}>
          {!confirmDelete ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Deleting the event removes every attendee and check-in with it.
              </Typography>
              <Button
                onClick={() => setConfirmDelete(true)}
                sx={{ borderRadius: 9999, px: 2, color: 'error.main', '&:hover': { bgcolor: 'error.light' } }}
              >
                Delete event
              </Button>
            </Box>
          ) : (
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'error.light', borderRadius: 3, p: { xs: 2.5, md: 3 } }}>
              <Typography sx={{ fontWeight: 700, fontSize: 15, color: 'error.main' }}>
                Delete “{event.name}” for good?
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                Every attendee record and check-in for this event goes with it. Export the CSV first if you still need it.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting} sx={{ borderRadius: 9999, px: 2.5 }}>
                  {deleting ? 'Deleting…' : 'Delete event'}
                </Button>
                <Button onClick={() => setConfirmDelete(false)} sx={{ borderRadius: 9999, px: 2.5, color: 'text.secondary' }}>
                  Keep it
                </Button>
              </Box>
            </Paper>
          )}
        </Box>

      </Box>
    </Box>
  );
}
