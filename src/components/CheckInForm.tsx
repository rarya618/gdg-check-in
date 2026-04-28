import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { checkInAttendee, isEmailRegistered } from '../db';
import type { Attendee } from '../types';

interface Props {
  eventId: string;
  onCheckedIn: (attendee: Attendee) => void;
}

export default function CheckInForm({ eventId, onCheckedIn }: Props) {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<Attendee | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { firstName, lastName, email } = form;
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError('All fields are required.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    setSaving(true);
    try {
      if (await isEmailRegistered(eventId, email)) {
        setError('This email has already been checked in.');
        setSaving(false);
        return;
      }
      const attendee = await checkInAttendee(eventId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      onCheckedIn(attendee);
      setSuccess(attendee);
      setForm({ firstName: '', lastName: '', email: '' });
    } catch {
      setError('Check-in failed. Please try again.');
    }
    setSaving(false);
  }

  function handleReset() {
    setSuccess(null);
    setError('');
  }

  if (success) {
    return (
      <Box sx={{ maxWidth: 440, mx: 'auto', mt: 4, px: 2 }}>
        <Paper elevation={1} sx={{ p: 4, textAlign: 'center', borderRadius: 4 }}>
          <Box
            sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'secondary.light', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5 }}
          >
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#34A853" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>You're checked in!</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Welcome, {success.firstName}!</Typography>

          <Box sx={{ bgcolor: 'grey.50', borderRadius: 2.5, p: 2.5, mb: 3, textAlign: 'left' }}>
            {[
              { label: 'Ticket', value: success.ticketNumber, mono: true, color: 'primary.main' },
              { label: 'Name', value: `${success.firstName} ${success.lastName}` },
              { label: 'Email', value: success.email },
              { label: 'Time', value: new Date(success.checkinDate).toUTCString() },
            ].map((row, i) => (
              <Box key={row.label}>
                {i > 0 && <Divider sx={{ my: 1.25, borderColor: 'grey.100' }} />}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: row.mono ? 700 : 500, fontFamily: row.mono ? 'monospace' : undefined }}
                    color={row.color ?? 'text.primary'}
                  >
                    {row.value}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>

          <Button fullWidth variant="contained" size="large" onClick={handleReset} sx={{ borderRadius: 9999, px: 2.5 }}>
            Check in another attendee
          </Button>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 440, mx: 'auto', mt: 4, px: 2 }}>
      <Paper elevation={1} sx={{ p: 3.5, pb: 4, borderRadius: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Event Check-In</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Fill in your details to check in to the event.
        </Typography>

        <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            <TextField
              name="firstName"
              label="First Name"
              value={form.firstName}
              onChange={handleChange}
              placeholder="Jane"
              fullWidth
            />
            <TextField
              name="lastName"
              label="Last Name"
              value={form.lastName}
              onChange={handleChange}
              placeholder="Doe"
              fullWidth
            />
          </Box>
          <TextField
            name="email"
            type="email"
            label="Email"
            value={form.email}
            onChange={handleChange}
            placeholder="jane@example.com"
            fullWidth
          />

          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={saving}
            fullWidth
            sx={{ mt: 4, fontWeight: 700, borderRadius: 9999, py: 1.25, px: 2.5 }}
          >
            {saving ? 'Checking in…' : 'Check In'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
