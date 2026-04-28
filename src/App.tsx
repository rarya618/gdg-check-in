import { useState } from 'react';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';

import bracketsLogo from './assets/Brackets.png';

import EventsList from './components/EventsList';
import CreateEventForm from './components/CreateEventForm';
import CheckInForm from './components/CheckInForm';
import Dashboard from './components/Dashboard';
import ConsumerCheckIn from './components/ConsumerCheckIn';
import PublicQRDisplay from './components/PublicQRDisplay';
import AuthGate from './components/AuthGate';
import OrganisersPage from './components/OrganisersPage';
import EventSettings from './components/EventSettings';
import TeamsPage from './components/TeamsPage';
import AppLogo from './components/AppLogo';

import { listenEvents } from './db';
import type { GDGEvent, AdminRole } from './types';
import type { User } from 'firebase/auth';

type View = 'events' | 'event-detail' | 'organisers' | 'teams';
type EventTab = 'checkin' | 'dashboard' | 'settings';

const SIDEBAR_WIDTH = 280;
const searchParams = new URLSearchParams(window.location.search);
const consumerEventId = searchParams.get('event');
const isQRDisplay = consumerEventId && searchParams.get('display') === 'qr';

// @ts-ignore
function AdminApp({ user, role, onSignOut }: { user: User; role: AdminRole; onSignOut: () => void }) {
  const [view, setView] = useState<View>(role === 'team_member' ? 'teams' : 'events');
  const [showCreate, setShowCreate] = useState(false);
  const [activeEvent, setActiveEvent] = useState<GDGEvent | null>(null);
  const [tab, setTab] = useState<EventTab>('checkin');
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleSelectEvent(event: GDGEvent) {
    setActiveEvent(event);
    setTab('dashboard');
    setCheckedInCount(0);
    setView('event-detail');
  }

  function handleEventCreated(eventId: string) {
    setShowCreate(false);
    const unsub = listenEvents((events) => {
      const found = events.find((e) => e.id === eventId);
      if (found) { unsub(); handleSelectEvent(found); }
    });
  }

  function handleBack() {
    setView('events');
    setActiveEvent(null);
  }

  function handleNavClick(action: () => void) {
    action();
    setMobileOpen(false);
  }

  const isSuperAdmin = role === 'superadmin';
  const isTeamMember = role === 'team_member';
  const isOpen = activeEvent?.status === 'open';


  const sidebarContent = (
    <>
      {/* Logo / brand */}
      <Box
        component="button"
        onClick={() => handleNavClick(() => { setView('events'); setActiveEvent(null); })}
        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, border: 'none', bgcolor: 'transparent', cursor: 'pointer', p: 0, mb: 1, textAlign: 'left' }}
      >
        <AppLogo />
      </Box>

      {/* Event context block */}
      {view === 'event-detail' && activeEvent && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <IconButton onClick={() => handleNavClick(handleBack)} size="small" aria-label="Back" sx={{ color: 'text.secondary', ml: -0.5 }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
            <Typography variant="caption" color="text.secondary">Back to events</Typography>
          </Box>
          <Box
            sx={{
              bgcolor: 'grey.50',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              px: 2,
              py: 2,
              mb: 2,
            }}
          >
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.75, lineHeight: 1.3 }}>
              {activeEvent.name}
            </Typography>
            {activeEvent.description && (
              <Typography variant="body1" color="text.secondary" sx={{ fontSize: 14, mb: 2, lineHeight: 1.4 }}>
                {activeEvent.description}
              </Typography>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 0.5 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontSize: 12 }}>
                {new Date(activeEvent.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </Typography>
              <Chip
                label={isOpen ? 'Open' : 'Closed'}
                size="small"
                sx={{
                  height: 20,
                  fontSize: 11,
                  fontWeight: 600,
                  bgcolor: isOpen ? 'secondary.light' : 'grey.200',
                  color: isOpen ? 'secondary.dark' : 'text.secondary',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            </Box>
          </Box>
          <Divider sx={{ mb: 1 }} />
        </>
      )}

      {/* Nav items */}
      <List disablePadding sx={{ flex: 1 }}>
        {view === 'event-detail' ? (
          <>
            {(['dashboard', 'checkin', 'settings'] as EventTab[]).map((t) => (
              <ListItem key={t} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={tab === t}
                  onClick={() => handleNavClick(() => setTab(t))}
                  sx={{ borderRadius: 9999, px: 2.5, '&.Mui-selected': { bgcolor: 'primary.50', color: 'primary.main' } }}
                >
                  <ListItemText
                    primary={
                      t === 'dashboard' ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          Dashboard
                          {checkedInCount > 0 && (
                            <Chip label={checkedInCount} size="small" color="primary" sx={{ height: 18, fontSize: 11, '& .MuiChip-label': { px: 0.75 } }} />
                          )}
                        </Box>
                      ) : t === 'checkin' ? 'Check In' : 'Settings'
                    }
                    slotProps={{ primary: { sx: { fontWeight: 700, fontSize: 14 } } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </>
        ) : (
          <>
            {(isSuperAdmin
              ? (['events', 'organisers', 'teams'] as View[])
              : isTeamMember
              ? (['teams'] as View[])
              : (['events', 'teams'] as View[])
            ).map((v) => (
              <ListItem key={v} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={view === v}
                  onClick={() => handleNavClick(() => setView(v))}
                  sx={{ borderRadius: 9999, px: 2.5, '&.Mui-selected': { bgcolor: 'primary.50', color: 'primary.main' } }}
                >
                  <ListItemText
                    primary={v === 'events' ? 'Events' : v === 'organisers' ? 'Organisers' : 'Teams'}
                    slotProps={{ primary: { sx: { fontWeight: 700, fontSize: 14 } } }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </>
        )}
      </List>

      {/* Bottom actions */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pt: 2 }}>
        <Button
          onClick={onSignOut}
          variant="outlined"
          fullWidth
          sx={{ color: 'error.main', fontSize: 14, fontWeight: 700, px: 2, py: 1, borderRadius: 9999, borderColor: 'error.main', '&:hover': { bgcolor: 'error.light', borderColor: 'error.main' } }}
        >
          Sign out
        </Button>
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>

      {/* Mobile top AppBar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          display: { md: 'none' },
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
          color: 'text.primary',
          zIndex: (theme) => theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <IconButton
            edge="start"
            onClick={() => setMobileOpen(prev => !prev)}
            aria-label="Toggle menu"
            sx={{ color: 'text.primary' }}
          >
            {mobileOpen ? <CloseIcon /> : <MenuIcon />}
          </IconButton>
          <Box component="img" src={bracketsLogo} alt="Brackets.ai" sx={{ height: 28, width: 'auto' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Check-In</Typography>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            width: SIDEBAR_WIDTH,
            bgcolor: 'background.paper',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          },
        }}
      >
        {sidebarContent}
      </Drawer>

      {/* Desktop Sidebar */}
      <Box
        component="nav"
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          bgcolor: 'background.paper',
          borderRight: '1px solid',
          borderColor: 'divider',
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          p: 2,
          overflowY: 'auto',
        }}
      >
        {sidebarContent}
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          ml: { xs: 0, md: `${SIDEBAR_WIDTH}px` },
          flex: 1,
          pb: 8,
          pt: { xs: 7, md: 0 },
          minWidth: 0,
        }}
      >
        {view === 'events' && (
          <EventsList onSelect={handleSelectEvent} onCreateNew={() => setShowCreate(true)} />
        )}
        {view === 'event-detail' && activeEvent && tab === 'checkin' && (
          <CheckInForm eventId={activeEvent.id} onCheckedIn={() => setCheckedInCount(n => n + 1)} />
        )}
        {view === 'event-detail' && activeEvent && tab === 'dashboard' && (
          <Dashboard eventId={activeEvent.id} />
        )}
        {view === 'event-detail' && activeEvent && tab === 'settings' && (
          <EventSettings
            event={activeEvent}
            onEventUpdated={(updated) => setActiveEvent(updated)}
            onDeleted={handleBack}
          />
        )}
        {view === 'organisers' && isSuperAdmin && <OrganisersPage />}
        {view === 'teams' && <TeamsPage userEmail={user.email!} isSuperAdmin={isSuperAdmin} canEdit={role !== 'team_member'} />}
      </Box>

      {showCreate && (
        <CreateEventForm onCreated={handleEventCreated} onCancel={() => setShowCreate(false)} />
      )}
    </Box>
  );
}

export default function App() {
  if (isQRDisplay && consumerEventId) {
    return <PublicQRDisplay eventId={consumerEventId} />;
  }
  if (consumerEventId) {
    return <ConsumerCheckIn eventId={consumerEventId} />;
  }
  return (
    <AuthGate>
      {(user, role, onSignOut) => <AdminApp user={user} role={role} onSignOut={onSignOut} />}
    </AuthGate>
  );
}
