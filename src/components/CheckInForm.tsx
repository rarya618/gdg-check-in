import { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import CheckIcon from '@mui/icons-material/Check';
import { checkInAttendee, findAttendeeByEmail, markCheckedIn } from '../db';
import type { Attendee } from '../types';

interface Props {
  eventId: string;
  onCheckedIn: (attendee: Attendee) => void;
}

type Mode = 'lookup' | 'found-pre' | 'found-duplicate' | 'walk-in';

/** How many recent check-ins to keep on screen. */
const RECENT_LIMIT = 8;

function localTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** One row in the details block shown before confirming a check-in. */
function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, py: 1 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 600, fontFamily: mono ? 'monospace' : undefined, textAlign: 'right', wordBreak: 'break-all' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

/**
 * Staff check-in desk for a single event.
 *
 * Runs as a loop rather than a wizard: every check-in confirms in a banner above
 * an already-focused, already-empty email field, so the next person in the queue
 * can be looked up without touching the mouse. The last few check-ins stay listed
 * alongside as a record of what just happened.
 *
 * Modes:
 * - `lookup`          — email field; the resting state between people.
 * - `found-pre`       — email matched a pre-registered attendee; confirm to check in.
 * - `found-duplicate` — email matched someone already checked in.
 * - `walk-in`         — email is unknown; collect a name and check them in at the door.
 */
export default function CheckInForm({ eventId, onCheckedIn }: Props) {
  const [email, setEmail] = useState('');
  const [lookupKey, setLookupKey] = useState('');
  const [foundAttendee, setFoundAttendee] = useState<Attendee | null>(null);
  const [walkIn, setWalkIn] = useState({ firstName: '', lastName: '' });
  const [mode, setMode] = useState<Mode>('lookup');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [recent, setRecent] = useState<Attendee[]>([]);
  const emailRef = useRef<HTMLInputElement>(null);

  /** Returns to the resting state with the cursor back in the email field. */
  function resetToLookup() {
    setEmail('');
    setLookupKey('');
    setFoundAttendee(null);
    setWalkIn({ firstName: '', lastName: '' });
    setMode('lookup');
    setError('');
    requestAnimationFrame(() => emailRef.current?.focus());
  }

  function recordCheckIn(attendee: Attendee) {
    onCheckedIn(attendee);
    setRecent((prev) => [attendee, ...prev].slice(0, RECENT_LIMIT));
    resetToLookup();
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) { setError('Enter an email address to look up.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('That doesn’t look like an email address.'); return; }

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
      setError('Lookup failed. Check your connection and try again.');
    }
    setBusy(false);
  }

  async function handleConfirmBevy() {
    if (!foundAttendee || !lookupKey) return;
    setBusy(true);
    setError('');
    try {
      const checked = await markCheckedIn(eventId, lookupKey, foundAttendee);
      recordCheckIn(checked);
    } catch {
      setError('Check-in failed. Try again.');
    }
    setBusy(false);
  }

  async function handleWalkIn(e: React.FormEvent) {
    e.preventDefault();
    const { firstName, lastName } = walkIn;
    if (!firstName.trim() || !lastName.trim()) { setError('Both names are needed to check someone in.'); return; }
    setBusy(true);
    setError('');
    try {
      const attendee = await checkInAttendee(eventId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
      });
      recordCheckIn(attendee);
    } catch {
      setError('Check-in failed. Try again.');
    }
    setBusy(false);
  }

  const last = recent[0];

  return (
    <Box sx={{ pb: 8 }}>
      <Box sx={{ px: { xs: 2.5, md: 4 }, py: 1.75, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Check in</Typography>
        <Typography variant="body2" color="text.secondary">
          Look someone up by email. Not on the list? They go straight in as a walk-in.
        </Typography>
      </Box>

      <Box
        sx={{
          px: { xs: 2.5, md: 4 },
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          alignItems: 'flex-start',
          gap: 2.5,
        }}
      >
        {/* The desk */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            width: '100%',
            minWidth: 0,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            p: { xs: 2.5, md: 3 },
          }}
        >
          {/* Confirmation of the person just checked in — the form stays live underneath */}
          {last && mode === 'lookup' && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                bgcolor: '#E6F4EA',
                borderRadius: 2.5,
                px: 2,
                py: 1.5,
                mb: 2.5,
              }}
            >
              <Box
                sx={{
                  width: 28, height: 28, borderRadius: '50%', bgcolor: '#34A853', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}
              >
                <CheckIcon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>
                  {last.firstName} {last.lastName} is in
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                  {last.ticketNumber} at {localTime(last.checkinDate!)}
                </Typography>
              </Box>
            </Box>
          )}

          {/* Step 1 — email lookup */}
          {(mode === 'lookup' || mode === 'found-duplicate') && (
            <Box component="form" onSubmit={handleLookup} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                inputRef={emailRef}
                label="Email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); setMode('lookup'); }}
                placeholder="jane@example.com"
                autoFocus
                fullWidth
                slotProps={{ htmlInput: { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } }}
                sx={{ '& .MuiInputBase-input': { fontSize: 17, py: 1.75 } }}
              />

              {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

              {mode === 'found-duplicate' && foundAttendee && (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  <strong>{foundAttendee.firstName} {foundAttendee.lastName}</strong> already checked in at{' '}
                  {localTime(foundAttendee.checkinDate!)}. Send them through.
                </Alert>
              )}

              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={busy}
                fullWidth
                sx={{ borderRadius: 9999, py: 1.5, fontSize: 16 }}
              >
                {busy ? <CircularProgress size={22} color="inherit" /> : 'Look up'}
              </Button>
            </Box>
          )}

          {/* Step 2a — pre-registered, confirm */}
          {mode === 'found-pre' && foundAttendee && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">On the list</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1.2, mt: 0.25 }}>
                  {foundAttendee.firstName} {foundAttendee.lastName}
                </Typography>
              </Box>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, px: 2, py: 0.5 }}>
                <DetailRow label="Ticket" value={foundAttendee.ticketNumber} mono />
                <DetailRow label="Email" value={foundAttendee.email} />
                {foundAttendee.ticketTitle && <DetailRow label="Ticket type" value={foundAttendee.ticketTitle} />}
              </Box>
              {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
              <Button
                variant="contained"
                size="large"
                disabled={busy}
                onClick={handleConfirmBevy}
                fullWidth
                sx={{ borderRadius: 9999, py: 1.5, fontSize: 16 }}
              >
                {busy ? <CircularProgress size={22} color="inherit" /> : `Check in ${foundAttendee.firstName}`}
              </Button>
              <Button onClick={resetToLookup} sx={{ color: 'text.secondary', borderRadius: 9999 }}>
                Someone else
              </Button>
            </Box>
          )}

          {/* Step 2b — unknown email, take them as a walk-in */}
          {mode === 'walk-in' && (
            <Box component="form" onSubmit={handleWalkIn} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Not on the list</Typography>
                <Typography sx={{ fontWeight: 700, fontSize: 20, letterSpacing: '-0.01em', mt: 0.25 }}>
                  Add {email} as a walk-in
                </Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                <TextField
                  label="First name"
                  value={walkIn.firstName}
                  onChange={(e) => { setWalkIn((w) => ({ ...w, firstName: e.target.value })); setError(''); }}
                  placeholder="Jane"
                  autoFocus
                  fullWidth
                />
                <TextField
                  label="Last name"
                  value={walkIn.lastName}
                  onChange={(e) => { setWalkIn((w) => ({ ...w, lastName: e.target.value })); setError(''); }}
                  placeholder="Doe"
                  fullWidth
                />
              </Box>
              {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
              <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={busy}
                fullWidth
                sx={{ borderRadius: 9999, py: 1.5, fontSize: 16 }}
              >
                {busy ? <CircularProgress size={22} color="inherit" /> : 'Check in as walk-in'}
              </Button>
              <Button onClick={resetToLookup} sx={{ color: 'text.secondary', borderRadius: 9999 }}>
                Try a different email
              </Button>
            </Box>
          )}
        </Paper>

        {/* What just happened — so staff can answer "did you get me?" without leaving the tab */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            width: '100%',
            minWidth: 0,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 3,
            p: { xs: 2.5, md: 3 },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 2, mb: recent.length ? 1 : 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 15 }}>Checked in from this desk</Typography>
            {recent.length > 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {recent.length}
              </Typography>
            )}
          </Box>

          {recent.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              People you check in here will be listed as you go. The full list lives on the Dashboard.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              {recent.map((a, i) => (
                <Box
                  key={a.ticketNumber}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    py: 1.25,
                    borderTop: i === 0 ? 'none' : '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>
                      {a.firstName} {a.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }} noWrap>
                      {a.email}
                    </Typography>
                  </Box>
                  {a.source === 'walk-in' && (
                    <Typography variant="body2" sx={{ fontSize: 11.5, fontWeight: 600, color: '#137333' }}>
                      Walk-in
                    </Typography>
                  )}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}
                  >
                    {a.checkinDate ? localTime(a.checkinDate) : ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
