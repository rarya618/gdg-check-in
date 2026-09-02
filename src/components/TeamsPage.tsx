import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Skeleton from '@mui/material/Skeleton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Switch from '@mui/material/Switch';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import QrCode2Icon from '@mui/icons-material/QrCode2';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { listenTeams, listenAdmins, listenEvents, createTeam, deleteTeam, addTeamMember, removeTeamMember, setTeamGlobalAccess, setTeamSlug, slugify, pickLiveEventForTeam } from '../db';
import type { Team, Admin, GDGEvent, AdminRole } from '../types';

interface Props {
  userEmail: string;
  isSuperAdmin: boolean;
  canEdit: boolean;
}

const ROLE_LABEL: Record<AdminRole, string> = {
  superadmin: 'Super admin',
  organiser: 'Organiser',
  team_member: 'Check-in only',
};

const TINTS: Array<[string, string]> = [
  ['#E8F0FE', '#1967D2'],
  ['#E6F4EA', '#137333'],
  ['#FEF7E0', '#B06000'],
  ['#FCE8E6', '#C5221F'],
];

function tintFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** Small section heading used inside an expanded team. */
function GroupHeading({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, px: 2.5, pt: 2, pb: 1 }}>
      <Typography sx={{ fontWeight: 700, fontSize: 13.5 }}>{children}</Typography>
      {count !== undefined && (
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, fontVariantNumeric: 'tabular-nums' }}>
          {count}
        </Typography>
      )}
    </Box>
  );
}


/**
 * A team's permanent check-in link: one URL and one QR code, printed once.
 *
 * The code encodes `?team=<slug>`, never an event ID, so the same standee works
 * every month — the link resolves at scan time to the team's soonest open event.
 * That makes the slug the one thing here that must not casually change, which is
 * why editing it is behind an explicit "Edit" and warns about printed material.
 */
function TeamLinkPanel({
  team,
  teams,
  canEdit,
  liveEvent,
}: {
  team: Team;
  teams: Team[];
  canEdit: boolean;
  liveEvent: GDGEvent | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(team.slug ?? '');
  const [slugError, setSlugError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<'link' | 'display' | null>(null);
  const [showQR, setShowQR] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handle = team.slug || team.id;
  const base = `${window.location.origin}${window.location.pathname}`;
  const url = `${base}?team=${handle}`;
  const displayUrl = `${url}&display=qr`;

  function copy(text: string, key: 'link' | 'display') {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    });
  }

  async function handleSaveSlug() {
    const next = slugify(draft);
    if (!next) { setSlugError('Use letters or numbers — “gdg-kl”, for example.'); return; }
    const clash = teams.some(
      (t) => t.id !== team.id && (t.slug?.toLowerCase() === next || t.id === next)
    );
    if (clash) { setSlugError('Another team already uses that handle.'); return; }
    setSaving(true);
    try {
      await setTeamSlug(team.id, next);
      setEditing(false);
      setSlugError('');
    } catch {
      setSlugError('Could not save it. Try again.');
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `checkin-qr-${handle}.png`;
    a.click();
  }

  return (
    <Box sx={{ mt: 2, mx: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
      <Typography sx={{ fontWeight: 700, fontSize: 13.5, mb: 0.5 }}>Permanent check-in link</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, mb: 1.5 }}>
        Print this once. It always opens whichever of this team’s events has check-in open.
      </Typography>

      {editing ? (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Link handle"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setSlugError(''); }}
            placeholder="gdg-kl"
            error={!!slugError}
            helperText={slugError || 'Changing this breaks codes already printed.'}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <Button
            variant="contained"
            onClick={handleSaveSlug}
            disabled={saving}
            sx={{ borderRadius: 9999, px: 2.5, mt: 0.25 }}
          >
            {saving ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
          <Button
            onClick={() => { setEditing(false); setDraft(team.slug ?? ''); setSlugError(''); }}
            disabled={saving}
            sx={{ borderRadius: 9999, px: 2, mt: 0.25, color: 'text.secondary' }}
          >
            Cancel
          </Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography
            sx={{ fontFamily: 'monospace', fontSize: 12.5, color: 'text.secondary', wordBreak: 'break-all', flex: 1, minWidth: 180 }}
          >
            {url}
          </Typography>
          <Button
            onClick={() => copy(url, 'link')}
            startIcon={copied === 'link' ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
            sx={{ borderRadius: 9999, px: 2, fontSize: 13.5, flexShrink: 0, color: copied === 'link' ? '#137333' : 'primary.main' }}
          >
            {copied === 'link' ? 'Copied' : 'Copy'}
          </Button>
          <Button
            onClick={() => setShowQR(true)}
            startIcon={<QrCode2Icon sx={{ fontSize: 18 }} />}
            sx={{ borderRadius: 9999, px: 2, fontSize: 13.5, flexShrink: 0 }}
          >
            QR code
          </Button>
          {canEdit && (
            <Button
              onClick={() => { setEditing(true); setDraft(team.slug || slugify(team.name)); }}
              sx={{ borderRadius: 9999, px: 1.5, fontSize: 13.5, flexShrink: 0, color: 'text.secondary' }}
            >
              {team.slug ? 'Edit handle' : 'Set handle'}
            </Button>
          )}
        </Box>
      )}

      {/* What the link resolves to right now — the answer to "is the sign live?" */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: liveEvent ? '#34A853' : 'grey.400', flexShrink: 0 }} />
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
          {liveEvent ? <>Now pointing at <strong>{liveEvent.name}</strong></> : 'Nothing open — scans see the team’s holding screen.'}
        </Typography>
      </Box>

      <Dialog
        open={showQR}
        onClose={() => setShowQR(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 4, maxWidth: 420 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18, pr: 6, pt: 2.5, pb: 1.5 }}>
          {team.name} — permanent code
          <IconButton onClick={() => setShowQR(false)} size="small" aria-label="Close" sx={{ position: 'absolute', right: 12, top: 14, color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pb: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, pt: 0.5 }}>
            <Box sx={{ p: 2.5, bgcolor: '#fff', borderRadius: 3, border: '1px solid', borderColor: 'divider', lineHeight: 0 }}>
              <QRCodeSVG value={url} size={200} level="M" />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Safe to print. It never needs regenerating for a new event.
            </Typography>
            {/* Hidden canvas used only for PNG export */}
            <Box sx={{ display: 'none' }}>
              <QRCodeCanvas ref={canvasRef} value={url} size={512} level="M" />
            </Box>
          </Box>

          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Door screen</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                Leave this open on a monitor — it follows the team from event to event.
              </Typography>
            </Box>
            <Tooltip title={copied === 'display' ? 'Copied' : 'Copy door screen link'} placement="top">
              <IconButton
                onClick={() => copy(displayUrl, 'display')}
                size="small"
                aria-label="Copy door screen link"
                sx={{ flexShrink: 0, color: copied === 'display' ? '#137333' : 'text.secondary' }}
              >
                {copied === 'display' ? <CheckIcon sx={{ fontSize: 18 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
              </IconButton>
            </Tooltip>
            <Button
              onClick={() => window.open(displayUrl, '_blank', 'noopener')}
              startIcon={<OpenInNewIcon sx={{ fontSize: 16 }} />}
              sx={{ borderRadius: 9999, px: 2, flexShrink: 0 }}
            >
              Open
            </Button>
          </Box>

          <Button
            onClick={handleDownload}
            startIcon={<DownloadIcon sx={{ fontSize: 18 }} />}
            sx={{ borderRadius: 9999, alignSelf: 'center', px: 2.5, color: 'text.secondary' }}
          >
            Download the code as a PNG
          </Button>
        </DialogContent>
      </Dialog>
    </Box>
  );
}

/**
 * Teams: the unit that connects people to events.
 *
 * Each team expands to show who is on it and which events it has been assigned,
 * so it's clear who can see what. Super admins manage every team; organisers see
 * only the teams they belong to.
 */
export default function TeamsPage({ userEmail, isSuperAdmin, canEdit }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [events, setEvents] = useState<GDGEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState('');

  const [membersTeam, setMembersTeam] = useState<Team | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [savingMembers, setSavingMembers] = useState(false);
  const [confirmRemoveMember, setConfirmRemoveMember] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsubTeams = listenTeams((data) => { setTeams(data); setLoading(false); });
    const unsubAdmins = listenAdmins(setAdmins);
    const unsubEvents = listenEvents(setEvents);
    return () => { unsubTeams(); unsubAdmins(); unsubEvents(); };
  }, []);

  function keyToEmail(key: string) { return key.replace(/,/g, '.'); }

  /**
   * Derives a link handle from the team name, adding `-2`, `-3`, … if another
   * team already holds it. New teams get one immediately so their permanent
   * link is printable without a second step.
   */
  function uniqueSlug(name: string): string {
    const taken = new Set(teams.flatMap((t) => [t.slug?.toLowerCase(), t.id]).filter(Boolean) as string[]);
    const base = slugify(name) || 'team';
    if (!taken.has(base)) return base;
    for (let i = 2; i < 100; i++) {
      if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
    }
    return `${base}-${Date.now()}`;
  }

  function getMembersForTeam(team: Team): Admin[] {
    const memberEmails = new Set(Object.keys(team.members ?? {}).map(keyToEmail));
    return admins.filter((a) => memberEmails.has(a.email));
  }

  function getEventsForTeam(team: Team): GDGEvent[] {
    return events.filter((e) => !!e.assignedTeams?.[team.id]);
  }

  // Organisers only see teams they belong to
  const visibleTeams = isSuperAdmin
    ? teams
    : teams.filter((t) =>
        Object.keys(t.members ?? {}).map(keyToEmail).includes(userEmail.toLowerCase())
      );

  async function handleCreateTeam() {
    const name = newTeamName.trim();
    if (!name) { setCreateError('Give the team a name.'); return; }
    if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      setCreateError('A team already goes by that name.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const id = await createTeam(name, uniqueSlug(name));
      setNewTeamName('');
      setShowCreate(false);
      setExpandedTeam(id);
    } catch {
      setCreateError('Could not create the team. Try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteTeam() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteTeam(deleteTarget.id);
      if (expandedTeam === deleteTarget.id) setExpandedTeam(null);
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  function openMembers(team: Team) {
    setMembersTeam(team);
    setSelectedEmails(new Set(Object.keys(team.members ?? {}).map(keyToEmail)));
  }

  async function handleSaveMembers() {
    if (!membersTeam) return;
    setSavingMembers(true);
    const currentEmails = new Set(Object.keys(membersTeam.members ?? {}).map(keyToEmail));
    try {
      const toAdd = [...selectedEmails].filter((e) => !currentEmails.has(e));
      const toRemove = [...currentEmails].filter((e) => !selectedEmails.has(e));
      await Promise.all([
        ...toAdd.map((e) => addTeamMember(membersTeam.id, e)),
        ...toRemove.map((e) => removeTeamMember(membersTeam.id, e)),
      ]);
      setMembersTeam(null);
    } finally {
      setSavingMembers(false);
    }
  }

  return (
    <Box sx={{ pb: 8 }}>
      <Box
        sx={{
          px: { xs: 2.5, md: 4 }, py: 1.75, mb: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Teams</Typography>
          <Typography variant="body2" color="text.secondary">
            A team is a group of people who run the events assigned to it.
          </Typography>
        </Box>
        {isSuperAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setShowCreate(true); setCreateError(''); }}
            sx={{ borderRadius: 9999, px: 2.5, whiteSpace: 'nowrap' }}
          >
            Create team
          </Button>
        )}
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 4 } }}>
        {loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Paper key={i} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 2.5 }}>
                <Skeleton width="30%" height={22} />
                <Skeleton width="18%" height={16} />
              </Paper>
            ))}
          </Box>
        ) : visibleTeams.length === 0 ? (
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, textAlign: 'center', py: 10, px: 3 }}>
            <GroupsOutlinedIcon sx={{ fontSize: 44, color: 'primary.main', opacity: 0.35, mb: 1.5 }} />
            <Typography sx={{ fontWeight: 700 }}>
              {isSuperAdmin ? 'No teams yet' : 'You are not on a team yet'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: isSuperAdmin ? 3 : 0, maxWidth: 380, mx: 'auto' }}>
              {isSuperAdmin
                ? 'Create a team, add the people on it, then assign it to an event in that event’s settings.'
                : 'A super admin needs to add you to one before its events appear for you.'}
            </Typography>
            {isSuperAdmin && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowCreate(true)} sx={{ borderRadius: 9999, px: 2.5 }}>
                Create team
              </Button>
            )}
          </Paper>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {visibleTeams.map((team) => {
              const members = getMembersForTeam(team);
              const assignedEvents = getEventsForTeam(team);
              const isExpanded = expandedTeam === team.id;
              return (
                <Paper
                  key={team.id}
                  elevation={0}
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}
                >
                  {/* Summary row — the whole row toggles the detail */}
                  <Box
                    component="button"
                    onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                    aria-expanded={isExpanded}
                    sx={{
                      width: '100%', border: 'none', bgcolor: 'transparent', textAlign: 'left', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 2,
                      '&:hover': { bgcolor: 'grey.50' },
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 16 }}>{team.name}</Typography>
                        {team.globalAccess && (
                          <Box sx={{ bgcolor: '#E8F0FE', color: 'primary.main', fontSize: 11.5, fontWeight: 700, borderRadius: 9999, px: 1.25, py: 0.25 }}>
                            Sees all events
                          </Box>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, mt: 0.25 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
                          {members.length} {members.length === 1 ? 'member' : 'members'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
                          {assignedEvents.length} {assignedEvents.length === 1 ? 'event' : 'events'}
                        </Typography>
                      </Box>
                    </Box>
                    <ExpandMoreIcon
                      sx={{
                        color: 'text.secondary', flexShrink: 0,
                        transform: isExpanded ? 'rotate(180deg)' : 'none',
                        transition: 'transform .2s ease',
                      }}
                    />
                  </Box>

                  <Collapse in={isExpanded}>
                    <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pb: 2 }}>
                      {/* Who is on it */}
                      <GroupHeading count={members.length}>Members</GroupHeading>
                      {members.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 1 }}>
                          Nobody on this team yet.
                        </Typography>
                      ) : (
                        members.map((m) => {
                          const [bg, fg] = tintFor(m.email);
                          const confirming = confirmRemoveMember === `${team.id}|${m.email}`;
                          return (
                            <Box
                              key={m.email}
                              sx={{ display: 'flex', alignItems: 'center', gap: 1.75, px: 2.5, py: 1, '&:hover': { bgcolor: 'grey.50' } }}
                            >
                              <Avatar sx={{ width: 30, height: 30, bgcolor: bg, color: fg, fontSize: 12, fontWeight: 700 }}>
                                {m.email[0]?.toUpperCase()}
                              </Avatar>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>{m.email}</Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                                  {ROLE_LABEL[m.role]}
                                </Typography>
                              </Box>
                              {canEdit && (confirming ? (
                                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    color="error"
                                    onClick={() => { setConfirmRemoveMember(''); removeTeamMember(team.id, m.email); }}
                                    sx={{ borderRadius: 9999, px: 2, fontSize: 12.5 }}
                                  >
                                    Remove
                                  </Button>
                                  <Button
                                    size="small"
                                    onClick={() => setConfirmRemoveMember('')}
                                    sx={{ borderRadius: 9999, px: 1.5, fontSize: 12.5, color: 'text.secondary' }}
                                  >
                                    Keep
                                  </Button>
                                </Box>
                              ) : (
                                <Tooltip title="Remove from team" placement="top">
                                  <IconButton
                                    size="small"
                                    onClick={() => setConfirmRemoveMember(`${team.id}|${m.email}`)}
                                    aria-label={`Remove ${m.email} from ${team.name}`}
                                    sx={{ color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: 'error.light' } }}
                                  >
                                    <PersonRemoveOutlinedIcon sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                              ))}
                            </Box>
                          );
                        })
                      )}
                      {canEdit && (
                        <Box sx={{ px: 2.5, pt: 1 }}>
                          <Button
                            startIcon={<AddIcon sx={{ fontSize: 18 }} />}
                            onClick={() => openMembers(team)}
                            sx={{ borderRadius: 9999, px: 1.5, fontSize: 13.5 }}
                          >
                            Edit members
                          </Button>
                        </Box>
                      )}

                      {/* What it runs */}
                      <GroupHeading count={assignedEvents.length}>Events</GroupHeading>
                      {assignedEvents.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ px: 2.5 }}>
                          No events assigned. Assign this team in an event’s settings.
                        </Typography>
                      ) : (
                        assignedEvents.map((e) => (
                          <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 600, fontSize: 14 }} noWrap>{e.name}</Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                                {new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: e.status === 'open' ? '#34A853' : 'grey.400' }} />
                              <Typography variant="body2" sx={{ fontSize: 12.5, color: e.status === 'open' ? '#137333' : 'text.disabled' }}>
                                {e.status === 'open' ? 'Open' : 'Closed'}
                              </Typography>
                            </Box>
                          </Box>
                        ))
                      )}

                      {/* The one link that outlives every event */}
                      <TeamLinkPanel
                        team={team}
                        teams={teams}
                        canEdit={canEdit}
                        liveEvent={pickLiveEventForTeam(events, team.id)}
                      />

                      {/* Permissions and deletion, for super admins only */}
                      {isSuperAdmin && (
                        <Box sx={{ mt: 2, mx: 2.5, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                            <Box>
                              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>See every event</Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                                Members reach all events, not only the ones assigned to this team.
                              </Typography>
                            </Box>
                            <Switch
                              checked={!!team.globalAccess}
                              onChange={(e) => setTeamGlobalAccess(team.id, e.target.checked)}
                              color="primary"
                              slotProps={{ input: { 'aria-label': `Give ${team.name} access to every event` } }}
                            />
                          </Box>
                          <Button
                            onClick={() => setDeleteTarget(team)}
                            sx={{ mt: 1.5, borderRadius: 9999, px: 1.5, fontSize: 13.5, color: 'error.main', '&:hover': { bgcolor: 'error.light' } }}
                          >
                            Delete team
                          </Button>
                        </Box>
                      )}
                    </Box>
                  </Collapse>
                </Paper>
              );
            })}
          </Box>
        )}
      </Box>

      {/* Create team */}
      <Dialog
        open={showCreate}
        onClose={() => !creating && setShowCreate(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 4, maxWidth: 420 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18, pr: 6, pt: 2.5, pb: 1.5 }}>
          Create team
          <IconButton onClick={() => setShowCreate(false)} size="small" aria-label="Close" sx={{ position: 'absolute', right: 12, top: 14, color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Name it after the group who runs the events — a chapter, a city, or a shift.
          </Typography>
          <Box
            component="form"
            onSubmit={(e) => { e.preventDefault(); handleCreateTeam(); }}
            sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}
          >
            <TextField
              autoFocus
              label="Team name"
              value={newTeamName}
              onChange={(e) => { setNewTeamName(e.target.value); setCreateError(''); }}
              placeholder="GDG Kuala Lumpur"
              fullWidth
              error={!!createError}
              helperText={createError || ' '}
            />
            <Button type="submit" variant="contained" fullWidth disabled={creating} sx={{ borderRadius: 9999, py: 1.1 }}>
              {creating ? <CircularProgress size={20} color="inherit" /> : 'Create team'}
            </Button>
          </Box>
        </DialogContent>
      </Dialog>

      {/* Edit members */}
      <Dialog
        open={!!membersTeam}
        onClose={() => !savingMembers && setMembersTeam(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 4, maxWidth: 420 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18, pr: 6, pt: 2.5, pb: 1.5 }}>
          {membersTeam?.name} members
          <IconButton onClick={() => setMembersTeam(null)} size="small" aria-label="Close" sx={{ position: 'absolute', right: 12, top: 14, color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ pb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {admins.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nobody has access yet. Add people in Organisers first, then put them on a team.
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                Tick everyone who runs this team’s events.
              </Typography>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, maxHeight: 320, overflowY: 'auto' }}>
                <List dense disablePadding>
                  {admins.map((a) => {
                    const checked = selectedEmails.has(a.email);
                    return (
                      <ListItem key={a.email} disablePadding>
                        <ListItemButton
                          onClick={() => {
                            const next = new Set(selectedEmails);
                            if (checked) next.delete(a.email);
                            else next.add(a.email);
                            setSelectedEmails(next);
                          }}
                          dense
                        >
                          <Checkbox checked={checked} tabIndex={-1} disableRipple size="small" color="primary" sx={{ py: 0.5 }} />
                          <ListItemText
                            primary={a.email}
                            secondary={ROLE_LABEL[a.role]}
                            slotProps={{
                              primary: { sx: { fontWeight: 600, fontSize: 14 } },
                              secondary: { sx: { fontSize: 12.5 } },
                            }}
                          />
                        </ListItemButton>
                      </ListItem>
                    );
                  })}
                </List>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
                  {selectedEmails.size} on the team
                </Typography>
                <Button onClick={() => setMembersTeam(null)} disabled={savingMembers} sx={{ borderRadius: 9999, px: 2, color: 'text.secondary' }}>
                  Cancel
                </Button>
                <Button variant="contained" onClick={handleSaveMembers} disabled={savingMembers} sx={{ borderRadius: 9999, px: 3 }}>
                  {savingMembers ? <CircularProgress size={18} color="inherit" /> : 'Save'}
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete team */}
      <Dialog
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 4, maxWidth: 420 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18, pt: 2.5, pb: 1.5 }}>
          Delete “{deleteTarget?.name}”?
        </DialogTitle>
        <DialogContent sx={{ pb: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <Typography variant="body2" color="text.secondary">
            Its members keep their own accounts, but they lose access to the events this team was assigned to. Events themselves are not deleted.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button variant="contained" color="error" onClick={handleDeleteTeam} disabled={deleting} fullWidth sx={{ borderRadius: 9999, py: 1 }}>
              {deleting ? <CircularProgress size={18} color="inherit" /> : 'Delete team'}
            </Button>
            <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ borderRadius: 9999, px: 3, color: 'text.secondary' }}>
              Keep it
            </Button>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
