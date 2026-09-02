import { useState, useEffect } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { QRCodeSVG } from 'qrcode.react';
import type { GDGEvent } from '../types';
import AppLogo from './AppLogo';

interface Props {
  eventId: string;
}

/** The four Google colours, as the rule across the top of the screen. */
const BRAND = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];

const screen = {
  minHeight: '100dvh',
  display: 'flex',
  flexDirection: 'column',
  bgcolor: '#fff',
  overflow: 'hidden',
};

/**
 * The kiosk screen: a check-in QR code left running on a monitor at the door.
 *
 * Everything is sized in viewport units so the same page fills a laptop propped
 * on a desk or a television across the room. It stays subscribed to the event,
 * so closing check-ins from Settings changes what the door screen says without
 * anyone touching it.
 */
export default function PublicQRDisplay({ eventId }: Props) {
  const [event, setEvent] = useState<GDGEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const checkInUrl = `${window.location.origin}${window.location.pathname}?event=${eventId}`;

  useEffect(() => {
    return onValue(
      ref(db, `events/${eventId}`),
      (snap) => {
        if (!snap.exists()) { setNotFound(true); setLoading(false); return; }
        setEvent({ id: eventId, status: 'open', ...snap.val() });
        setNotFound(false);
        setLoading(false);
      },
      () => { setNotFound(true); setLoading(false); }
    );
  }, [eventId]);

  const rule = (
    <Box sx={{ display: 'flex', height: { xs: 6, md: 10 }, flexShrink: 0 }}>
      {BRAND.map((c) => (
        <Box key={c} sx={{ flex: 1, bgcolor: c }} />
      ))}
    </Box>
  );

  const footer = (
    <Box sx={{ display: 'flex', justifyContent: 'center', pb: { xs: 3, md: 5 }, flexShrink: 0, opacity: 0.6 }}>
      <AppLogo size={22} />
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ ...screen, alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound) {
    return (
      <Box sx={screen}>
        {rule}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 4 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 'clamp(24px, 4vmin, 48px)', letterSpacing: '-0.02em' }}>
            This link doesn’t lead anywhere
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 'clamp(15px, 2vmin, 24px)', mt: 1.5 }}>
            The event may have been removed. Check the link on the dashboard.
          </Typography>
        </Box>
        {footer}
      </Box>
    );
  }

  const closed = event?.status === 'closed';

  return (
    <Box sx={screen}>
      {rule}

      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          px: { xs: 3, md: 6 },
          py: { xs: 4, md: 5 },
          gap: { xs: 3, md: '4vmin' },
        }}
      >
        <Box>
          <Typography sx={{ fontWeight: 700, fontSize: 'clamp(26px, 5vmin, 64px)', lineHeight: 1.1, letterSpacing: '-0.025em' }}>
            {event?.name}
          </Typography>
          {event?.date && (
            <Typography color="text.secondary" sx={{ fontSize: 'clamp(15px, 2.2vmin, 28px)', mt: 1 }}>
              {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </Typography>
          )}
        </Box>

        {closed ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Box
              sx={{
                width: 'clamp(72px, 14vmin, 160px)',
                height: 'clamp(72px, 14vmin, 160px)',
                borderRadius: '50%',
                bgcolor: 'grey.100',
                color: 'text.secondary',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 3,
              }}
            >
              <LockOutlinedIcon sx={{ fontSize: 'clamp(36px, 7vmin, 80px)' }} />
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: 'clamp(22px, 4vmin, 52px)', letterSpacing: '-0.02em' }}>
              Check-in is closed
            </Typography>
            <Typography color="text.secondary" sx={{ fontSize: 'clamp(15px, 2.2vmin, 28px)', mt: 1 }}>
              Find a volunteer at the door.
            </Typography>
          </Box>
        ) : (
          <>
            {/* The code scales with the screen — the SVG redraws crisply at any size */}
            <Box
              sx={{
                width: 'clamp(220px, 44vmin, 560px)',
                p: 'clamp(12px, 1.6vmin, 28px)',
                bgcolor: '#fff',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 'clamp(12px, 2vmin, 28px)',
                '& svg': { display: 'block', width: '100%', height: 'auto' },
              }}
            >
              <QRCodeSVG value={checkInUrl} size={512} level="M" marginSize={0} />
            </Box>

            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 'clamp(20px, 3.4vmin, 44px)', letterSpacing: '-0.02em' }}>
                Scan to check in
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ fontFamily: 'monospace', fontSize: 'clamp(11px, 1.5vmin, 18px)', mt: 1, wordBreak: 'break-all' }}
              >
                {checkInUrl}
              </Typography>
            </Box>
          </>
        )}
      </Box>

      {footer}
    </Box>
  );
}
