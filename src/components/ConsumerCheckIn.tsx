import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { findAttendeeByEmail, markCheckedIn, checkInAttendee, markCloudCreditsClicked } from '../db';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import type { Attendee, GDGEvent } from '../types';
import AppLogo from './AppLogo';

interface Props {
  eventId: string;
}

type Mode = 'lookup' | 'walk-in';

const pageBg = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  px: 2,
  py: 6,
  background: `
    radial-gradient(ellipse at 10% 20%, rgba(66, 133, 244, 0.25) 0%, transparent 45%),
    radial-gradient(ellipse at 90% 10%, rgba(234, 67, 53, 0.2) 0%, transparent 40%),
    radial-gradient(ellipse at 80% 90%, rgba(52, 168, 83, 0.2) 0%, transparent 45%),
    radial-gradient(ellipse at 15% 85%, rgba(251, 188, 5, 0.18) 0%, transparent 40%),
    #0D1B2A
  `,
};

export default function ConsumerCheckIn({ eventId }: Props) {
  const [event, setEvent] = useState<GDGEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<Mode>('lookup');
const [walkIn, setWalkIn] = useState({ firstName: '', lastName: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Attendee | null>(null);

  useEffect(() => {
    get(ref(db, `events/${eventId}`)).then((snap) => {
      if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
      const val = snap.val();
      setEvent({ id: eventId, status: 'open', ...val });
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [eventId]);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) { setError('Enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Please enter a valid email address.'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await findAttendeeByEmail(eventId, trimmed);
      if (!result) {
        setMode('walk-in');
      } else if (result.attendee.checkinDate) {
        setSuccess(result.attendee);
      } else {
        const checked = await markCheckedIn(eventId, result.key, result.attendee);
        setSuccess(checked);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setBusy(false);
  }

  async function handleWalkIn(e: React.FormEvent) {
    e.preventDefault();
    const { firstName, lastName } = walkIn;
    if (!firstName.trim() || !lastName.trim()) { setError('First and last name are required.'); return; }
    setBusy(true);
    setError('');
    try {
      const attendee = await checkInAttendee(eventId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      setSuccess(attendee);
    } catch {
      setError('Check-in failed. Please try again.');
    }
    setBusy(false);
  }

  if (loading) {
    return (
      <Box sx={pageBg}>
        <CircularProgress sx={{ color: 'rgba(255,255,255,0.7)' }} />
      </Box>
    );
  }

  if (notFound) {
    return (
      <Box sx={pageBg}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h3" sx={{ mb: 2 }}>🔍</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }} gutterBottom>Event not found</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
            This check-in link may be invalid or expired.
          </Typography>
        </Box>
      </Box>
    );
  }

  if (success) {
    return (
      <Box sx={pageBg}>
        <Paper elevation={4} sx={{ p: 4, width: '100%', maxWidth: 420, textAlign: 'center', borderRadius: 4 }}>
          <Box sx={{ width: 80, height: 80, borderRadius: '50%', bgcolor: 'secondary.light', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3 }}>
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="#34A853" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>You're in!</Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.2, mb: 0.5 }}>
            {success.firstName} {success.lastName}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>{success.email}</Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2, mb: 3 }}>
            Please show this screen to one of the check-in staff.
          </Typography>
          {event?.cloudCreditsUrl && (
            <Button
              variant="contained"
              size="large"
              fullWidth
              onClick={() => {
                markCloudCreditsClicked(eventId, success.email);
                window.open(event.cloudCreditsUrl, '_blank', 'noopener,noreferrer');
              }}
              sx={{ mt: 1, borderRadius: 9999, py: 1.5, fontWeight: 700, bgcolor: '#4285F4', '&:hover': { bgcolor: '#3367D6' } }}
            >
              Get Cloud Credits
            </Button>
          )}
        </Paper>
      </Box>
    );
  }

  if (event?.status === 'closed') {
    return (
      <Box sx={pageBg}>
        <Paper elevation={4} sx={{ p: 4, width: '100%', maxWidth: 360, textAlign: 'center', borderRadius: 4 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'error.light', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5 }}>
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
    <Box sx={pageBg}>
      <Paper elevation={3} sx={{ p: { xs: 3.5, md: 4.5 }, width: '100%', maxWidth: 480, borderRadius: 3 }}>
        {/* Logo */}
        <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'flex-start' }}>
          <AppLogo />
        </Box>

        {/* Event info */}
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: '-0.01em' }}>
          {event?.name}
        </Typography>
        {event?.date && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: event?.description ? 1 : 0 }}>
            {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </Typography>
        )}

        {/* Form */}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 1.5 }}>Enter your email address to get started.</Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box component="form" onSubmit={handleLookup} sx={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <TextField
              type="email"
              label="Email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); setMode('lookup'); }}
              fullWidth
              disabled={mode === 'walk-in'}
            />
            {mode !== 'walk-in' && (
              <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ borderRadius: 9999, py: 1.5, fontWeight: 700, alignSelf: 'flex-start', px: 4 }}>
                {busy ? <CircularProgress size={22} color="inherit" /> : 'Next'}
              </Button>
            )}
          </Box>

          {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

          {mode === 'walk-in' && (
            <>
              <Box component="form" onSubmit={handleWalkIn} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <TextField
                    label="First Name"
                    value={walkIn.firstName}
                    onChange={(e) => { setWalkIn((w) => ({ ...w, firstName: e.target.value })); setError(''); }}
                    placeholder="Jane"
                    fullWidth
                  />
                  <TextField
                    label="Last Name"
                    value={walkIn.lastName}
                    onChange={(e) => { setWalkIn((w) => ({ ...w, lastName: e.target.value })); setError(''); }}
                    placeholder="Doe"
                    fullWidth
                  />
                </Box>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={busy}
                  fullWidth
                  sx={{ borderRadius: 9999, py: 1.5, fontWeight: 700 }}
                >
                  {busy ? <CircularProgress size={22} color="inherit" /> : 'Check in'}
                </Button>
              </Box>
              <Button variant="text" size="small" onClick={() => { setMode('lookup'); setEmail(''); setError(''); }} sx={{ color: 'text.secondary' }}>
                Back
              </Button>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
