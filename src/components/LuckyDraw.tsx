import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ReplayIcon from '@mui/icons-material/Replay';
import UndoIcon from '@mui/icons-material/Undo';
import { listenAttendees } from '../db';
import type { Attendee } from '../types';

interface Props {
  eventId: string;
}

/** The four Google colours, used as the reveal rule under the winner's name. */
const BRAND = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];

/** Total length of the shuffle before the winner lands, in ms. */
const ROLL_MS = 1700;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function fullName(a: Attendee) {
  return `${a.firstName} ${a.lastName}`.trim();
}

/**
 * Merch draw stage for a single event.
 *
 * Draws a random winner from attendees who have checked in, shuffling visibly
 * through the pool before landing so the reveal reads as a live draw to the room.
 * Winners are held in draw order and stay out of the pool until they're put back
 * (for a no-show) or the whole draw is reset.
 */
export default function LuckyDraw({ eventId }: Props) {
  const [checkedIn, setCheckedIn] = useState<Attendee[]>([]);
  const [won, setWon] = useState<Attendee[]>([]);
  const [winner, setWinner] = useState<Attendee | null>(null);
  const [rollingName, setRollingName] = useState<string | null>(null);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    return listenAttendees(eventId, (all) => {
      setCheckedIn(all.filter((a) => a.checkinDate));
    });
  }, [eventId]);

  // Cancel any in-flight shuffle if the tab unmounts mid-draw.
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const wonTickets = new Set(won.map((a) => a.ticketNumber));
  const pool = checkedIn.filter((a) => !wonTickets.has(a.ticketNumber));
  const rolling = rollingName !== null;

  function land(picked: Attendee) {
    setRollingName(null);
    setWinner(picked);
    setWon((prev) => [picked, ...prev]);
  }

  function draw() {
    if (pool.length === 0 || rolling) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];

    if (prefersReducedMotion() || pool.length === 1) {
      land(picked);
      return;
    }

    // Decelerating shuffle: fast flicker that slows as it approaches the winner.
    setWinner(null);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    let elapsed = 0;
    while (elapsed < ROLL_MS) {
      const at = elapsed;
      timers.current.push(
        window.setTimeout(() => {
          const shown = pool[Math.floor(Math.random() * pool.length)];
          setRollingName(fullName(shown));
        }, at),
      );
      // step grows from ~55ms to ~260ms across the roll
      elapsed += 55 + Math.pow(elapsed / ROLL_MS, 2.2) * 210;
    }
    timers.current.push(window.setTimeout(() => land(picked), ROLL_MS));
  }

  function putBack(a: Attendee) {
    setWon((prev) => prev.filter((w) => w.ticketNumber !== a.ticketNumber));
    if (winner?.ticketNumber === a.ticketNumber) setWinner(null);
  }

  function reset() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setWon([]);
    setWinner(null);
    setRollingName(null);
  }

  const stageMessage =
    checkedIn.length === 0
      ? 'Check people in first — the draw runs on everyone who has arrived.'
      : pool.length === 0
      ? 'Everyone in the room has won. Reset to run the draw again.'
      : 'Ready when you are.';

  return (
    <Box sx={{ pb: 8 }}>
      <Box sx={{ px: { xs: 2.5, md: 4 }, py: 1.75, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Merch draw</Typography>
        <Typography variant="body2" color="text.secondary">
          Picks at random from everyone who has checked in.
        </Typography>
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 4 } }}>
        {/* The stage — sized to be read from across a room */}
        <Paper
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 4,
            px: { xs: 3, md: 6 },
            py: { xs: 5, md: 7 },
            textAlign: 'center',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: { xs: 3, sm: 5 }, mb: { xs: 4, md: 5 } }}>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 22, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                {pool.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">in the draw</Typography>
            </Box>
            <Box sx={{ width: '1px', bgcolor: 'divider' }} />
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: 22, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                {won.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">already won</Typography>
            </Box>
          </Box>

          <Box
            aria-live="polite"
            sx={{
              minHeight: { xs: 150, md: 190 },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
            }}
          >
            {rolling ? (
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: { xs: 32, sm: 44, md: 58 },
                  lineHeight: 1.05,
                  letterSpacing: '-0.03em',
                  color: 'text.disabled',
                }}
              >
                {rollingName}
              </Typography>
            ) : winner ? (
              <>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: { xs: 34, sm: 48, md: 64 },
                    lineHeight: 1.05,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {fullName(winner)}
                </Typography>
                {/* Brand rule wipes in under the name to mark the landing */}
                <Box
                  sx={{
                    display: 'flex',
                    height: 6,
                    width: { xs: 160, md: 220 },
                    borderRadius: 9999,
                    overflow: 'hidden',
                    mt: 1.5,
                    animation: 'drawRule .5s cubic-bezier(.2,.8,.2,1) both',
                    '@keyframes drawRule': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
                    '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
                  }}
                >
                  {BRAND.map((c) => (
                    <Box key={c} sx={{ flex: 1, bgcolor: c }} />
                  ))}
                </Box>
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">{winner.email}</Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12.5, color: 'text.disabled', mt: 0.25 }}>
                    {winner.ticketNumber}
                  </Typography>
                </Box>
              </>
            ) : (
              <Typography color="text.secondary">{stageMessage}</Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap', mt: { xs: 4, md: 5 } }}>
            <Button
              variant="contained"
              size="large"
              startIcon={winner || rolling ? <ReplayIcon /> : undefined}
              onClick={draw}
              disabled={pool.length === 0 || rolling}
              sx={{ borderRadius: 9999, px: 4.5, py: 1.25, fontSize: 16 }}
            >
              {rolling ? 'Drawing…' : winner ? 'Draw again' : 'Draw a winner'}
            </Button>
            {won.length > 0 && !rolling && (
              <Button
                variant="text"
                size="large"
                onClick={reset}
                sx={{ borderRadius: 9999, px: 3, color: 'text.secondary' }}
              >
                Start over
              </Button>
            )}
          </Box>
        </Paper>

        {/* Winners so far — the MC's read-back list, newest first */}
        {won.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, px: 0.5 }}>
              Winners so far
            </Typography>
            <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
              {won.map((a, i) => (
                <Box
                  key={a.ticketNumber}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                    px: 2.5,
                    py: 1.5,
                    borderTop: i === 0 ? 'none' : '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography
                    sx={{ width: 24, fontSize: 13, color: 'text.disabled', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {won.length - i}
                  </Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>{fullName(a)}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }} noWrap>
                      {a.email}
                    </Typography>
                  </Box>
                  <Tooltip title="Put back in the draw" placement="top">
                    <IconButton
                      size="small"
                      onClick={() => putBack(a)}
                      aria-label={`Put ${fullName(a)} back in the draw`}
                      sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main', bgcolor: 'primary.light' } }}
                    >
                      <UndoIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  );
}
