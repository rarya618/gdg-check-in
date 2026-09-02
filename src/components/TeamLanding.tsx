import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import EventBusyOutlinedIcon from '@mui/icons-material/EventBusyOutlined';
import { findTeamByHandle, listenEvents, pickLiveEventForTeam } from '../db';
import type { GDGEvent, Team } from '../types';
import ConsumerCheckIn from './ConsumerCheckIn';
import PublicQRDisplay from './PublicQRDisplay';
import AppLogo from './AppLogo';

interface Props {
  /** The `?team=` value from the URL — a slug, or a raw team ID for older links. */
  handle: string;
  /** True for `&display=qr`: render the kiosk screen instead of the attendee form. */
  display: boolean;
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

const card = {
  width: '100%',
  maxWidth: 400,
  borderRadius: 4,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

function BrandRule({ tall }: { tall?: boolean }) {
  return (
    <Box sx={{ display: 'flex', height: tall ? { xs: 6, md: 10 } : 5, flexShrink: 0 }}>
      {BRAND.map((c) => (
        <Box key={c} sx={{ flex: 1, bgcolor: c }} />
      ))}
    </Box>
  );
}

/** Kiosk-sized message, matching the door screen's proportions. */
function KioskMessage({ title, body, icon }: { title: string; body: string; icon?: boolean }) {
  return (
    <Box sx={screen}>
      <BrandRule tall />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 4 }}>
        {icon && (
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
            <EventBusyOutlinedIcon sx={{ fontSize: 'clamp(36px, 7vmin, 80px)' }} />
          </Box>
        )}
        <Typography sx={{ fontWeight: 700, fontSize: 'clamp(24px, 4.5vmin, 56px)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
          {title}
        </Typography>
        <Typography color="text.secondary" sx={{ fontSize: 'clamp(15px, 2.2vmin, 28px)', mt: 1.5, maxWidth: '22em' }}>
          {body}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'center', pb: { xs: 3, md: 5 }, flexShrink: 0, opacity: 0.6 }}>
        <AppLogo size={22} />
      </Box>
    </Box>
  );
}

/** Phone-sized message, matching the attendee check-in card. */
function CardMessage({ title, body }: { title: string; body: string }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#F1F3F4', px: 2, py: 5 }}>
      <Paper elevation={0} sx={card}>
        <BrandRule />
        <Box sx={{ px: 3, py: 5, textAlign: 'center' }}>
          <Box
            sx={{
              width: 64, height: 64, borderRadius: '50%', bgcolor: 'grey.100', color: 'text.secondary',
              display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2.5,
            }}
          >
            <EventBusyOutlinedIcon sx={{ fontSize: 30 }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: 19, letterSpacing: '-0.01em' }}>{title}</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>{body}</Typography>
          <Box sx={{ mt: 4, opacity: 0.6, display: 'flex', justifyContent: 'center' }}>
            <AppLogo size={20} />
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

/**
 * The team's permanent surface: one link and one QR code that never change.
 *
 * `?team=<slug>` is printed once — on a standee, a lanyard card, a slide deck —
 * and this component decides, on every scan, which event it should open. The
 * choice is the team's soonest open event (see `pickLiveEventForTeam`), so
 * closing check-ins on Saturday's event and opening Sunday's is all it takes to
 * repoint every printed code.
 *
 * Between events the code still resolves; it just shows the team's holding
 * screen rather than a broken page, which matters when the sign stays up.
 */
export default function TeamLanding({ handle, display }: Props) {
  const [team, setTeam] = useState<Team | null>(null);
  const [events, setEvents] = useState<GDGEvent[]>([]);
  const [resolving, setResolving] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setResolving(true);
    setNotFound(false);
    findTeamByHandle(handle)
      .then((t) => {
        if (cancelled) return;
        if (!t) { setNotFound(true); setResolving(false); return; }
        setTeam(t);
      })
      .catch(() => { if (!cancelled) { setNotFound(true); setResolving(false); } });
    return () => { cancelled = true; };
  }, [handle]);

  // Stay subscribed: an organiser opening check-ins updates a screen already on the wall.
  useEffect(() => {
    if (!team) return;
    return listenEvents(
      (data) => { setEvents(data); setResolving(false); },
      () => setResolving(false),
      team.id
    );
  }, [team]);

  if (resolving) {
    return (
      <Box sx={{ ...screen, alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (notFound || !team) {
    const title = 'This link doesn’t lead anywhere';
    const body = 'The team may have been renamed or removed. Check the link on the Teams page.';
    return display ? <KioskMessage title={title} body={body} /> : <CardMessage title={title} body={body} />;
  }

  const liveEvent = pickLiveEventForTeam(events, team.id);

  if (!liveEvent) {
    const body = 'No check-in is open right now. See you at the next one.';
    return display
      ? <KioskMessage title={team.name} body={body} icon />
      : <CardMessage title={team.name} body={body} />;
  }

  // The code on the door screen must encode the permanent team link, not the
  // event link — otherwise a photographed kiosk QR would go stale next event.
  const teamUrl = `${window.location.origin}${window.location.pathname}?team=${handle}`;

  return display
    ? <PublicQRDisplay key={liveEvent.id} eventId={liveEvent.id} qrUrl={teamUrl} />
    : <ConsumerCheckIn key={liveEvent.id} eventId={liveEvent.id} />;
}
