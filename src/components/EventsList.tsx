import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import AddIcon from '@mui/icons-material/Add';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import { listenEvents } from '../db';
import type { GDGEvent } from '../types';

import EventItem from './EventItem';

interface Props {
  onSelect: (event: GDGEvent) => void;
  onCreateNew: () => void;
  teamId?: string;
  canCreate?: boolean;
}

/** Today as `YYYY-MM-DD` in the viewer's own timezone, to match `GDGEvent.date`. */
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * The events home screen.
 *
 * Events arrive sorted by creation time, which says nothing about when they
 * happen, so they're regrouped here by date: today first, then what's coming up,
 * then what's already run.
 */
export default function EventsList({ onSelect, onCreateNew, teamId, canCreate = true }: Props) {
  const [events, setEvents] = useState<GDGEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState('');

  useEffect(() => {
    const unsub = listenEvents(
      (data) => { setEvents(data); setLoading(false); },
      (err) => { setDbError(err.message); setLoading(false); },
      teamId
    );
    return unsub;
  }, [teamId]);

  const key = todayKey();
  const today = events.filter((e) => e.date === key);
  const upcoming = events.filter((e) => e.date > key).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => e.date < key).sort((a, b) => b.date.localeCompare(a.date));

  const groups: Array<{ heading: string; events: GDGEvent[]; today?: boolean }> = [
    { heading: 'Happening today', events: today, today: true },
    { heading: 'Coming up', events: upcoming },
    { heading: 'Already run', events: past },
  ].filter((g) => g.events.length > 0);

  return (
    <Box sx={{ pb: 8 }}>
      <Box
        sx={{
          px: { xs: 2.5, md: 4 }, py: 1.75, mb: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Events</Typography>
          <Typography variant="body2" color="text.secondary">
            Open an event to run check-in for it.
          </Typography>
        </Box>
        {canCreate && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={onCreateNew}
            sx={{ borderRadius: 9999, px: 2.5, whiteSpace: 'nowrap' }}
          >
            Create event
          </Button>
        )}
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 4 } }}>
        {loading ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Paper key={i} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5 }}>
                <Skeleton width="55%" height={24} />
                <Skeleton width="35%" height={16} />
                <Skeleton variant="rounded" height={6} sx={{ mt: 3, borderRadius: 9999 }} />
                <Skeleton width="30%" height={16} sx={{ mt: 1 }} />
              </Paper>
            ))}
          </Box>
        ) : dbError ? (
          <Alert severity="error" sx={{ borderRadius: 3 }}>
            <AlertTitle>The database is refusing to be read</AlertTitle>
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              Your Realtime Database rules are blocking this account. Open Firebase Console → Realtime Database → Rules and allow reads:
            </Typography>
            <Box
              component="code"
              sx={{ display: 'block', bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 2, px: 2, py: 1.5, fontSize: 12, whiteSpace: 'pre', fontFamily: 'monospace' }}
            >
              {`{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}`}
            </Box>
          </Alert>
        ) : events.length === 0 ? (
          <Paper
            elevation={0}
            sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, textAlign: 'center', py: 10, px: 3 }}
          >
            <CalendarTodayOutlinedIcon sx={{ fontSize: 44, color: 'primary.main', opacity: 0.35, mb: 1.5 }} />
            <Typography sx={{ fontWeight: 700 }}>
              {canCreate ? 'No events yet' : 'Nothing assigned to your team yet'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: canCreate ? 3 : 0, maxWidth: 360, mx: 'auto' }}>
              {canCreate
                ? 'Create one, import your registrations, and you can start checking people in.'
                : 'An organiser needs to assign your team to an event before it shows up here.'}
            </Typography>
            {canCreate && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={onCreateNew} sx={{ borderRadius: 9999, px: 2.5 }}>
                Create event
              </Button>
            )}
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {groups.map((group) => (
              <Box key={group.heading}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 15 }}>{group.heading}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {group.events.length}
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
                  {group.events.map((event) => (
                    <EventItem key={event.id} event={event} onSelect={onSelect} today={group.today} />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}
