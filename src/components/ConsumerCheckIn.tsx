import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { findAttendeeByEmail, markCheckedIn, checkInAttendee } from '../db';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import type { Attendee, GDGEvent } from '../types';
import AppLogo from './AppLogo';

interface Props {
  eventId: string;
}

type Mode = 'lookup' | 'found-pre' | 'found-duplicate' | 'walk-in';

export default function ConsumerCheckIn({ eventId }: Props) {
  const [event, setEvent] = useState<GDGEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<Mode>('lookup');
  const [foundKey, setFoundKey] = useState('');
  const [foundAttendee, setFoundAttendee] = useState<Attendee | null>(null);
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
        setFoundAttendee(result.attendee);
        setMode('found-duplicate');
      } else {
        setFoundKey(result.key);
        setFoundAttendee(result.attendee);
        setMode('found-pre');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setBusy(false);
  }

  async function handleConfirmBevy() {
    if (!foundAttendee || !foundKey) return;
    setBusy(true);
    setError('');
    try {
      const checked = await markCheckedIn(eventId, foundKey, foundAttendee);
      setSuccess(checked);
    } catch {
      setError('Check-in failed. Please try again.');
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
            <Box sx={{ bgcolor: '#fff', borderRadius: 9999, pl: 2, pr: 3, pt: 0.75, pb: 0, display: 'inline-flex', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <AppLogo />
            </Box>
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
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>Check yourself in</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>Enter your email to get started.</Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Email row — always visible */}
            <Box component="form" onSubmit={handleLookup} sx={{ display: 'flex', gap: 1 }}>
              <TextField
                type="email"
                label="Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); setMode('lookup'); }}
                size="small"
                fullWidth
                disabled={mode === 'found-pre' || mode === 'walk-in'}
              />
              {(mode === 'lookup' || mode === 'found-duplicate') && (
                <Button type="submit" variant="contained" disabled={busy} sx={{ borderRadius: 9999, whiteSpace: 'nowrap', px: 3.5, py: 0.875 }}>
                  {busy ? <CircularProgress size={20} color="inherit" /> : 'Next'}
                </Button>
              )}
            </Box>

            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

            {mode === 'found-duplicate' && foundAttendee && (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                You're already checked in as <strong>{foundAttendee.firstName} {foundAttendee.lastName}</strong>.
              </Alert>
            )}

            {/* Pre-registered */}
            {mode === 'found-pre' && foundAttendee && (
              <>
                <Alert severity="success" sx={{ borderRadius: 2 }}>
                  Welcome back, <strong>{foundAttendee.firstName}</strong>! Tap below to check in.
                </Alert>
                <Button
                  variant="contained"
                  size="large"
                  disabled={busy}
                  onClick={handleConfirmBevy}
                  fullWidth
                  sx={{ borderRadius: 9999, py: 1.5, fontWeight: 700 }}
                >
                  {busy ? <CircularProgress size={22} color="inherit" /> : 'Confirm check-in'}
                </Button>
                <Button variant="text" size="small" onClick={() => { setMode('lookup'); setEmail(''); setError(''); }} sx={{ color: 'text.secondary' }}>
                  Not you?
                </Button>
              </>
            )}

            {/* Walk-in */}
            {mode === 'walk-in' && (
              <>
                <Box component="form" onSubmit={handleWalkIn} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                    <TextField
                      label="First Name"
                      value={walkIn.firstName}
                      onChange={(e) => { setWalkIn((w) => ({ ...w, firstName: e.target.value })); setError(''); }}
                      placeholder="Jane"
                      size="small"
                      fullWidth
                    />
                    <TextField
                      label="Last Name"
                      value={walkIn.lastName}
                      onChange={(e) => { setWalkIn((w) => ({ ...w, lastName: e.target.value })); setError(''); }}
                      placeholder="Doe"
                      size="small"
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
    </Box>
  );
}
