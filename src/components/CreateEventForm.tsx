import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { createEvent, assignTeamToEvent } from '../db';

interface Props {
  onCreated: (eventId: string) => void;
  onCancel: () => void;
  autoAssignTeamId?: string;
}

export default function CreateEventForm({ onCreated, onCancel, autoAssignTeamId }: Props) {
  const [form, setForm] = useState({
    name: '',
    date: new Date().toISOString().slice(0, 10),
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
    if (!form.name.trim()) { setError('Event name is required.'); return; }
    if (!form.date) { setError('Event date is required.'); return; }
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
      setError(err instanceof Error ? err.message : 'Failed to create event.');
      setSaving(false);
    }
  }

  return (
    <Dialog open onClose={onCancel} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { maxWidth: 360 } } }}>
      <DialogTitle sx={{ pt: 2, pb: 0.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1.5 }}>
        Event details
        <IconButton onClick={onCancel} size="small" sx={{ mr: 1, color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            name="name"
            label="Event name"
            value={form.name}
            onChange={handleChange}
            placeholder="GDG DevFest Sydney 2026"
            sx={{fontWeight: 700}}
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
            placeholder="A short description of the event"
            multiline
            rows={4}
            fullWidth
            helperText="Optional"
          />
          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, pt: 2.5, pb: 2.5, gap: 0.5 }}>
          <Button onClick={onCancel} variant="outlined" color="inherit" sx={{ px: 2.5, borderRadius: 9999, borderColor: 'divider', color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button sx={{ fontWeight: 700, px: 2.5, borderRadius: 9999 }} type="submit" variant="contained" disabled={saving}>
            {saving ? 'Creating…' : 'Create Event'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
