import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';

import type { GDGEvent } from '../types';

interface Props {
  event: GDGEvent;
  onSelect: (event: GDGEvent) => void;
  /** Marks the event as happening today, which pulls it forward visually. */
  today?: boolean;
}

/**
 * One event in the events list.
 *
 * Leads with the name, then how full the room is — the fill rail uses the same
 * blue-against-grey reading as the Dashboard's arrival bar, so the card and the
 * event's own dashboard tell the same story.
 */
export default function EventItem({ event, onSelect, today }: Props) {
  const total = event.attendeeCount ?? 0;
  const checkedIn = event.checkedInCount ?? 0;
  const pct = total ? (checkedIn / total) * 100 : 0;
  const isOpen = event.status === 'open';

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 3,
        height: '100%',
        borderColor: today ? '#AECBFA' : 'divider',
        boxShadow: 'none',
        transition: 'border-color .15s ease, box-shadow .15s ease',
        '&:hover': { borderColor: 'primary.main', boxShadow: '0 2px 10px rgba(66,133,244,0.14)' },
      }}
    >
      <CardActionArea
        onClick={() => onSelect(event)}
        sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch', justifyContent: 'flex-start' }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
            {event.name}
          </Typography>
          {today && (
            <Box
              sx={{
                flexShrink: 0, bgcolor: '#E8F0FE', color: 'primary.main',
                fontSize: 11.5, fontWeight: 700, borderRadius: 9999, px: 1.25, py: 0.25,
              }}
            >
              Today
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mt: 0.75 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
            {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: isOpen ? '#34A853' : 'grey.400' }} />
            <Typography variant="body2" sx={{ fontSize: 12.5, color: isOpen ? '#137333' : 'text.disabled' }}>
              {isOpen ? 'Open' : 'Closed'}
            </Typography>
          </Box>
        </Box>

        {event.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 1.25, fontSize: 13.5, lineHeight: 1.45,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}
          >
            {event.description}
          </Typography>
        )}

        {/* How full the room is */}
        <Box sx={{ mt: 'auto', pt: 2.5, width: '100%' }}>
          {total === 0 ? (
            <Typography variant="body2" color="text.disabled" sx={{ fontSize: 12.5 }}>
              No one registered yet
            </Typography>
          ) : (
            <>
              <Box sx={{ height: 6, borderRadius: 9999, bgcolor: 'grey.200', overflow: 'hidden' }}>
                <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: '#4285F4', transition: 'width .4s ease' }} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, mt: 0.75, fontVariantNumeric: 'tabular-nums' }}>
                {checkedIn} of {total} checked in
              </Typography>
            </>
          )}
        </Box>
      </CardActionArea>
    </Card>
  );
}
