import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import { findAttendeeByEmail, findAttendeeInAnyEvent, markCheckedIn, checkInAttendee, markCloudCreditsClicked } from '../db';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import CheckIcon from '@mui/icons-material/Check';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { Attendee, GDGEvent } from '../types';
import AppLogo from './AppLogo';

interface Props {
  eventId: string;
}

type Mode = 'lookup' | 'walk-in';

/** The four Google colours, as the rule across the top of the card. */
const BRAND = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];

const page = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  bgcolor: '#F1F3F4',
  px: 2,
  py: 5,
};

const card = {
  width: '100%',
  maxWidth: 400,
  borderRadius: 4,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

/** The brand rule that tops every card on this screen. */
function BrandRule() {
  return (
    <Box sx={{ display: 'flex', height: 5 }}>
      {BRAND.map((c) => (
        <Box key={c} sx={{ flex: 1, bgcolor: c }} />
      ))}
    </Box>
  );
}

function localTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * The screen an attendee gets on their own phone, from the QR code or link.
 *
 * One question — their email — decides everything: a pre-registered address is
 * checked in on the spot, an unknown one collects a name and goes in as a
 * walk-in. The result screen is built to be held up to a staff member, so the
 * name and ticket are the largest things on it.
 */
export default function ConsumerCheckIn({ eventId }: Props) {
  const [event, setEvent] = useState<GDGEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<Mode>('lookup');
  const [walkIn, setWalkIn] = useState({ firstName: '', lastName: '' });
  const [autofilled, setAutofilled] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Attendee | null>(null);
  const [alreadyIn, setAlreadyIn] = useState(false);
  const [creditsClaimed, setCreditsClaimed] = useState(false);

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
    if (!trimmed) { setError('Enter your email address to check in.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('That doesn’t look like an email address.'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await findAttendeeByEmail(eventId, trimmed);
      if (!result) {
        const past = await findAttendeeInAnyEvent(trimmed, eventId);
        if (past) {
          setWalkIn({ firstName: past.firstName, lastName: past.lastName });
          setAutofilled(true);
        }
        setMode('walk-in');
      } else if (result.attendee.checkinDate) {
        setAlreadyIn(true);
        setSuccess(result.attendee);
      } else {
        const checked = await markCheckedIn(eventId, result.key, result.attendee);
        setSuccess(checked);
      }
    } catch {
      setError('Something went wrong. Try again in a moment.');
    }
    setBusy(false);
  }

  async function handleWalkIn(e: React.FormEvent) {
    e.preventDefault();
    const { firstName, lastName } = walkIn;
    if (!firstName.trim() || !lastName.trim()) { setError('We need both names to check you in.'); return; }
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
      setError('Check-in failed. Try again in a moment.');
    }
    setBusy(false);
  }

  if (loading) {
    return (
      <Box sx={page}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound) {
    return (
      <Box sx={page}>
        <Paper elevation={0} sx={card}>
          <BrandRule />
          <Box sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
            <Typography sx={{ fontWeight: 700, fontSize: 20 }}>This link doesn’t lead anywhere</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              The event may have been removed, or the link was copied incompletely. Ask a volunteer for the current QR code.
            </Typography>
          </Box>
        </Paper>
      </Box>
    );
  }

  // Held up to a staff member at the door, so name and ticket lead.
  if (success) {
    return (
      <Box sx={page}>
        <Paper elevation={0} sx={card}>
          <BrandRule />
          <Box sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
            <Box
              sx={{
                width: 64, height: 64, borderRadius: '50%', bgcolor: '#E6F4EA', color: '#34A853',
                display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5,
              }}
            >
              <CheckIcon sx={{ fontSize: 36 }} />
            </Box>

            <Typography variant="body2" color="text.secondary">
              {alreadyIn ? `Already checked in at ${localTime(success.checkinDate!)}` : 'You’re checked in'}
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: 30, lineHeight: 1.15, letterSpacing: '-0.02em', mt: 0.5 }}>
              {success.firstName} {success.lastName}
            </Typography>
            <Typography sx={{ fontFamily: 'monospace', fontSize: 14, color: 'text.secondary', mt: 1 }}>
              {success.ticketNumber}
            </Typography>

            <Box sx={{ bgcolor: 'grey.50', borderRadius: 2.5, px: 2, py: 1.5, mt: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Show this screen to a volunteer at the door.
              </Typography>
            </Box>

            {event?.cloudCreditsUrl && (
              <Button
                variant="contained"
                fullWidth
                endIcon={<OpenInNewIcon sx={{ fontSize: 18 }} />}
                onClick={() => {
                  markCloudCreditsClicked(eventId, success.email);
                  setCreditsClaimed(true);
                  window.open(event.cloudCreditsUrl, '_blank', 'noopener,noreferrer');
                }}
                sx={{ mt: 2.5, borderRadius: 9999, py: 1.4, fontSize: 16 }}
              >
                {creditsClaimed ? 'Open cloud credits again' : 'Claim your cloud credits'}
              </Button>
            )}
          </Box>
        </Paper>
      </Box>
    );
  }

  if (event?.status === 'closed') {
    return (
      <Box sx={page}>
        <Paper elevation={0} sx={card}>
          <BrandRule />
          <Box sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
            <Box
              sx={{
                width: 56, height: 56, borderRadius: '50%', bgcolor: 'grey.100', color: 'text.secondary',
                display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5,
              }}
            >
              <LockOutlinedIcon sx={{ fontSize: 28 }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 20 }}>Check-in is closed</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {event.name} isn’t taking check-ins right now. If you’re at the door, a volunteer can still check you in.
            </Typography>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={page}>
      <Paper elevation={0} sx={card}>
        <BrandRule />
        <Box sx={{ p: { xs: 3, sm: 4 } }}>
          <Box sx={{ ml: -1.5, mb: 2.5 }}>
            <AppLogo size={20} />
          </Box>

          <Typography sx={{ fontWeight: 700, fontSize: 22, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
            {event?.name}
          </Typography>
          {event?.date && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </Typography>
          )}

          {mode === 'lookup' ? (
            <Box component="form" onSubmit={handleLookup} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3.5 }}>
              <TextField
                type="email"
                label="Your email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                placeholder="you@example.com"
                fullWidth
                autoFocus
                slotProps={{
                  htmlInput: { inputMode: 'email', autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false, autoComplete: 'email' },
                }}
                sx={{ '& .MuiInputBase-input': { fontSize: 17, py: 1.75 } }}
              />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, mt: -0.5 }}>
                Use the address you registered with. Not registered? You can still come in.
              </Typography>

              {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={busy}
                sx={{ borderRadius: 9999, py: 1.5, fontSize: 16, mt: 0.5 }}
              >
                {busy ? <CircularProgress size={22} color="inherit" /> : 'Check me in'}
              </Button>
            </Box>
          ) : (
            <Box component="form" onSubmit={handleWalkIn} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3.5 }}>
              <Box>
                <Typography sx={{ fontWeight: 700, fontSize: 16 }}>
                  {autofilled ? 'Is this still you?' : 'You’re not on the list — that’s fine'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {autofilled
                    ? `We recognise ${email.trim()} from a previous event. Check the details and you’re in.`
                    : `Tell us your name and we’ll check you in as a walk-in.`}
                </Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                <TextField
                  label="First name"
                  value={walkIn.firstName}
                  onChange={(e) => { setWalkIn((w) => ({ ...w, firstName: e.target.value })); setError(''); setAutofilled(false); }}
                  placeholder="Jane"
                  fullWidth
                  autoFocus={!autofilled}
                />
                <TextField
                  label="Last name"
                  value={walkIn.lastName}
                  onChange={(e) => { setWalkIn((w) => ({ ...w, lastName: e.target.value })); setError(''); setAutofilled(false); }}
                  placeholder="Doe"
                  fullWidth
                />
              </Box>

              {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

              <Button
                type="submit"
                variant="contained"
                fullWidth
                disabled={busy}
                sx={{ borderRadius: 9999, py: 1.5, fontSize: 16 }}
              >
                {busy ? <CircularProgress size={22} color="inherit" /> : 'Check me in'}
              </Button>
              <Button
                onClick={() => { setMode('lookup'); setWalkIn({ firstName: '', lastName: '' }); setAutofilled(false); setError(''); }}
                sx={{ color: 'text.secondary', borderRadius: 9999 }}
              >
                Use a different email
              </Button>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
