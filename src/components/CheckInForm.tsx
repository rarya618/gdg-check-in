import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { checkInAttendee, findAttendeeByEmail, markCheckedIn } from '../db';
import type { Attendee } from '../types';

interface Props {
  eventId: string;
  onCheckedIn: (attendee: Attendee) => void;
}

type Mode = 'lookup' | 'found-pre' | 'found-duplicate' | 'walk-in';

export default function CheckInForm({ eventId, onCheckedIn }: Props) {
  const [email, setEmail] = useState('');
  const [lookupKey, setLookupKey] = useState('');
  const [foundAttendee, setFoundAttendee] = useState<Attendee | null>(null);
  const [walkIn, setWalkIn] = useState({ firstName: '', lastName: '' });
  const [mode, setMode] = useState<Mode>('lookup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<Attendee | null>(null);

  function handleReset() {
    setEmail('');
    setLookupKey('');
    setFoundAttendee(null);
    setWalkIn({ firstName: '', lastName: '' });
    setMode('lookup');
    setError('');
    setSuccess(null);
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) { setError('Enter an email address.'); return; }
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
        setLookupKey(result.key);
        setFoundAttendee(result.attendee);
        setMode('found-pre');
      }
    } catch {
      setError('Lookup failed. Please try again.');
    }
    setBusy(false);
  }

  async function handleConfirmBevy() {
    if (!foundAttendee || !lookupKey) return;
    setBusy(true);
    setError('');
    try {
      const checked = await markCheckedIn(eventId, lookupKey, foundAttendee);
      onCheckedIn(checked);
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
      onCheckedIn(attendee);
      setSuccess(attendee);
    } catch {
      setError('Check-in failed. Please try again.');
    }
    setBusy(false);
  }

  if (success) {
    return (
      <Box sx={{ maxWidth: 440, mx: 'auto', mt: 4, px: 2 }}>
        <Paper elevation={1} sx={{ p: 4, textAlign: 'center', borderRadius: 4 }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: 'secondary.light', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5 }}>
            <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#34A853" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>Checked in!</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Welcome, {success.firstName}!</Typography>

          <Box sx={{ bgcolor: 'grey.50', borderRadius: 2.5, p: 2.5, mb: 3, textAlign: 'left' }}>
            {[
              { label: 'Ticket', value: success.ticketNumber, mono: true, color: 'primary.main' },
              { label: 'Name', value: `${success.firstName} ${success.lastName}` },
              { label: 'Email', value: success.email },
              { label: 'Time', value: new Date(success.checkinDate!).toUTCString() },
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
        <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Check In Attendee</Typography>

        {/* Step 1: email lookup */}
        {(mode === 'lookup' || mode === 'found-duplicate') && (
          <Box component="form" onSubmit={handleLookup} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1.5 }}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); setMode('lookup'); }}
              placeholder="jane@example.com"
              fullWidth
            />
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

            {mode === 'found-duplicate' && foundAttendee && (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                <strong>{foundAttendee.firstName} {foundAttendee.lastName}</strong> was already checked in at{' '}
                {new Date(foundAttendee.checkinDate!).toUTCString()}.
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy}
              fullWidth
              sx={{ mt: 2, fontWeight: 700, borderRadius: 9999, py: 1.25 }}
            >
              {busy ? <CircularProgress size={22} color="inherit" /> : 'Look up'}
            </Button>
          </Box>
        )}

        {/* Step 2a: found pre-registered Bevy attendee */}
        {mode === 'found-pre' && foundAttendee && (
          <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Found pre-registered attendee
            </Alert>
            <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 2 }}>
              {[
                { label: 'Ticket', value: foundAttendee.ticketNumber, mono: true },
                { label: 'Name', value: `${foundAttendee.firstName} ${foundAttendee.lastName}` },
                { label: 'Email', value: foundAttendee.email },
              ].map((row, i) => (
                <Box key={row.label}>
                  {i > 0 && <Divider sx={{ my: 1, borderColor: 'grey.100' }} />}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" color="text.secondary">{row.label}</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: row.mono ? 'monospace' : undefined }}>
                      {row.value}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            <Button
              variant="contained"
              size="large"
              disabled={busy}
              onClick={handleConfirmBevy}
              fullWidth
              sx={{ fontWeight: 700, borderRadius: 9999, py: 1.25 }}
            >
              {busy ? <CircularProgress size={22} color="inherit" /> : `Check in ${foundAttendee.firstName}`}
            </Button>
            <Button variant="text" size="small" onClick={handleReset} sx={{ color: 'text.secondary' }}>
              Check in a different person
            </Button>
          </Box>
        )}

        {/* Step 2b: not found — walk-in form */}
        {mode === 'walk-in' && (
          <Box component="form" onSubmit={handleWalkIn} sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              Not pre-registered, checking in as walk-in
            </Alert>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
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
            <TextField label="Email" type="email" value={email} disabled fullWidth />
            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={busy}
              fullWidth
              sx={{ mt: 2, fontWeight: 700, borderRadius: 9999, py: 1.25 }}
            >
              {busy ? <CircularProgress size={22} color="inherit" /> : 'Check in as walk-in'}
            </Button>
            <Button variant="text" size="small" onClick={handleReset} sx={{ color: 'text.secondary' }}>
              Back
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
