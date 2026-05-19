import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import GroupIcon from '@mui/icons-material/Group';
import HowToRegIcon from '@mui/icons-material/HowToReg';

import type { GDGEvent } from '../types';

interface Props {
  event: GDGEvent;
  onSelect: (event: GDGEvent) => void;
}

export default function EventItem({ event, onSelect }: Props) {
  return (
    <Card
      key={event.id}
      variant="outlined"
      sx={{
        px: 0.5,
        borderRadius: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': { borderColor: 'primary.main', boxShadow: '0 2px 8px rgba(66,133,244,0.15)' },
      }}
    >
      <CardActionArea onClick={() => onSelect(event)} sx={{ p: 2.5, flex: 1, display: 'flex', alignItems: 'stretch' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {event.name}
            </Typography>
            {event.description && (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 'auto', pb: 2.5 }}>{event.description}</Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mt: 'auto', pt: event.description ? 0 : 2.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: event.status === 'open' ? 'secondary.main' : 'text.disabled', display: 'inline-block' }} />
                <Typography component="span" variant="caption" sx={{ color: event.status === 'open' ? 'secondary.main' : 'text.disabled', fontWeight: 600 }}>
                  {event.status === 'open' ? 'Open' : 'Closed'}
                </Typography>
              </Box>
              <Typography component="span" variant="caption" color="text.disabled">
                {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
                  weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
                })}
              </Typography>
              {event.attendeeCount !== undefined && (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <GroupIcon sx={{ fontSize: 15, color: 'text.disabled', display: 'block' }} />
                    <Typography component="span" variant="caption" color="text.disabled">
                      {event.attendeeCount} registered
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <HowToRegIcon sx={{ fontSize: 15, color: 'text.disabled', display: 'block' }} />
                    <Typography component="span" variant="caption" color="text.disabled">
                      {event.checkedInCount} checked in
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  )
}