import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CasinoOutlinedIcon from '@mui/icons-material/CasinoOutlined';
import ReplayIcon from '@mui/icons-material/Replay';
import { listenAttendees } from '../db';
import type { Attendee } from '../types';

interface Props {
  eventId: string;
}

export default function LuckyDraw({ eventId }: Props) {
  const [checkedIn, setCheckedIn] = useState<Attendee[]>([]);
  const [winner, setWinner] = useState<Attendee | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    return listenAttendees(eventId, (all) => {
      setCheckedIn(all.filter((a) => a.checkinDate));
    });
  }, [eventId]);

  function draw() {
    if (checkedIn.length === 0) return;
    const idx = Math.floor(Math.random() * checkedIn.length);
    setWinner(checkedIn[idx]);
    setHasDrawn(true);
  }

  return (
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4, px: 2, pb: 8 }}>
      <Paper elevation={1} sx={{ p: 4, borderRadius: 2, textAlign: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
          <CasinoOutlinedIcon sx={{ color: 'primary.main' }} />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Lucky Draw</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Pick a random winner from checked-in attendees.
        </Typography>

        <Chip
          label={`${checkedIn.length} checked in`}
          size="small"
          color={checkedIn.length > 0 ? 'primary' : 'default'}
          sx={{ mb: 4, fontWeight: 600 }}
        />

        {hasDrawn && winner ? (
          <Box
            sx={{
              bgcolor: 'primary.50',
              border: '2px solid',
              borderColor: 'primary.main',
              borderRadius: 3,
              py: 4,
              px: 3,
              mb: 4,
            }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 1, fontSize: 11, fontWeight: 700 }}>
              Winner
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main', lineHeight: 1.2 }}>
              {winner.firstName} {winner.lastName}
            </Typography>
            {winner.email && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {winner.email}
              </Typography>
            )}
          </Box>
        ) : (
          <Box sx={{ height: 148, mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography variant="body2" color="text.disabled">
              {checkedIn.length === 0 ? 'No one is checked in yet.' : 'Press Draw to pick a winner.'}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!hasDrawn ? (
            <Button
              variant="contained"
              size="large"
              startIcon={<CasinoOutlinedIcon />}
              onClick={draw}
              disabled={checkedIn.length === 0}
              sx={{ borderRadius: 9999, px: 4, fontWeight: 700 }}
            >
              Draw
            </Button>
          ) : (
            <Button
              variant="outlined"
              size="large"
              startIcon={<ReplayIcon />}
              onClick={draw}
              disabled={checkedIn.length === 0}
              sx={{ borderRadius: 9999, px: 4, fontWeight: 700 }}
            >
              Redraw
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
