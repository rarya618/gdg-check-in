import { useState, useEffect } from 'react';
import { ref, get } from 'firebase/database';
import { db } from '../firebase';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import { QRCodeSVG } from 'qrcode.react';
import type { GDGEvent } from '../types';
import AppLogo from './AppLogo';

interface Props {
  eventId: string;
}

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

  const bg = {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #E8F0FE 0%, #FCE8E6 50%, #FEF7E0 100%)',
  };

  if (loading) {
    return <Box sx={bg}><CircularProgress color="primary" /></Box>;
  }

  if (notFound) {
    return (
      <Box sx={bg}>
        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="h3" sx={{ mb: 2 }}>🔍</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Event not found</Typography>
          <Typography variant="body2" color="text.secondary">This check-in link may be invalid or expired.</Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ ...bg, flexDirection: 'column', gap: 5, px: 4, py: 6, textAlign: 'center' }}>
      <Box sx={{ bgcolor: '#fff', borderRadius: 9999, pl: 2, pr: 3, pt: 0.75, pb: 0, display: 'inline-flex', alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <AppLogo />
      </Box>

      <Box>
        <Typography variant="h3" sx={{ fontWeight: 700, fontSize: { xs: '1.75rem', md: '2.75rem' }, lineHeight: 1.2 }}>
          {event?.name}
        </Typography>
        {event?.date && (
          <Typography variant="h6" color="text.secondary" sx={{ mt: 1, fontWeight: 400 }}>
            {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <Box sx={{ p: 1.5, bgcolor: 'white', borderRadius: 4, boxShadow: '0 4px 32px rgba(0,0,0,0.10)', display: 'inline-flex' }}>
          <QRCodeSVG value={checkInUrl} size={280} marginSize={1} />
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Scan to check in
        </Typography>
      </Box>
    </Box>
  );
}
