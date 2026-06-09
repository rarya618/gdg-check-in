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
import { listenAttendees, findAttendeeByEmail, markCheckedIn, checkInAttendee, undoCheckIn } from '../db';
import Chip from '@mui/material/Chip';
import Tooltip from '@mui/material/Tooltip';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import DownloadIcon from '@mui/icons-material/Download';
import type { Attendee } from '../types';

interface Props {
  eventId: string;
  cloudCreditsUrl?: string;
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
function AddAttendeeDialog({ eventId, open, onClose }: { eventId: string; open: boolean; onClose: () => void }) {
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

/**
 * Real-time attendee dashboard for a single event.
 *
 * Subscribes to `events/{eventId}/attendees` via `listenAttendees` and keeps
 * the table in sync without polling. Displays a checked-in count badge and
 * supports inline check-in / undo directly from the table rows.
 *
 * Contains two sub-dialogs:
 * - `AddAttendeeDialog` — manual lookup + check-in / walk-in flow.
 * - `QRDialog`          — share the public check-in URL / kiosk display URL.
 */
export default function Dashboard({ eventId, cloudCreditsUrl }: Props) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [search, setSearch] = useState('');
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

  const checkedInCount = attendees.filter((a) => !!a.checkinDate).length;

  const titleRef = useRef<HTMLSpanElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      const shrunk = window.scrollY > 10;
      if (titleRef.current) titleRef.current.style.fontSize = shrunk ? '1.25rem' : '2.125rem';
      if (headerRef.current) headerRef.current.style.borderBottom = shrunk ? '1px solid var(--mui-palette-divider, #e0e0e0)' : 'none';
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const filtered = attendees
    .filter((a) => {
      const q = search.toLowerCase();
      return (
        (a.firstName ?? '').toLowerCase().includes(q) ||
        (a.lastName ?? '').toLowerCase().includes(q) ||
        (a.email ?? '').toLowerCase().includes(q) ||
        (a.ticketNumber ?? '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  return (
    <Box>
      <Box ref={headerRef} sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.default', px: 4, pt: 1.25, pb: 1.25, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Box>
          <Typography ref={titleRef} variant="h4" sx={{ fontWeight: 700, ml: 0.5, fontSize: '2.125rem', transition: 'font-size 0.25s ease' }}>Attendees</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ ml: 0.5 }}>
            {checkedInCount} / {attendees.length} checked in
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search attendees…"
            size="small"
            sx={{ width: { xs: '100%', sm: 220 }, '& .MuiOutlinedInput-root': { borderRadius: 9999, px: 2 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setAddOpen(true)}
            sx={{ borderRadius: 9999, whiteSpace: 'nowrap', px: 2.5, fontWeight: 700 }}
          >
            Add
          </Button>
          <Button
            variant="outlined"
            startIcon={<QrCodeIcon fontSize="small" />}
            onClick={() => setQrOpen(true)}
            sx={{ borderRadius: 9999, whiteSpace: 'nowrap', px: 2.5, fontWeight: 700 }}
          >
            Check-in link
          </Button>
        </Box>
      </Box>

      <Box sx={{ px: 4 }}>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      ) : attendees.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 12, color: 'text.secondary' }}>
          <PeopleOutlinedIcon sx={{ fontSize: 56, opacity: 0.3, mb: 1.5 }} />
          <Typography variant="body1" sx={{ fontWeight: 500 }}>No attendees yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Import from Bevy in Settings, or check-ins will appear here in real time.
          </Typography>
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10, color: 'text.secondary' }}>
          <Typography>No results for "{search}"</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2, overflowX: 'auto' }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell>First Name</TableCell>
                <TableCell>Last Name</TableCell>
                <TableCell>Email</TableCell>
                {cloudCreditsUrl && <TableCell>Cloud Credits</TableCell>}
                <TableCell sx={{ width: 120 }} />
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.ticketNumber} hover>
                  <TableCell>{a.firstName}</TableCell>
                  <TableCell>{a.lastName}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{a.email}</TableCell>
                  {cloudCreditsUrl && (
                    <TableCell>
                      {a.cloudCreditsClickedAt ? (
                        <Chip label="Claimed" size="small" sx={{ bgcolor: 'secondary.light', color: 'secondary.dark', fontWeight: 600, fontSize: 11 }} />
                      ) : (
                        <Typography variant="body2" color="text.disabled" sx={{ fontSize: 12 }}>Not claimed</Typography>
                      )}
                    </TableCell>
                  )}
                  <TableCell align="right">
                    {a.checkinDate ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        <Chip label="Checked in" size="small" sx={{ bgcolor: 'secondary.light', color: 'secondary.dark', fontWeight: 600, fontSize: 11 }} />
                        <Button
                          size="small"
                          variant="text"
                          disabled={undoing === a.ticketNumber}
                          onClick={() => handleUndo(a)}
                          sx={{ fontSize: 11, color: 'text.disabled', minWidth: 0, px: 0.5, '&:hover': { color: 'error.main' } }}
                        >
                          {undoing === a.ticketNumber ? <CircularProgress size={12} color="inherit" /> : 'Undo'}
                        </Button>
                      </Box>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        disabled={checkingIn === a.ticketNumber}
                        onClick={() => handleRowCheckIn(a)}
                        sx={{ borderRadius: 9999, px: 2, py: 0.5, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        {checkingIn === a.ticketNumber ? <CircularProgress size={14} color="inherit" /> : 'Check in'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <AddAttendeeDialog eventId={eventId} open={addOpen} onClose={() => setAddOpen(false)} />
      <QRDialog eventId={eventId} open={qrOpen} onClose={() => setQrOpen(false)} />
      </Box>
    </Box>
  );
}
