import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { QRCodeSVG } from 'qrcode.react';
import type { GDGEvent } from '../types';
import AppLogo from './AppLogo';

interface Props {
  eventId: string;
}

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

export default function PublicQRDisplay({ eventId }: Props) {
  const [event, setEvent] = useState<GDGEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const checkInUrl = `${window.location.origin}${window.location.pathname}?event=${eventId}`;

  useEffect(() => {
    get(ref(db, `events/${eventId}`)).then((snap) => {
      if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
      setEvent({ id: eventId, status: 'open', ...snap.val() });
      setLoading(false);
    }).catch(() => { setNotFound(true); setLoading(false); });
  }, [eventId]);

  if (loading) {
    return <Box sx={pageBg}><CircularProgress sx={{ color: 'rgba(255,255,255,0.7)' }} /></Box>;
  }

  if (notFound) {
    return (
      <Box sx={pageBg}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h3" sx={{ mb: 2 }}>🔍</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#fff' }} gutterBottom>Event not found</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>This check-in link may be invalid or expired.</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={pageBg}>
      <Paper elevation={3} sx={{ p: { xs: 3.5, md: 4.5 }, width: '100%', maxWidth: 480, borderRadius: 3, textAlign: 'center' }}>
        <Box sx={{ mb: 0.5, display: 'flex', justifyContent: 'flex-start' }}>
          <AppLogo />
        </Box>

        <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5, letterSpacing: '-0.01em', textAlign: 'left' }}>
          {event?.name}
        </Typography>
        {event?.date && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: event?.description ? 1 : 0, textAlign: 'left' }}>
            {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </Typography>
        )}
        {event?.description && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'left' }}>
            {event.description}
          </Typography>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, mt: 3 }}>
          <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 3, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', display: 'inline-flex', border: '1px solid', borderColor: 'divider' }}>
            <QRCodeSVG value={checkInUrl} size={240} marginSize={1} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Scan to check in
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
