import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import Collapse from '@mui/material/Collapse';
import Divider from '@mui/material/Divider';
import AddIcon from '@mui/icons-material/Add';
import DeleteForeverOutlinedIcon from '@mui/icons-material/DeleteForeverOutlined';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import { listenTeams, listenAdmins, listenEvents, createTeam, deleteTeam, addTeamMember, removeTeamMember, setTeamGlobalAccess } from '../db';
import type { Team, Admin, GDGEvent } from '../types';

interface Props {
  userEmail: string;
  isSuperAdmin: boolean;
  canEdit: boolean;
}

export default function TeamsPage({ userEmail, isSuperAdmin, canEdit }: Props) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [events, setEvents] = useState<GDGEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);

  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [addMemberTeam, setAddMemberTeam] = useState<Team | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [addingMembers, setAddingMembers] = useState(false);

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
    if (!name) return;
    setCreating(true);
    try {
      const id = await createTeam(name);
      setNewTeamName('');
      setShowCreateForm(false);
      setExpandedTeam(id);
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

  function openAddMember(team: Team) {
    setAddMemberTeam(team);
    const already = new Set(Object.keys(team.members ?? {}).map(keyToEmail));
    setSelectedEmails(already);
  }

  async function handleConfirmAddMembers() {
    if (!addMemberTeam) return;
    setAddingMembers(true);
    const currentEmails = new Set(Object.keys(addMemberTeam.members ?? {}).map(keyToEmail));
    try {
      const toAdd = [...selectedEmails].filter((e) => !currentEmails.has(e));
      const toRemove = [...currentEmails].filter((e) => !selectedEmails.has(e));
      await Promise.all([
        ...toAdd.map((e) => addTeamMember(addMemberTeam.id, e)),
        ...toRemove.map((e) => removeTeamMember(addMemberTeam.id, e)),
      ]);
      setAddMemberTeam(null);
    } finally {
      setAddingMembers(false);
    }
  }

  return (
    <Box sx={{ mt: 4, px: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Teams</Typography>
          <Typography variant="body1" color="text.secondary">{visibleTeams.length} team{visibleTeams.length !== 1 ? 's' : ''}</Typography>
        </Box>
        {isSuperAdmin && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateForm(true)}
            sx={{ borderRadius: 9999, px: 2.5 }}
          >
            New Team
          </Button>
        )}
      </Box>

      {showCreateForm && (
        <Paper elevation={1} sx={{ p: 2, mb: 3, borderRadius: 2, display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            autoFocus
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateTeam(); if (e.key === 'Escape') setShowCreateForm(false); }}
            placeholder="Team name"
            size="small"
            sx={{ flex: 1, '& .MuiOutlinedInput-root': { borderRadius: 9999 } }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateTeam}
            disabled={creating || !newTeamName.trim()}
            sx={{ borderRadius: 9999, whiteSpace: 'nowrap' }}
          >
            {creating ? <CircularProgress size={18} color="inherit" /> : 'Create'}
          </Button>
          <Button variant="outlined" onClick={() => { setShowCreateForm(false); setNewTeamName(''); }} sx={{ borderRadius: 9999 }}>
            Cancel
          </Button>
        </Paper>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      ) : visibleTeams.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 12, color: 'text.secondary' }}>
          <GroupsOutlinedIcon sx={{ fontSize: 56, opacity: 0.3, mb: 1.5 }} />
          <Typography variant="body1" sx={{ fontWeight: 500 }}>No teams yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {isSuperAdmin ? 'Create a team and add organisers to it.' : "You haven't been added to a team yet."}
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {visibleTeams.map((team) => {
            const members = getMembersForTeam(team);
            const assignedEvents = getEventsForTeam(team);
            const isExpanded = expandedTeam === team.id;
            return (
              <Paper key={team.id} elevation={1} sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <Box
                  sx={{ display: 'flex', alignItems: 'center', px: 2.5, py: 2, cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}
                  onClick={() => setExpandedTeam(isExpanded ? null : team.id)}
                >
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{team.name}</Typography>
                      {team.globalAccess && (
                        <Chip label="Global access" size="small" color="primary" sx={{ height: 18, fontSize: 11, '& .MuiChip-label': { px: 1 } }} />
                      )}
                    </Box>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
                      {members.length} member{members.length !== 1 ? 's' : ''} · {assignedEvents.length} event{assignedEvents.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {canEdit && (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PersonAddIcon fontSize="small" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          openAddMember(team);
                        }}
                        sx={{ borderRadius: 9999, fontSize: 12, mr: 1 }}
                      >
                        Add members
                      </Button>
                    )}
                    {isSuperAdmin && (
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(team);
                        }}
                        sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                      >
                        <DeleteForeverOutlinedIcon fontSize="small" />
                      </IconButton>
                    )}
                    <IconButton size="small" sx={{ color: 'text.secondary' }}>
                      {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                </Box>

                <Collapse in={isExpanded}>
                  <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
                    {/* Global access toggle */}
                    {isSuperAdmin && (
                      <Box sx={{ px: 2.5, pt: 1.5, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>Global access</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Members can see all events, not just assigned ones.
                          </Typography>
                        </Box>
                        <Switch
                          checked={!!team.globalAccess}
                          onChange={(e) => setTeamGlobalAccess(team.id, e.target.checked)}
                          size="small"
                          color="primary"
                        />
                      </Box>
                    )}
                    {isSuperAdmin && <Divider sx={{ mx: 2, mt: 1 }} />}
                    {/* Members */}
                    <Box sx={{ px: 2.5, pt: 1.5, pb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                        Members
                      </Typography>
                    </Box>
                    {members.length === 0 ? (
                      <Box sx={{ px: 2.5, pb: 1.5 }}>
                        <Typography variant="body2" color="text.secondary" sx={{}}>
                          No members yet.
                        </Typography>
                      </Box>
                    ) : members.map((m) => (
                      <Box
                        key={m.email}
                        sx={{ display: 'flex', alignItems: 'center', px: 2.5, py: 0.5, '&:hover': { bgcolor: 'grey.50' } }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.email}</Typography>
                        </Box>
                        <Chip
                          label={m.role === 'superadmin' ? 'Super Admin' : m.role === 'organiser' ? 'Organiser' : 'Check-in Only'}
                          size="small"
                          sx={{
                            mr: 1, fontSize: 11,
                            bgcolor: m.role === 'superadmin' ? 'warning.light' : m.role === 'organiser' ? 'primary.light' : 'grey.200',
                            color: m.role === 'superadmin' ? '#B45309' : m.role === 'organiser' ? 'primary.main' : 'text.secondary',
                          }}
                        />
                        {canEdit && (
                          <IconButton
                            size="small"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await removeTeamMember(team.id, m.email);
                              } catch (err) {
                                console.error('Failed to remove member:', err);
                              }
                            }}
                            sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
                          >
                            <DeleteForeverOutlinedIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    ))}

                    {/* Events */}
                    <Divider sx={{ mx: 2, my: 2 }} />
                    <Box sx={{ px: 2.5, pb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                        Events
                      </Typography>
                    </Box>
                    {assignedEvents.length === 0 ? (
                      <Box sx={{ px: 2.5, pb: 1.5 }}>
                        <Typography variant="body2" color="text.secondary">
                          No events assigned – use the Events tab to assign events.
                        </Typography>
                      </Box>
                    ) : assignedEvents.map((e) => (
                      <Box key={e.id} sx={{ display: 'flex', alignItems: 'center', px: 2.5, py: 0.75 }}>
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{e.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(e.date + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </Typography>
                        </Box>
                        <Chip
                          label={e.status === 'open' ? 'Open' : 'Closed'}
                          size="small"
                          sx={{
                            fontSize: 11, height: 20,
                            bgcolor: e.status === 'open' ? 'secondary.light' : 'grey.200',
                            color: e.status === 'open' ? 'secondary.dark' : 'text.secondary',
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      </Box>
                    ))}
                    <Box sx={{ pb: 1 }} />
                  </Box>
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Add Members Dialog */}
      <Dialog
        open={!!addMemberTeam}
        onClose={() => !addingMembers && setAddMemberTeam(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, pb: 1 }}>
          Add members – {addMemberTeam?.name}
        </DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          {admins.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
              No organisers yet.
            </Typography>
          ) : (
            <List dense disablePadding sx={{ maxHeight: 320, overflowY: 'auto' }}>
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
                      sx={{ borderRadius: 1 }}
                    >
                      <Checkbox checked={checked} tabIndex={-1} disableRipple size="small" color="primary" sx={{ py: 0.5 }} />
                      <ListItemText
                        primary={a.email}
                        secondary={a.role === 'superadmin' ? 'Super Admin' : a.role === 'organiser' ? 'Organiser' : 'Check-in Only'}
                        slotProps={{
                          primary: { sx: { fontWeight: 600, fontSize: 14 } },
                          secondary: { sx: { fontSize: 12 } },
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{selectedEmails.size} selected</Typography>
          <Button onClick={() => setAddMemberTeam(null)} disabled={addingMembers} sx={{ borderRadius: 9999 }}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleConfirmAddMembers} disabled={addingMembers} sx={{ borderRadius: 9999, minWidth: 80 }}>
            {addingMembers ? <CircularProgress size={18} color="inherit" /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ pt: 3, pb: 1.5, fontWeight: 700 }}>Delete team?</DialogTitle>
        <DialogContent>
          <Typography>"{deleteTarget?.name}" will be permanently deleted.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ borderRadius: 9999 }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteTeam} disabled={deleting} sx={{ borderRadius: 9999, minWidth: 80 }}>
            {deleting ? <CircularProgress size={18} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
