import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: { main: '#4285F4', light: '#E8F0FE', contrastText: '#fff' },
    secondary: { main: '#34A853', light: '#E6F4EA', contrastText: '#fff' },
    error: { main: '#EA4335', light: '#FCE8E6' },
    warning: { main: '#FBBC05', light: '#FEF7E0', contrastText: '#000' },
    background: { default: '#f1f3f4', paper: '#ffffff' },
    text: { primary: '#202124', secondary: '#5f6368' },
  },
  typography: {
    fontFamily: "'Product Sans', system-ui, -apple-system, sans-serif",
    button: { textTransform: 'none' as const, fontWeight: 700 },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 9999, textTransform: 'none', fontWeight: 700, boxShadow: 'none' },
        contained: { '&:hover': { boxShadow: '0 1px 3px rgba(0,0,0,0.2)' } },
      },
    },
    MuiOutlinedInput: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)' } } },
    MuiPaper: { styleOverrides: { rounded: { borderRadius: 16 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 9999, fontWeight: 700 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 700, minHeight: 48, fontSize: 14 } } },
    MuiTabs: { styleOverrides: { root: { minHeight: 48 } } },
    MuiAppBar: {
      defaultProps: { color: 'inherit', elevation: 0 },
      styleOverrides: { root: { backgroundColor: '#fff', borderBottom: '1px solid rgba(0,0,0,0.08)' } },
    },
    MuiTableHead: { styleOverrides: { root: { '& .MuiTableCell-head': { fontWeight: 600, color: '#5f6368', backgroundColor: '#f8f9fa' } } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: 'rgba(0,0,0,0.06)' } } },
    MuiSwitch: {
      styleOverrides: {
        switchBase: { '&.Mui-checked': { color: '#4285F4' }, '&.Mui-checked + .MuiSwitch-track': { backgroundColor: '#4285F4' } },
      },
    },
  },
});
