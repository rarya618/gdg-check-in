import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

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
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': { borderColor: 'primary.main', boxShadow: '0 2px 8px rgba(66,133,244,0.15)' },
      }}
    >
      <CardActionArea onClick={() => onSelect(event)} sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {event.name}
              </Typography>
              <Chip
                label={event.status === 'open' ? 'Open' : 'Closed'}
                size="medium"
                sx={{
                  height: 24,
                  px: 0.5,
                  fontSize: 12,
                  ml: 0.5,
                  bgcolor: event.status === 'open' ? 'secondary.light' : 'grey.100',
                  color: event.status === 'open' ? 'secondary.main' : 'text.secondary',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            </Box>
            {event.description && (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 2.5 }}>{event.description}</Typography>
            )}
            <Typography variant="body2" color="text.disabled" sx={{ mb: 0.5 }}>
              {new Date(event.date + 'T00:00:00').toLocaleDateString(undefined, {
                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
              })}
            </Typography>
          </Box>
          <ChevronRightIcon sx={{ color: 'text.disabled', flexShrink: 0, mt: 0.25 }} />
        </Box>
      </CardActionArea>
    </Card>
  )
}