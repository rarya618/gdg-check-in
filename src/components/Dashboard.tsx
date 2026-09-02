import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';
import LinkIcon from '@mui/icons-material/Link';
import QrCodeIcon from '@mui/icons-material/QrCode';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import UndoIcon from '@mui/icons-material/Undo';
import { listenAttendees, findAttendeeByEmail, markCheckedIn, checkInAttendee, undoCheckIn } from '../db';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import DownloadIcon from '@mui/icons-material/Download';
import type { Attendee } from '../types';

interface Props {
  eventId: string;
  cloudCreditsUrl?: string;
  walkInTicketTitle?: string;
  walkInTicketVenue?: string;
}

/**
 * State machine for the Add Attendee dialog:
 * - `lookup`          — initial state; shows email field + "Look up" button.
 * - `found-pre`       — email matched a pre-registered, unchecked-in attendee; confirm to check in.
 * - `found-duplicate` — email matched an already checked-in attendee; shows a warning.
 * - `walk-in`         — email not found; collect first/last name for a walk-in check-in.
 * - `success`         — check-in completed; shows summary with "Add another" / "Done".
 */
type DialogMode = 'lookup' | 'found-pre' | 'found-duplicate' | 'walk-in' | 'success';

/**
 * Dialog for manually adding or checking in an attendee from the Dashboard.
 *
 * Flow:
 *   1. Staff enters an email and clicks "Look up".
 *   2. If the email is pre-registered → confirm check-in (found-pre).
 *   3. If already checked in → show duplicate warning (found-duplicate).
 *   4. If unknown → collect name and create a walk-in record (walk-in).
 *   5. On success → show confirmation with ticket details (success).
 */
function AddAttendeeDialog({ eventId, open, onClose, walkInTicketTitle, walkInTicketVenue }: { eventId: string; open: boolean; onClose: () => void; walkInTicketTitle?: string; walkInTicketVenue?: string }) {
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<DialogMode>('lookup');
  const [foundKey, setFoundKey] = useState('');
  const [foundAttendee, setFoundAttendee] = useState<Attendee | null>(null);
  const [walkIn, setWalkIn] = useState({ firstName: '', lastName: '' });
  const [success, setSuccess] = useState<Attendee | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function handleClose() {
    setEmail('');
    setMode('lookup');
    setFoundKey('');
    setFoundAttendee(null);
    setWalkIn({ firstName: '', lastName: '' });
    setSuccess(null);
    setError('');
    onClose();
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) { setError('Enter an email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Please enter a valid email.'); return; }
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
      setError('Lookup failed. Please try again.');
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
      setMode('success');
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
        ...(walkInTicketTitle ? { ticketTitle: walkInTicketTitle } : {}),
        ...(walkInTicketVenue ? { ticketVenue: walkInTicketVenue } : {}),
      });
      setSuccess(attendee);
      setMode('success');
    } catch {
      setError('Check-in failed. Please try again.');
    }
    setBusy(false);
  }

  function handleAddAnother() {
    setEmail('');
    setMode('lookup');
    setFoundKey('');
    setFoundAttendee(null);
    setWalkIn({ firstName: '', lastName: '' });
    setSuccess(null);
    setError('');
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="xs"
      slotProps={{ paper: { sx: { borderRadius: 3, maxWidth: 360 } } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pr: 6, pt: 2, pb: 1 }}>
        {mode === 'success' ? 'Checked in!' : 'Add Attendee'}
        <IconButton onClick={handleClose} size="small" sx={{ position: 'absolute', right: 12, top: 10, color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 3, display: 'flex', flexDirection: 'column' }}>
        {mode === 'success' && success ? (
          <Box sx={{ textAlign: 'center', pt: 1 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'secondary.light', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#34A853" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Welcome, {success.firstName}!</Typography>
            <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 2, mt: 2, mb: 3, textAlign: 'left' }}>
              {[
                { label: 'Ticket', value: success.ticketNumber, mono: true },
                { label: 'Name', value: `${success.firstName} ${success.lastName}` },
                { label: 'Email', value: success.email },
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
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <Button variant="contained" fullWidth onClick={handleAddAnother} sx={{ borderRadius: 9999 }}>
                Add another
              </Button>
              <Button variant="outlined" fullWidth onClick={handleClose} sx={{ borderRadius: 9999, borderColor: 'divider', color: 'text.secondary' }}>
                Done
              </Button>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
            {/* Email field — always visible */}
            <Box component="form" onSubmit={handleLookup} sx={{ display: 'flex', gap: 1 }}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); setMode('lookup'); }}
                size="small"
                fullWidth
                disabled={mode === 'found-pre' || mode === 'walk-in'}
              />
              {(mode === 'lookup' || mode === 'found-duplicate') && (
                <Button type="submit" variant="contained" disabled={busy} sx={{ borderRadius: 9999, whiteSpace: 'nowrap', px: 3.5, py: 0.875 }}>
                  {busy ? <CircularProgress size={18} color="inherit" /> : 'Look up'}
                </Button>
              )}
            </Box>

            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

            {mode === 'found-duplicate' && foundAttendee && (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                <strong>{foundAttendee.firstName} {foundAttendee.lastName}</strong> already checked in at{' '}
                {new Date(foundAttendee.checkinDate!).toUTCString()}.
              </Alert>
            )}

            {/* Pre-registered confirmation */}
            {mode === 'found-pre' && foundAttendee && (
              <>
                <Alert severity="info" sx={{ borderRadius: 2 }}>Pre-registered attendee found</Alert>
                <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 2 }}>
                  {[
                    { label: 'Ticket', value: foundAttendee.ticketNumber, mono: true },
                    { label: 'Name', value: `${foundAttendee.firstName} ${foundAttendee.lastName}` },
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
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Button variant="contained" fullWidth disabled={busy} onClick={handleConfirmBevy} sx={{ borderRadius: 9999 }}>
                    {busy ? <CircularProgress size={18} color="inherit" /> : `Check in ${foundAttendee.firstName}`}
                  </Button>
                  <Button variant="text" onClick={() => { setMode('lookup'); setEmail(''); setError(''); }} sx={{ color: 'text.secondary' }}>
                    Back
                  </Button>
                </Box>
              </>
            )}

            {/* Walk-in form */}
            {mode === 'walk-in' && (
              <>
                <Alert severity="info" sx={{ borderRadius: 2 }}>Not pre-registered, checking in as walk-in</Alert>
                <Box component="form" onSubmit={handleWalkIn} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                    <TextField
                      label="First Name"
                      size="small"
                      value={walkIn.firstName}
                      onChange={(e) => { setWalkIn((w) => ({ ...w, firstName: e.target.value })); setError(''); }}
                      fullWidth
                    />
                    <TextField
                      label="Last Name"
                      size="small"
                      value={walkIn.lastName}
                      onChange={(e) => { setWalkIn((w) => ({ ...w, lastName: e.target.value })); setError(''); }}
                      fullWidth
                    />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1.5 }}>
                    <Button type="submit" variant="contained" fullWidth disabled={busy} sx={{ borderRadius: 9999 }}>
                      {busy ? <CircularProgress size={18} color="inherit" /> : 'Check in as walk-in'}
                    </Button>
                    <Button variant="text" onClick={() => { setMode('lookup'); setEmail(''); setError(''); }} sx={{ color: 'text.secondary' }}>
                      Back
                    </Button>
                  </Box>
                </Box>
              </>
            )}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dialog that surfaces the event's public check-in URL as a QR code.
 *
 * Provides three sharing options:
 * - **Copy link** — the consumer check-in URL (`?event=<id>`).
 * - **Display URL** — the kiosk QR display URL (`?event=<id>&display=qr`).
 * - **Download PNG** — renders a hidden high-res QRCodeCanvas and exports it as a 512×512 PNG.
 */
function QRDialog({ eventId, open, onClose }: { eventId: string; open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [copiedDisplay, setCopiedDisplay] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const base = `${window.location.origin}${window.location.pathname}`;
  const checkInUrl = `${base}?event=${eventId}`;
  const displayUrl = `${base}?event=${eventId}&display=qr`;

  function handleCopy() {
    navigator.clipboard.writeText(checkInUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCopyDisplay() {
    navigator.clipboard.writeText(displayUrl).then(() => {
      setCopiedDisplay(true);
      setTimeout(() => setCopiedDisplay(false), 2000);
    });
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkin-qr-${eventId}.png`;
    a.click();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      slotProps={{ paper: { sx: { borderRadius: 3, maxWidth: 360 } } }}
    >
      <DialogTitle sx={{ fontWeight: 700, pr: 6, pt: 2, pb: 1 }}>
        Check-in QR Code
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 10, color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Box sx={{ p: 2, bgcolor: 'white', borderRadius: 2, border: '1px solid', borderColor: 'divider', display: 'inline-flex' }}>
          <QRCodeSVG value={checkInUrl} size={220} />
        </Box>
        {/* Hidden canvas used only for PNG export */}
        <Box sx={{ display: 'none' }}>
          <QRCodeCanvas ref={canvasRef} value={checkInUrl} size={512} />
        </Box>
        <Box sx={{ width: '100%', bgcolor: 'grey.50', borderRadius: 2, p: 1.5, wordBreak: 'break-all' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{checkInUrl}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, width: '100%' }}>
          <Tooltip title={copied ? 'Copied!' : 'Copy check-in link'} placement="top">
            <Button
              variant={copied ? 'contained' : 'outlined'}
              color={copied ? 'success' : 'primary'}
              startIcon={<LinkIcon fontSize="small" />}
              onClick={handleCopy}
              fullWidth
              sx={{ borderRadius: 9999, fontWeight: 700 }}
            >
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
          </Tooltip>
          <Tooltip title={copiedDisplay ? 'Copied!' : 'Copy public display URL'} placement="top">
            <Button
              variant={copiedDisplay ? 'contained' : 'outlined'}
              color={copiedDisplay ? 'success' : 'inherit'}
              startIcon={<QrCodeIcon fontSize="small" />}
              onClick={handleCopyDisplay}
              fullWidth
              sx={{ borderRadius: 9999, fontWeight: 700, color: copiedDisplay ? undefined : 'text.secondary', borderColor: 'divider' }}
            >
              {copiedDisplay ? 'Copied!' : 'Display URL'}
            </Button>
          </Tooltip>
        </Box>
        <Button
          variant="outlined"
          startIcon={<DownloadIcon fontSize="small" />}
          onClick={handleDownload}
          fullWidth
          sx={{ borderRadius: 9999, fontWeight: 700, color: 'text.secondary', borderColor: 'divider' }}
        >
          Download PNG
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Google-brand tints used to colour attendee initials, picked deterministically from the email. */
const INITIAL_TINTS: Array<[string, string]> = [
  ['#E8F0FE', '#1967D2'],
  ['#E6F4EA', '#137333'],
  ['#FEF7E0', '#B06000'],
  ['#FCE8E6', '#C5221F'],
];

function tintFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return INITIAL_TINTS[h % INITIAL_TINTS.length];
}

function initials(a: Attendee) {
  return `${a.firstName?.[0] ?? ''}${a.lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

function arrivalTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * The arrival bar: a single stacked meter showing how the room has filled.
 *
 * Segments encode where each person came from — pre-registered arrivals vs.
 * walk-ins added at the door — against the remaining unarrived registrations.
 */
function ArrivalBar({ preArrived, walkIns, awaiting }: { preArrived: number; walkIns: number; awaiting: number }) {
  const total = preArrived + walkIns + awaiting;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  const segments = [
    { key: 'pre', value: preArrived, color: '#4285F4', label: 'Pre-registered' },
    { key: 'walk', value: walkIns, color: '#34A853', label: 'Walk-ins' },
    { key: 'await', value: awaiting, color: '#DADCE0', label: 'Not arrived' },
  ];

  return (
    <Box>
      <Box
        role="img"
        aria-label={`${preArrived + walkIns} of ${total} arrived`}
        sx={{ display: 'flex', gap: '2px', height: 10, borderRadius: 9999, overflow: 'hidden', bgcolor: 'grey.100' }}
      >
        {segments.map((s) => (
          <Box
            key={s.key}
            sx={{ width: `${pct(s.value)}%`, bgcolor: s.color, transition: 'width .45s cubic-bezier(.2,.8,.2,1)' }}
          />
        ))}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: { xs: 2, sm: 3 }, mt: 1.75 }}>
        {segments.map((s) => (
          <Box key={s.key} sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color, alignSelf: 'center' }} />
            <Typography sx={{ fontWeight: 700, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>{s.value}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>{s.label}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Real-time attendee dashboard for a single event.
 *
 * Subscribes to `events/{eventId}/attendees` via `listenAttendees` and keeps
 * the table in sync without polling. The arrival bar summarises the room,
 * the filter row narrows to who still needs checking in, and rows support
 * inline check-in / undo.
 *
 * Contains two sub-dialogs:
 * - `AddAttendeeDialog` — manual lookup + check-in / walk-in flow.
 * - `QRDialog`          — share the public check-in URL / kiosk display URL.
 */
export default function Dashboard({ eventId, cloudCreditsUrl, walkInTicketTitle, walkInTicketVenue }: Props) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'awaiting' | 'arrived'>('all');
  const [loading, setLoading] = useState(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [checkingIn, setCheckingIn] = useState<string | null>(null);
  const [undoing, setUndoing] = useState<string | null>(null);

  async function handleRowCheckIn(a: Attendee) {
    setCheckingIn(a.ticketNumber);
    try {
      await markCheckedIn(eventId, a.ticketNumber, a);
    } catch { /* listener will reflect state */ }
    setCheckingIn(null);
  }

  async function handleUndo(a: Attendee) {
    setUndoing(a.ticketNumber);
    try {
      await undoCheckIn(eventId, a.email);
    } catch { /* listener will reflect state */ }
    setUndoing(null);
  }

  useEffect(() => {
    setLoading(true);
    const unsub = listenAttendees(eventId, (data) => {
      setAttendees(data);
      setLoading(false);
    });
    return unsub;
  }, [eventId]);

  const arrived = attendees.filter((a) => !!a.checkinDate);
  const walkIns = arrived.filter((a) => a.source === 'walk-in').length;
  const preArrived = arrived.length - walkIns;
  const awaiting = attendees.length - arrived.length;
  const claimed = attendees.filter((a) => !!a.cloudCreditsClickedAt).length;

  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      if (headerRef.current) {
        headerRef.current.style.borderBottom = window.scrollY > 8 ? '1px solid #e3e5e8' : '1px solid transparent';
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filtered = attendees
    .filter((a) => (filter === 'all' ? true : filter === 'arrived' ? !!a.checkinDate : !a.checkinDate))
    .filter((a) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (a.firstName ?? '').toLowerCase().includes(q) ||
        (a.lastName ?? '').toLowerCase().includes(q) ||
        (a.email ?? '').toLowerCase().includes(q) ||
        (a.ticketNumber ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  const filters: Array<{ key: typeof filter; label: string; count: number }> = [
    { key: 'all', label: 'Everyone', count: attendees.length },
    { key: 'awaiting', label: 'Not arrived', count: awaiting },
    { key: 'arrived', label: 'Arrived', count: arrived.length },
  ];

  const headCellSx = {
    fontSize: 12,
    fontWeight: 600,
    color: 'text.secondary',
    bgcolor: 'transparent',
    borderBottom: '1px solid',
    borderColor: 'divider',
    py: 1.5,
  } as const;

  return (
    <Box>
      {/* Sticky title bar — stays put so the counts and actions never scroll away */}
      <Box
        ref={headerRef}
        sx={{
          position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.default',
          px: { xs: 2.5, md: 4 }, py: 1.75, mb: 3,
          borderBottom: '1px solid transparent', transition: 'border-color .2s ease',
          display: 'flex', flexDirection: { xs: 'column', md: 'row' },
          alignItems: { md: 'center' }, justifyContent: 'space-between', gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.5, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Attendees</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
            {arrived.length} of {attendees.length} arrived
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or ticket"
            size="small"
            sx={{
              width: { xs: '100%', sm: 260 },
              '& .MuiOutlinedInput-root': { borderRadius: 9999, bgcolor: 'background.paper', pl: 1.5 },
            }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
                endAdornment: search ? (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setSearch('')} aria-label="Clear search">
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </InputAdornment>
                ) : undefined,
              },
            }}
          />
          <Button
            variant="outlined"
            startIcon={<QrCodeIcon fontSize="small" />}
            onClick={() => setQrOpen(true)}
            sx={{ borderRadius: 9999, whiteSpace: 'nowrap', px: 2.5, bgcolor: 'background.paper', borderColor: 'divider', color: 'text.primary' }}
          >
            Check-in link
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
            sx={{ borderRadius: 9999, whiteSpace: 'nowrap', px: 2.5 }}
          >
            Add attendee
          </Button>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 4 } }}>
        {/* Arrival bar — the one place this page raises its voice */}
        {!loading && attendees.length > 0 && (
          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: { xs: 2.5, md: 3 }, mb: 2.5 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: 44, lineHeight: 1, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums' }}>
                  {arrived.length}
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: 17 }}>
                  in the room
                </Typography>
              </Box>
              {cloudCreditsUrl && (
                <Typography variant="body2" color="text.secondary">
                  {claimed} claimed cloud credits
                </Typography>
              )}
            </Box>
            <ArrivalBar preArrived={preArrived} walkIns={walkIns} awaiting={awaiting} />
          </Paper>
        )}

        {loading ? (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2 }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5 }}>
                <Skeleton variant="circular" width={36} height={36} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="28%" height={16} />
                  <Skeleton width="40%" height={13} />
                </Box>
                <Skeleton variant="rounded" width={92} height={30} sx={{ borderRadius: 9999 }} />
              </Box>
            ))}
          </Paper>
        ) : attendees.length === 0 ? (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, textAlign: 'center', py: 10, px: 3 }}>
            <PeopleOutlinedIcon sx={{ fontSize: 48, color: 'primary.main', opacity: 0.35, mb: 1.5 }} />
            <Typography sx={{ fontWeight: 700 }}>Nobody has arrived yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 3, maxWidth: 380, mx: 'auto' }}>
              Import your registration list from Bevy in Settings, or share the check-in link and watch arrivals land here live.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ borderRadius: 9999, px: 2.5 }}>
                Add attendee
              </Button>
              <Button variant="outlined" startIcon={<QrCodeIcon fontSize="small" />} onClick={() => setQrOpen(true)} sx={{ borderRadius: 9999, px: 2.5, borderColor: 'divider', color: 'text.primary' }}>
                Check-in link
              </Button>
            </Box>
          </Paper>
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {filters.map((f) => {
                const active = filter === f.key;
                return (
                  <Chip
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    label={
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        {f.label}
                        <Box
                          component="span"
                          sx={{
                            fontVariantNumeric: 'tabular-nums',
                            color: active ? 'inherit' : 'text.secondary',
                            opacity: active ? 0.75 : 1,
                          }}
                        >
                          {f.count}
                        </Box>
                      </Box>
                    }
                    variant={active ? 'filled' : 'outlined'}
                    sx={{
                      height: 34, px: 0.5, fontSize: 13, cursor: 'pointer',
                      bgcolor: active ? 'primary.main' : 'background.paper',
                      color: active ? 'primary.contrastText' : 'text.primary',
                      borderColor: 'divider',
                      '&:hover': { bgcolor: active ? 'primary.dark' : 'grey.50' },
                    }}
                  />
                );
              })}
            </Box>

            {filtered.length === 0 ? (
              <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, textAlign: 'center', py: 8, px: 3 }}>
                <Typography sx={{ fontWeight: 700 }}>
                  {search ? `No one matches “${search}”` : 'Nobody in this list'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: search ? 2.5 : 0 }}>
                  {search ? 'Check the spelling, or add them as a walk-in.' : 'Switch filters to see the rest of the list.'}
                </Typography>
                {search && (
                  <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)} sx={{ borderRadius: 9999, px: 2.5 }}>
                    Add attendee
                  </Button>
                )}
              </Paper>
            ) : (
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflowX: 'auto' }}
              >
                <Table size="medium" sx={{ minWidth: 640 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...headCellSx, pl: 2.5 }}>Attendee</TableCell>
                      <TableCell sx={headCellSx}>Ticket</TableCell>
                      {cloudCreditsUrl && <TableCell sx={headCellSx}>Cloud credits</TableCell>}
                      <TableCell sx={{ ...headCellSx, width: 190, pr: 2.5 }} align="right">Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filtered.map((a) => {
                      const [bg, fg] = tintFor(a.email || a.ticketNumber);
                      const isWalkIn = a.source === 'walk-in';
                      return (
                        <TableRow
                          key={a.ticketNumber}
                          hover
                          sx={{ '&:last-of-type td': { borderBottom: 0 } }}
                        >
                          <TableCell sx={{ pl: 2.5, py: 1.5 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                              <Avatar
                                sx={{ width: 36, height: 36, bgcolor: bg, color: fg, fontSize: 13, fontWeight: 700 }}
                              >
                                {initials(a)}
                              </Avatar>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>
                                  {a.firstName} {a.lastName}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }} noWrap>
                                  {a.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell sx={{ py: 1.5 }}>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: 12.5, color: 'text.secondary' }}>
                              {a.ticketNumber}
                            </Typography>
                            {isWalkIn && (
                              <Typography variant="body2" sx={{ fontSize: 11.5, color: '#137333', fontWeight: 600 }}>
                                Walk-in
                              </Typography>
                            )}
                          </TableCell>
                          {cloudCreditsUrl && (
                            <TableCell sx={{ py: 1.5 }}>
                              {a.cloudCreditsClickedAt ? (
                                <Chip label="Claimed" size="small" sx={{ bgcolor: 'secondary.light', color: '#137333', fontWeight: 600, fontSize: 11 }} />
                              ) : (
                                <Typography variant="body2" color="text.disabled" sx={{ fontSize: 12.5 }}>—</Typography>
                              )}
                            </TableCell>
                          )}
                          <TableCell align="right" sx={{ pr: 2.5, py: 1.5 }}>
                            {a.checkinDate ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                                <Box sx={{ textAlign: 'right' }}>
                                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#137333' }}>Arrived</Typography>
                                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>
                                    {arrivalTime(a.checkinDate)}
                                  </Typography>
                                </Box>
                                <Tooltip title="Undo check-in" placement="top">
                                  <span>
                                    <IconButton
                                      size="small"
                                      disabled={undoing === a.ticketNumber}
                                      onClick={() => handleUndo(a)}
                                      aria-label={`Undo check-in for ${a.firstName} ${a.lastName}`}
                                      sx={{ color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: 'error.light' } }}
                                    >
                                      {undoing === a.ticketNumber ? <CircularProgress size={14} color="inherit" /> : <UndoIcon sx={{ fontSize: 16 }} />}
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              </Box>
                            ) : (
                              <Button
                                size="small"
                                variant="contained"
                                disableElevation
                                disabled={checkingIn === a.ticketNumber}
                                onClick={() => handleRowCheckIn(a)}
                                sx={{ borderRadius: 9999, px: 2, py: 0.5, fontSize: 12.5, whiteSpace: 'nowrap' }}
                              >
                                {checkingIn === a.ticketNumber ? <CircularProgress size={14} color="inherit" /> : 'Check in'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        <AddAttendeeDialog eventId={eventId} open={addOpen} onClose={() => setAddOpen(false)} walkInTicketTitle={walkInTicketTitle} walkInTicketVenue={walkInTicketVenue} />
        <QRDialog eventId={eventId} open={qrOpen} onClose={() => setQrOpen(false)} />
      </Box>
    </Box>
  );
}
