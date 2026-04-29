import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import Checkbox from '@mui/material/Checkbox';
import CheckIcon from '@mui/icons-material/Check';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import { updateEvent, deleteEvent, listenTeams, assignTeamToEvent, removeTeamFromEvent, getAttendees } from '../db';
import type { GDGEvent, Team } from '../types';
import BevyImport from './BevyImport';

interface Props {
  event: GDGEvent;
  onEventUpdated: (updated: GDGEvent) => void;
  onDeleted: () => void;
}

/**
 * Settings panel for a single event, composed of five independent cards:
 *
 * 1. **Event details** — editable name, date, description; saved on explicit submit.
 * 2. **Check-in status** — toggle between `open` / `closed`; takes effect immediately.
 * 3. **Teams** — checkbox list of all teams; each toggle writes directly to the database.
 * 4. **Export attendees** — one-shot CSV download of all attendees (registered + checked-in).
 * 5. **Import from Bevy** — CSV upload flow delegated to `BevyImport`.
 * 6. **Danger zone** — two-step delete confirmation; calls `onDeleted` after deletion.
 *
 * `onEventUpdated` is called whenever local state changes (name, date, status, assignedTeams)
 * so the parent (`AdminApp`) can keep its `activeEvent` in sync without re-fetching.
 */
export default function EventSettings({ event, onEventUpdated, onDeleted }: Props) {
  const [form, setForm] = useState({
    name: event.name,
    date: event.date,
    description: event.description ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toggling, setToggling] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => listenTeams(setTeams), []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setSaveSuccess(false);
    setSaveError('');
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setSaveError('Event name is required.'); return; }
    if (!form.date) { setSaveError('Date is required.'); return; }
    setSaving(true);
    setSaveError('');
    try {
      await updateEvent(event.id, {
        name: form.name.trim(),
        date: form.date,
        description: form.description.trim(),
      });
      const updated = { ...event, name: form.name.trim(), date: form.date, description: form.description.trim() || undefined };
      onEventUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      setSaveError('Failed to save changes.');
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
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2, pb: 8, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Event details */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>Event details</Typography>
        <Box component="form" onSubmit={handleSave} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5 }}>
          <TextField name="name" label="Event Name" value={form.name} onChange={handleChange} fullWidth />
          <TextField
            name="date"
            label="Date"
            type="date"
            value={form.date}
            onChange={handleChange}
            fullWidth
            slotProps={{ inputLabel: { shrink: true } }}
          />
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
          {saveError && <Alert severity="error" sx={{ borderRadius: 2 }}>{saveError}</Alert>}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              disabled={saving}
              startIcon={saveSuccess ? <CheckIcon /> : undefined}
              color={saveSuccess ? 'success' : 'primary'}
              sx={{ borderRadius: 9999, minWidth: 130, px: 2.5 }}
            >
              {saving ? 'Saving…' : saveSuccess ? 'Saved' : 'Save changes'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {/* Check-in status */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Check-in status</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {isOpen
                ? 'Check-ins are open. Attendees can register via the public link.'
                : 'Check-ins are closed. The public form will show a closed message.'}
            </Typography>
            <Chip
              label={isOpen ? 'Open' : 'Closed'}
              size="small"
              sx={{
                mt: 2.5,
                px: 0.5,
                bgcolor: isOpen ? 'secondary.light' : 'grey.100',
                color: isOpen ? 'secondary.main' : 'text.secondary',
                '& .MuiChip-label': { px: 1 },
              }}
            />
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={isOpen}
                onChange={handleToggleStatus}
                disabled={toggling}
                color="primary"
              />
            }
            label=""
            sx={{ ml: 0, mr: 0 }}
          />
        </Box>
      </Paper>

      {/* Teams */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <GroupsOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Teams</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Assign teams responsible for running this event.
        </Typography>
        {teams.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No teams yet – create teams in the Organisers section.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {teams.map((team) => {
              const assigned = !!event.assignedTeams?.[team.id];
              return (
                <FormControlLabel
                  key={team.id}
                  control={
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
                    />
                  }
                  label={<Typography variant="body2" sx={{ fontWeight: 500 }}>{team.name}</Typography>}
                  sx={{ ml: 0 }}
                />
              );
            })}
          </Box>
        )}
      </Paper>

      {/* Export CSV */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>Export attendees</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Download all attendees (registered and checked in) as a CSV.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={async () => {
            const attendees = await getAttendees(event.id);
            const header = 'first_name,last_name,email,checked_in,job_title,company,ticket_type';
            const rows = attendees.map((a) =>
              [a.firstName, a.lastName, a.email, a.checkinDate ? 'true' : 'false', a.jobTitle ?? '', a.company ?? '', a.ticketType ?? '']
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
          }}
          sx={{ borderRadius: 9999, px: 2.5 }}
        >
          Export CSV
        </Button>
      </Paper>

      {/* Bevy import */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>Import from Bevy</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Upload the attendee CSV exported from Bevy to pre-load the guest list. Already-imported tickets are skipped.
        </Typography>
        <BevyImport eventId={event.id} />
      </Paper>

      {/* Danger zone */}
      <Paper elevation={1} sx={{ p: 3, borderRadius: 2, border: '1px solid', borderColor: 'error.light' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }} color="error.main" gutterBottom>Danger zone</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Permanently delete this event and all its attendee data. This cannot be undone.
        </Typography>

        {!confirmDelete ? (
          <Button
            variant="outlined"
            color="error"
            onClick={() => setConfirmDelete(true)}
            sx={{ borderRadius: 9999, px: 2.5, mt: 1.5 }}
          >
            Delete event
          </Button>
        ) : (
          <Box>
            <Divider sx={{ mb: 2 }} />
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              Are you sure? This will permanently delete <strong>"{event.name}"</strong> and all check-in data.
            </Alert>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button
                variant="contained"
                color="error"
                onClick={handleDelete}
                disabled={deleting}
                sx={{ borderRadius: 9999, px: 2.5 }}
              >
                {deleting ? 'Deleting…' : 'Yes, delete event'}
              </Button>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => setConfirmDelete(false)}
                sx={{ borderColor: 'divider', color: 'text.secondary', borderRadius: 9999, px: 2.5 }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
