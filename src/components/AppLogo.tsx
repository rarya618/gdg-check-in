import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import bracketsLogo from '../assets/Brackets.png';

export default function AppLogo() {
  return (
    <Box component="div" sx={{ display: "flex", justifyContent: "center" }}>
      <Box component="img" src={bracketsLogo} alt="GDG Brackets" sx={{ height: 20, width: 'auto', flexShrink: 0, ml:1, mr: 1.25, my: 0.75}} />
      <Typography variant="h6" sx={{ fontWeight: 700 }} gutterBottom>Check-In</Typography>
    </Box>
  )
}