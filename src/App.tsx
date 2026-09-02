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
import ListItemIcon from '@mui/material/ListItemIcon';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import RedeemOutlinedIcon from '@mui/icons-material/RedeemOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
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

/** Label and icon for each tab inside an event. */
const EVENT_TAB_META = {
  dashboard: { label: 'Dashboard', Icon: PeopleAltOutlinedIcon },
  checkin: { label: 'Check in', Icon: HowToRegOutlinedIcon },
  draw: { label: 'Merch draw', Icon: RedeemOutlinedIcon },
  settings: { label: 'Settings', Icon: SettingsOutlinedIcon },
} as const;

/** Label and icon for each top-level view. */
const VIEW_META = {
  events: { label: 'Events', Icon: EventOutlinedIcon },
  organisers: { label: 'Organisers', Icon: AdminPanelSettingsOutlinedIcon },
  teams: { label: 'Teams', Icon: GroupsOutlinedIcon },
} as const;

const ROLE_LABEL: Record<AdminRole, string> = {
  superadmin: 'Super admin',
  organiser: 'Organiser',
  team_member: 'Team member',
};

/** Shared styling for a sidebar nav row. */
const navItemSx = (selected: boolean) => ({
  borderRadius: 9999,
  px: 1.5,
  py: 0.75,
  color: selected ? 'primary.main' : 'text.primary',
  '&.Mui-selected': { bgcolor: '#E8F0FE', '&:hover': { bgcolor: '#D9E7FD' } },
  '&:hover': { bgcolor: 'grey.100' },
});

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
      {/* Logo, with a close affordance in the mobile drawer */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box
          component="button"
          onClick={() => handleNavClick(() => { setView('events'); setActiveEvent(null); })}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, border: 'none', bgcolor: 'transparent', cursor: 'pointer', p: 0, textAlign: 'left' }}
        >
          <AppLogo />
        </Box>
        {isMobile && (
          <IconButton onClick={() => setMobileOpen(false)} aria-label="Close menu" size="small" sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Which event you're inside, and the way back out */}
      {view === 'event-detail' && activeEvent && (
        <Box sx={{ mb: 2 }}>
          <Button
            onClick={() => handleNavClick(handleBack)}
            startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
            sx={{ color: 'text.secondary', fontWeight: 400, fontSize: 13, px: 1, ml: -1, mb: 1.25, borderRadius: 9999, '& .MuiButton-startIcon': { mr: 0.6 } }}
          >
            All events
          </Button>
          <Typography sx={{ fontWeight: 700, fontSize: 17, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
            {activeEvent.name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.75 }}>
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: isOpen ? '#34A853' : 'grey.400', flexShrink: 0 }} />
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
              {isOpen ? 'Check-ins open' : 'Check-ins closed'}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, mt: 0.25 }}>
            {new Date(activeEvent.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Typography>
        </Box>
      )}

      <Divider sx={{ mb: 1.5, mx: -2 }} />

      {/* Nav */}
      <List disablePadding sx={{ flex: 1 }}>
        {view === 'event-detail' ? (
          (isTeamMember ? (['checkin'] as EventTab[]) : (['dashboard', 'checkin', 'draw', 'settings'] as EventTab[])).map((t) => {
            const { label, Icon } = EVENT_TAB_META[t];
            const selected = tab === t;
            return (
              <ListItem key={t} disablePadding sx={{ mb: 0.25 }}>
                <ListItemButton
                  selected={selected}
                  onClick={() => handleNavClick(() => setTab(t))}
                  sx={navItemSx(selected)}
                >
                  <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                    <Icon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      t === 'dashboard' && checkedInCount > 0 ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          {label}
                          <Chip label={checkedInCount} size="small" color="primary" sx={{ height: 18, fontSize: 11, '& .MuiChip-label': { px: 0.75 } }} />
                        </Box>
                      ) : (
                        label
                      )
                    }
                    slotProps={{ primary: { sx: { fontWeight: selected ? 700 : 600, fontSize: 14 } } }}
                  />
                </ListItemButton>
              </ListItem>
            );
          })
        ) : (
          (isSuperAdmin
            ? (['events', 'organisers', 'teams'] as View[])
            : isOrganiser
            ? (['events', 'organisers'] as View[])
            : (['events'] as View[])
          ).map((v) => {
            const { label, Icon } = VIEW_META[v as keyof typeof VIEW_META];
            const selected = view === v;
            return (
              <ListItem key={v} disablePadding sx={{ mb: 0.25 }}>
                <ListItemButton selected={selected} onClick={() => handleNavClick(() => setView(v))} sx={navItemSx(selected)}>
                  <ListItemIcon sx={{ minWidth: 34, color: 'inherit' }}>
                    <Icon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText primary={label} slotProps={{ primary: { sx: { fontWeight: selected ? 700 : 600, fontSize: 14 } } }} />
                </ListItemButton>
              </ListItem>
            );
          })
        )}
      </List>

      {/* Who's signed in */}
      <Box sx={{ pt: 1.5, mt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ px: 1.5, mb: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600 }} noWrap>{user.email}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{ROLE_LABEL[role]}</Typography>
        </Box>
        <Button
          onClick={onSignOut}
          startIcon={<LogoutOutlinedIcon sx={{ fontSize: 18 }} />}
          fullWidth
          sx={{
            justifyContent: 'flex-start',
            borderRadius: 9999,
            px: 1.5,
            fontSize: 14,
            color: 'text.secondary',
            '&:hover': { bgcolor: 'error.light', color: 'error.main' },
          }}
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
          pt: { xs: 4, md: 1.5 },
          minWidth: 0,
        }}
      >
        {/* Mobile-only back link — on desktop the sidebar carries it */}
        {view === 'event-detail' && activeEvent && (
          <Box sx={{ display: { xs: 'block', md: 'none' }, px: 2.5, pt: 3, pb: 0 }}>
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
          <Dashboard eventId={activeEvent.id} cloudCreditsUrl={activeEvent.cloudCreditsUrl} walkInTicketTitle={activeEvent.walkInTicketTitle} walkInTicketVenue={activeEvent.walkInTicketVenue} />
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
