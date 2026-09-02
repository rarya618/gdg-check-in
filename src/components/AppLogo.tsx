import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import bracketsLogo from '../assets/Brackets.png';

interface Props {
  /** Height of the brackets mark in px; the wordmark scales with it. */
  size?: number;
  /** Hide the wordmark and show the brackets alone. */
  markOnly?: boolean;
}

/**
 * The app lockup: the GDG brackets followed by the product name.
 *
 * The two sit on a shared centre line and scale together, so the logo can be
 * dropped into a sidebar or a full-screen kiosk without re-tuning the spacing.
 */
export default function AppLogo({ size = 22, markOnly = false }: Props) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: size * 0.06, px: 1.5 }}>
      <Box
        component="img"
        src={bracketsLogo}
        alt="GDG"
        sx={{ height: size, width: 'auto', display: 'block', flexShrink: 0 }}
      />
      {!markOnly && (
        <Typography
          component="span"
          sx={{
            fontWeight: 700,
            fontSize: size * 1.0,
            lineHeight: 1,
            letterSpacing: '-0.045em',
            color: 'text.primary',
            whiteSpace: 'nowrap',
          }}
        >
          Check-in
        </Typography>
      )}
    </Box>
  );
}
