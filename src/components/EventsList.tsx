import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
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

  const titleRef = useRef<HTMLSpanElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      const shrunk = window.scrollY > 10;
      if (titleRef.current) titleRef.current.style.fontSize = shrunk ? '1.25rem' : '2.125rem';
      if (headerRef.current) {
        headerRef.current.style.borderBottom = shrunk ? '1px solid var(--mui-palette-divider, #e0e0e0)' : 'none';
        headerRef.current.style.paddingTop = shrunk ? '10px' : '32px';
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <Box>
      <Box ref={headerRef} sx={{ position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.default', px: 4, pt: 4, pb: 1.25, transition: 'padding 0.25s ease', display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography ref={titleRef} variant="h4" sx={{ fontWeight: 700, fontSize: '2.125rem', transition: 'font-size 0.25s ease' }}>Events</Typography>
          <Typography variant="body2" color="text.secondary">
            Select an event to manage check-ins
          </Typography>
        </Box>
        {canCreate && (
          <Button
            variant="contained"
            startIcon={<AddIcon sx={{ fontWeight: 700 }} />}
            onClick={onCreateNew}
            sx={{ fontWeight: 700, borderRadius: 9999, px: 2.5 }}
          >
            Create Event
          </Button>
        )}
      </Box>

      <Box sx={{ px: 4, pb: 4 }}>
      {loading ? (
        <Box sx={{ textAlign: 'center', py: 12 }}>
          <CircularProgress color="primary" size={32} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Loading events…</Typography>
        </Box>
      ) : dbError ? (
        <Alert
          severity="error"
          sx={{ borderRadius: 3 }}
        >
          <AlertTitle>Firebase permission denied</AlertTitle>
          <Typography variant="body2" sx={{ mb: 1.5 }}>Your database rules are blocking reads.</Typography>
          <Box
            component="code"
            sx={{ display: 'block', bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1.5, px: 2, py: 1.5, fontSize: 12, whiteSpace: 'pre', fontFamily: 'monospace' }}
          >
            {`{\n  "rules": {\n    ".read": true,\n    ".write": true\n  }\n}`}
          </Box>
          <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
            Firebase Console → Realtime Database → Rules
          </Typography>
        </Alert>
      ) : events.length === 0 ? (
        <Box
          sx={{ textAlign: 'center', py: 12, border: '2px dashed', borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}
        >
          <CalendarTodayOutlinedIcon sx={{ fontSize: 48, opacity: 0.4, mb: 2, color: 'text.secondary' }} />
          <Typography variant="body1" sx={{ fontWeight: 700 }} color="text.secondary">No events yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Create your first event to get started.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.5 }}>
          {events.map((event) => (
            <EventItem key={event.id} event={event} onSelect={onSelect} />
          ))}
        </Box>
      )}
      </Box>
    </Box>
  );
}
