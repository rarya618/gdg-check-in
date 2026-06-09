import { useState, useEffect } from 'react';
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';


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
import LuckyDraw from './components/LuckyDraw';

import { listenEvents, listenTeam } from './db';
import type { GDGEvent, AdminRole } from './types';
import type { User } from 'firebase/auth';

/** Top-level navigation views available in the admin shell. */
type View = 'events' | 'event-detail' | 'organisers' | 'teams';
/** Tabs available when drilling into an event. */
type EventTab = 'checkin' | 'dashboard' | 'settings' | 'draw';

const SIDEBAR_WIDTH = 280;

// URL-based routing: the app serves three distinct surfaces from one origin.
// ?event=<id>            → ConsumerCheckIn (public self-service form)
// ?event=<id>&display=qr → PublicQRDisplay (kiosk QR code screen)
// (no params)            → AdminApp (authenticated staff interface)
const searchParams = new URLSearchParams(window.location.search);
const consumerEventId = searchParams.get('event');
const isQRDisplay = consumerEventId && searchParams.get('display') === 'qr';

/**
 * Main authenticated admin shell.
 *
 * Renders a fixed sidebar (desktop) / drawer (mobile) for navigation and a
 * main content area that mounts the active view. State is kept here so that
 * navigating away from an event and back doesn't re-mount the event components.
 *
 * Role-based nav visibility:
 * - superadmin  → Events, Organisers, Teams (all events)
 * - organiser   → Events, Organisers (team-scoped events; team-scoped organiser management)
 * - team_member → Events only (team-scoped; check-in tab only inside events)
 */
function AdminApp({ user, role, teamId, onSignOut }: { user: User; role: AdminRole; teamId: string | undefined; onSignOut: () => void }) {
  const [view, setView] = useState<View>('events');
  const [showCreate, setShowCreate] = useState(false);
  const [activeEvent, setActiveEvent] = useState<GDGEvent | null>(null);
  const [tab, setTab] = useState<EventTab>('checkin');
  const [checkedInCount, setCheckedInCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [teamGlobalAccess, setTeamGlobalAccess] = useState(false);

  useEffect(() => {
    if (!teamId) return;
    return listenTeam(teamId, (t) => setTeamGlobalAccess(!!t?.globalAccess));
  }, [teamId]);

  /** Drills into an event. team_member lands on check-in tab; others get dashboard. */
  function handleSelectEvent(event: GDGEvent) {
    setActiveEvent(event);
    setTab(role === 'team_member' ? 'checkin' : 'dashboard');
    setCheckedInCount(0);
    setView('event-detail');
  }

  /**
   * Called after a new event is successfully created.
   * Starts a temporary listener to wait for the new event to appear in the
   * events collection, then immediately navigates into it.
   */
  function handleEventCreated(eventId: string) {
    setShowCreate(false);
    const unsub = listenEvents((events) => {
      const found = events.find((e) => e.id === eventId);
      if (found) { unsub(); handleSelectEvent(found); }
    }, undefined, isTeamMember || isOrganiser ? (teamGlobalAccess ? undefined : teamId) : undefined);
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
  const isOrganiser = role === 'organiser';
  const isTeamMember = role === 'team_member';
  const isOpen = activeEvent?.status === 'open';


  const sidebarContent = (isMobile: boolean) => (
    <>
      {/* Mobile sidebar header: logo + close button */}
      {isMobile ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box
            component="button"
            onClick={() => handleNavClick(() => { setView('events'); setActiveEvent(null); })}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, border: 'none', bgcolor: 'transparent', cursor: 'pointer', p: 0, textAlign: 'left' }}
          >
            <AppLogo />
          </Box>
          <IconButton onClick={() => setMobileOpen(false)} aria-label="Close menu" size="small" sx={{ color: 'text.secondary', mt: -1 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      ) : (
        /* Desktop logo */
        <Box
          component="button"
          onClick={() => handleNavClick(() => { setView('events'); setActiveEvent(null); })}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, border: 'none', bgcolor: 'transparent', cursor: 'pointer', p: 0, mb: 1, textAlign: 'left' }}
        >
          <AppLogo />
        </Box>
      )}

      {/* Event context block */}
      {view === 'event-detail' && activeEvent && (
        <>
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
            {(isTeamMember
              ? (['checkin'] as EventTab[])
              : (['dashboard', 'checkin', 'draw', 'settings'] as EventTab[])
            ).map((t) => (
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
                      ) : t === 'checkin' ? 'Check In' : t === 'draw' ? 'Merch Draw' : 'Settings'
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
              : isOrganiser
              ? (['events', 'organisers'] as View[])
              : (['events'] as View[])
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

      {/* Mobile floating hamburger */}
      <IconButton
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
        sx={{
          display: { xs: 'flex', md: 'none' },
          opacity: mobileOpen ? 0 : 1,
          transform: mobileOpen ? 'scale(0.7)' : 'scale(1)',
          pointerEvents: mobileOpen ? 'none' : 'auto',
          transition: mobileOpen ? 'none' : 'opacity 0.4s ease, transform 0.4s ease',
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: (theme) => theme.zIndex.drawer + 1,
          color: 'text.primary',
          bgcolor: 'background.paper',
          boxShadow: 1,
          '&:hover': { bgcolor: 'grey.100' },
        }}
      >
        <MenuIcon />
      </IconButton>

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
        {sidebarContent(true)}
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
        {sidebarContent(false)}
      </Box>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          ml: { xs: 0, md: `${SIDEBAR_WIDTH}px` },
          flex: 1,
          pb: 8,
          pt: { xs: 4, md: 0 },
          minWidth: 0,
        }}
      >
        {view === 'event-detail' && activeEvent && (
          <Box sx={{ px: 4, pt: { xs: 3, md: 3 }, pb: 0 }}>
            <Button
              onClick={() => handleNavClick(handleBack)}
              startIcon={<ArrowBackIcon fontSize="small" />}
              size="small"
              sx={{ color: 'text.secondary', textTransform: 'none', fontWeight: 400, fontSize: 12, px: 1, ml: -0.4, '& .MuiButton-startIcon': { mr: 0.6 } }}
            >
              Back to events
            </Button>
          </Box>
        )}
        {view === 'events' && (
          <EventsList onSelect={handleSelectEvent} onCreateNew={() => setShowCreate(true)} teamId={isTeamMember || isOrganiser ? (teamGlobalAccess ? undefined : teamId) : undefined} canCreate={!isTeamMember} />
        )}
        {view === 'event-detail' && activeEvent && tab === 'checkin' && (
          <CheckInForm eventId={activeEvent.id} onCheckedIn={() => setCheckedInCount(n => n + 1)} />
        )}
        {view === 'event-detail' && activeEvent && tab === 'dashboard' && (
          <Dashboard eventId={activeEvent.id} cloudCreditsUrl={activeEvent.cloudCreditsUrl} />
        )}
        {view === 'event-detail' && activeEvent && tab === 'draw' && (
          <LuckyDraw eventId={activeEvent.id} />
        )}
        {view === 'event-detail' && activeEvent && tab === 'settings' && (
          <EventSettings
            event={activeEvent}
            onEventUpdated={(updated) => setActiveEvent(updated)}
            onDeleted={handleBack}
          />
        )}
        {view === 'organisers' && (isSuperAdmin || isOrganiser) && (
          <OrganisersPage userRole={role} userEmail={user.email!} userTeamId={teamId} />
        )}
        {view === 'teams' && <TeamsPage userEmail={user.email!} isSuperAdmin={isSuperAdmin} canEdit={role !== 'team_member'} />}
      </Box>

      {showCreate && (
        <CreateEventForm onCreated={handleEventCreated} onCancel={() => setShowCreate(false)} autoAssignTeamId={isOrganiser ? teamId : undefined} />
      )}
    </Box>
  );
}

/**
 * Root component. Decides which surface to render based on URL query params:
 * - `?event=<id>&display=qr` → PublicQRDisplay (kiosk mode)
 * - `?event=<id>`            → ConsumerCheckIn (attendee self-service)
 * - (none)                   → AuthGate → AdminApp
 */
export default function App() {
  if (isQRDisplay && consumerEventId) {
    return <PublicQRDisplay eventId={consumerEventId} />;
  }
  if (consumerEventId) {
    return <ConsumerCheckIn eventId={consumerEventId} />;
  }
  return (
    <AuthGate>
      {(user, role, teamId, onSignOut) => <AdminApp user={user} role={role} teamId={teamId} onSignOut={onSignOut} />}
    </AuthGate>
  );
}
