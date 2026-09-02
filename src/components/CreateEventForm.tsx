import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import CloseIcon from '@mui/icons-material/Close';
import { createEvent, assignTeamToEvent } from '../db';

interface Props {
  onCreated: (eventId: string) => void;
  onCancel: () => void;
  autoAssignTeamId?: string;
}

/** Today as `YYYY-MM-DD` in the viewer's own timezone, to match `GDGEvent.date`. */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Creates an event and drops you straight into it.
 *
 * Only the name and date are asked for — everything else about an event lives in
 * its settings, where it can be changed with the event in front of you.
 */
export default function CreateEventForm({ onCreated, onCancel, autoAssignTeamId }: Props) {
  const [form, setForm] = useState({
    name: '',
    date: todayKey(),
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Give the event a name.'); return; }
    if (!form.date) { setError('Pick the date it runs on.'); return; }
    setSaving(true);
    try {
      const id = await createEvent({
        name: form.name.trim(),
        date: form.date,
        description: form.description.trim() || undefined,
      });
      if (autoAssignTeamId) await assignTeamToEvent(id, autoAssignTeamId);
      onCreated(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the event. Try again.');
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { sx: { borderRadius: 4, maxWidth: 420 } } }}
    >
      <DialogTitle sx={{ fontWeight: 700, fontSize: 18, pr: 6, pt: 2.5, pb: 1.5 }}>
        Create event
        <IconButton onClick={onCancel} size="small" aria-label="Close" sx={{ position: 'absolute', right: 12, top: 14, color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Check-ins open straight away. You can import the guest list and change everything else in the event’s settings.
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
          <TextField
            name="name"
            label="Event name"
            value={form.name}
            onChange={handleChange}
            placeholder="DevFest Sydney 2026"
            fullWidth
            autoFocus
          />
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
            placeholder="Shown to attendees when they check themselves in"
            multiline
            rows={3}
            fullWidth
            helperText="Optional"
          />

          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button type="submit" variant="contained" fullWidth disabled={saving} sx={{ borderRadius: 9999, py: 1.1 }}>
              {saving ? <CircularProgress size={20} color="inherit" /> : 'Create event'}
            </Button>
            <Button onClick={onCancel} disabled={saving} sx={{ borderRadius: 9999, px: 3, color: 'text.secondary' }}>
              Cancel
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
