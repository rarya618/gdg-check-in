import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { checkInAttendee, isEmailRegistered } from '../db';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import type { Attendee, GDGEvent } from '../types';

interface Props {
  eventId: string;
}

function GDGIcon({ size = 56 }: { size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        bgcolor: '#fff',
        borderRadius: 2.5,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '4px',
        p: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
      }}
    >
      <Box sx={{ bgcolor: '#4285F4', borderRadius: '3px' }} />
      <Box sx={{ bgcolor: '#EA4335', borderRadius: '3px' }} />
      <Box sx={{ bgcolor: '#FBBC05', borderRadius: '3px' }} />
      <Box sx={{ bgcolor: '#34A853', borderRadius: '3px' }} />
    </Box>
  );
}

export default function ConsumerCheckIn({ eventId }: Props) {
  const [event, setEvent] = useState<GDGEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<Attendee | null>(null);

  useEffect(() => {
    get(ref(db, `events/${eventId}`)).then((snap) => {
      if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
      const val = snap.val();
      setEvent({ id: eventId, status: 'open', ...val });
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [eventId]);

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
      setSuccess(attendee);
    } catch {
      setError('Check-in failed. Please try again.');
    }
    setSaving(false);
  }

  const bgSx = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    px: 2,
    py: 6,
    background: 'linear-gradient(135deg, #E8F0FE 0%, #FCE8E6 50%, #FEF7E0 100%)',
  };

  if (loading) {
    return (
      <Box sx={bgSx}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (notFound) {
    return (
      <Box sx={bgSx}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h3" sx={{ mb: 2 }}>🔍</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Event not found</Typography>
          <Typography variant="body2" color="text.secondary">
            This check-in link may be invalid or expired.
          </Typography>
        </Box>
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={bgSx}>
        <Paper elevation={4} sx={{ p: 4, width: '100%', maxWidth: 380, textAlign: 'center', borderRadius: 4 }}>
          <Box
            sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'secondary.light', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}
          >
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#34A853" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>You're in!</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            See you at {event?.name}
          </Typography>

          <Box sx={{ bgcolor: 'grey.50', borderRadius: 3, p: 2.5, textAlign: 'left' }}>
            {[
              { label: 'Ticket', value: success.ticketNumber, mono: true, color: '#4285F4' },
              { label: 'Name', value: `${success.firstName} ${success.lastName}` },
              { label: 'Email', value: success.email },
            ].map((row, i) => (
              <Box key={row.label}>
                {i > 0 && <Divider sx={{ my: 1.5, borderColor: 'grey.100' }} />}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: row.mono ? 700 : 500, fontFamily: row.mono ? 'monospace' : undefined, fontSize: row.mono ? 15 : undefined }}
                    color={row.color ?? 'text.primary'}
                  >
                    {row.value}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    );
  }

  if (event?.status === 'closed') {
    return (
      <Box sx={bgSx}>
        <Paper elevation={4} sx={{ p: 4, width: '100%', maxWidth: 360, textAlign: 'center', borderRadius: 4 }}>
          <Box
            sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'error.light', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5 }}
          >
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#EA4335" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Check-ins are closed</Typography>
          <Typography variant="body2" color="text.secondary">
            This event is no longer accepting registrations.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={bgSx}>
      <Box sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        width: '100%',
        maxWidth: 960,
        mx: 'auto',
        gap: { xs: 4, md: 8 },
        alignItems: { md: 'center' },
      }}>
        <Box sx={{ textAlign: 'left', flex: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'left', mb: 2.5 }}>
            <GDGIcon size={56} />
          </Box>
          <Typography variant="h4" sx={{ fontWeight: 700, fontSize: { xs: '1.75rem', md: '2.125rem' } }}>{event?.name}</Typography>
          {event?.date && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.75 }}>
              {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              })}
            </Typography>
          )}
          {event?.description && (
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>{event.description}</Typography>
          )}
        </Box>

        <Paper elevation={1} sx={{ p: 3.5, pb: 4, width: '100%', maxWidth: { xs: '100%', md: 420 }, borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0 }}>Check yourself in</Typography>
          <Typography variant="body2">For those who are not registered for the event</Typography>
          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              <TextField name="firstName" label="First Name" value={form.firstName} onChange={handleChange} placeholder="Jane" fullWidth />
              <TextField name="lastName" label="Last Name" value={form.lastName} onChange={handleChange} placeholder="Doe" fullWidth />
            </Box>
            <TextField name="email" type="email" label="Email" value={form.email} onChange={handleChange} placeholder="jane@example.com" fullWidth />

            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={saving}
              fullWidth
              sx={{ borderRadius: 9999, py: 1.5, mt: 4, px: 2.5 }}
            >
              {saving ? 'Checking in…' : 'Check In'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}
