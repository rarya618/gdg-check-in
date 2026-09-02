import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Avatar from '@mui/material/Avatar';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import { listenAdmins, addAdmin, removeAdmin, updateAdminRole, updateAdminTeam, addTeamMember, removeTeamMember, listenTeams } from '../db';
import type { Admin, AdminRole, Team } from '../types';

interface Props {
  userRole: AdminRole;
  userEmail: string;
  userTeamId?: string;
}

/** What each role is called, and what it actually lets someone do. */
const ROLES: Array<{ value: AdminRole; label: string; can: string }> = [
  { value: 'team_member', label: 'Check-in only', can: 'Runs check-in on events assigned to their team.' },
  { value: 'organiser', label: 'Organiser', can: 'Creates and edits their team’s events, and manages its members.' },
  { value: 'superadmin', label: 'Super admin', can: 'Everything, across every team.' },
];

const ROLE_LABEL: Record<AdminRole, string> = {
  team_member: 'Check-in only',
  organiser: 'Organiser',
  superadmin: 'Super admin',
};

/** Sort order for the list: most access first, then alphabetical. */
const ROLE_RANK: Record<AdminRole, number> = { superadmin: 0, organiser: 1, team_member: 2 };

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

/**
 * Manages who can sign in, what they can do, and which team they belong to.
 *
 * Super admins see and edit everyone; organisers see and edit only their own
 * team. Nobody can change or remove their own access, so an account can't lock
 * itself out.
 */
export default function OrganisersPage({ userRole, userEmail, userTeamId }: Props) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('team_member');
  const [newTeamId, setNewTeamId] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [added, setAdded] = useState('');
  const [confirmRemove, setConfirmRemove] = useState('');
  const [error, setError] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);

  const isSuperAdmin = userRole === 'superadmin';
  const roleOptions = ROLES.filter((r) => isSuperAdmin || r.value !== 'superadmin');

  useEffect(() => { return listenAdmins(setAdmins); }, []);
  useEffect(() => { return listenTeams(setTeams); }, []);

  const visibleAdmins = (isSuperAdmin ? admins : admins.filter((a) => a.teamId === userTeamId))
    .slice()
    .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.email.localeCompare(b.email));

  function teamName(teamId?: string) {
    if (!teamId) return null;
    return teams.find((t) => t.id === teamId)?.name ?? teamId;
  }

  function openAdd() {
    setShowAdd(true);
    setAdded('');
    requestAnimationFrame(() => emailRef.current?.focus());
  }

  function closeAdd() {
    setShowAdd(false);
    setEmail('');
    setRole('team_member');
    setNewTeamId('');
    setError('');
    setAdded('');
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Enter the email they sign in with.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('That doesn’t look like an email address.'); return; }
    if (admins.some((a) => a.email === trimmed)) { setError('That person already has access.'); return; }
    const assignedTeam = isSuperAdmin ? newTeamId || undefined : userTeamId;
    if (!isSuperAdmin && !assignedTeam) { setError('Your account has no team, so there is nobody to add them to.'); return; }
    setAdding(true);
    setError('');
    try {
      await addAdmin(trimmed, role, assignedTeam);
      if (assignedTeam) await addTeamMember(assignedTeam, trimmed);
      setAdded(trimmed);
      setEmail('');
      setRole('team_member');
      setNewTeamId('');
      requestAnimationFrame(() => emailRef.current?.focus());
    } catch {
      setError('Could not add them. Check your connection and try again.');
    }
    setAdding(false);
  }

  async function handleRemove(admin: Admin) {
    if (admin.email === userEmail) return;
    setConfirmRemove('');
    if (admin.teamId) await removeTeamMember(admin.teamId, admin.email);
    await removeAdmin(admin.email);
  }

  async function handleRoleChange(admin: Admin, newRole: AdminRole) {
    if (admin.email === userEmail) return;
    await updateAdminRole(admin.email, newRole);
  }

  async function handleTeamChange(admin: Admin, tid: string) {
    if (admin.teamId) await removeTeamMember(admin.teamId, admin.email);
    await updateAdminTeam(admin.email, tid);
    await addTeamMember(tid, admin.email);
  }

  const headCellSx = {
    fontSize: 12,
    fontWeight: 600,
    color: 'text.secondary',
    bgcolor: 'transparent',
    borderBottom: '1px solid',
    borderColor: 'divider',
    py: 1.5,
  } as const;

  const selectSx = {
    fontSize: 13,
    height: 34,
    bgcolor: 'background.paper',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
  };

  return (
    <Box sx={{ pb: 8 }}>
      <Box
        sx={{
          px: { xs: 2.5, md: 4 }, py: 1.75, mb: 3,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap',
        }}
      >
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.01em' }}>Organisers</Typography>
          <Typography variant="body2" color="text.secondary">
            {isSuperAdmin ? 'Who can sign in, and what they can do once they are in.' : 'The people on your team who can run check-in.'}
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} sx={{ borderRadius: 9999, px: 2.5, whiteSpace: 'nowrap' }}>
          Add organiser
        </Button>
      </Box>

      <Box sx={{ px: { xs: 2.5, md: 4 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>

        {/* Add organiser lives in a dialog — see the list, not a form, on arrival */}
        <Dialog
          open={showAdd}
          onClose={closeAdd}
          fullWidth
          maxWidth="xs"
          slotProps={{ paper: { sx: { borderRadius: 4, maxWidth: 420 } } }}
        >
          <DialogTitle sx={{ fontWeight: 700, fontSize: 18, pr: 6, pt: 2.5, pb: 1.5 }}>
            Add organiser
            <IconButton onClick={closeAdd} size="small" aria-label="Close" sx={{ position: 'absolute', right: 12, top: 14, color: 'text.secondary' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>

          <DialogContent sx={{ pb: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              They get access the next time they sign in with this Google account.
              {!isSuperAdmin && userTeamId && <> They join <strong>{teamName(userTeamId)}</strong>.</>}
            </Typography>

            {added && !error && (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                <strong>{added}</strong> can now sign in. Add another, or close this.
              </Alert>
            )}

            <Box component="form" onSubmit={handleAdd} sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
              <TextField
                inputRef={emailRef}
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); setAdded(''); }}
                placeholder="organiser@example.com"
                label="Email"
                fullWidth
                autoFocus
                slotProps={{ htmlInput: { autoCapitalize: 'off', autoCorrect: 'off', spellCheck: false } }}
              />
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select value={role} label="Role" onChange={(e) => setRole(e.target.value as AdminRole)}>
                  {roleOptions.map((r) => (
                    <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              {isSuperAdmin && (
                <FormControl fullWidth>
                  <InputLabel shrink>Team</InputLabel>
                  <Select
                    value={newTeamId}
                    label="Team"
                    notched
                    onChange={(e) => setNewTeamId(e.target.value)}
                    displayEmpty
                    renderValue={(val) => (val ? teamName(val) ?? val : <Box component="span" sx={{ color: 'text.disabled' }}>No team</Box>)}
                  >
                    <MenuItem value="">No team</MenuItem>
                    {teams.map((t) => (
                      <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                {ROLES.find((r) => r.value === role)?.can}
              </Typography>

              {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button type="submit" variant="contained" fullWidth disabled={adding} sx={{ borderRadius: 9999, py: 1.1 }}>
                  {adding ? 'Adding…' : 'Add organiser'}
                </Button>
                {added && (
                  <Button onClick={closeAdd} sx={{ borderRadius: 9999, px: 3, color: 'text.secondary' }}>
                    Done
                  </Button>
                )}
              </Box>
            </Box>
          </DialogContent>
        </Dialog>

        {/* The list */}
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflowX: 'auto' }}>
          {visibleAdmins.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, px: 3 }}>
              <Typography sx={{ fontWeight: 700 }}>Nobody has access yet</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                Add the people running the door and they can sign in with their Google account.
              </Typography>
            </Box>
          ) : (
            <Table size="medium" sx={{ minWidth: isSuperAdmin ? 760 : 560 }}>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ ...headCellSx, pl: 2.5 }}>Person</TableCell>
                  <TableCell sx={{ ...headCellSx, width: 190 }}>Role</TableCell>
                  {isSuperAdmin && <TableCell sx={{ ...headCellSx, width: 190 }}>Team</TableCell>}
                  <TableCell sx={{ ...headCellSx, width: 210, pr: 2.5 }} align="right">Access</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleAdmins.map((admin) => {
                  const isSelf = admin.email === userEmail;
                  const [bg, fg] = tintFor(admin.email);
                  const confirming = confirmRemove === admin.email;
                  return (
                    <TableRow key={admin.email} hover sx={{ '&:last-of-type td': { borderBottom: 0 } }}>
                      <TableCell sx={{ pl: 2.5, py: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
                          <Avatar sx={{ width: 34, height: 34, bgcolor: bg, color: fg, fontSize: 13, fontWeight: 700 }}>
                            {admin.email[0]?.toUpperCase()}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.35 }}>
                              {admin.email}
                              {isSelf && (
                                <Box component="span" sx={{ ml: 1, fontWeight: 400, fontSize: 12.5, color: 'text.secondary' }}>
                                  you
                                </Box>
                              )}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>
                              Added {new Date(admin.addedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>

                      <TableCell sx={{ py: 1.5 }}>
                        {isSelf ? (
                          <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{ROLE_LABEL[admin.role]}</Typography>
                        ) : (
                          <Select
                            value={admin.role}
                            onChange={(e) => handleRoleChange(admin, e.target.value as AdminRole)}
                            size="small"
                            fullWidth
                            sx={selectSx}
                          >
                            {roleOptions.map((r) => (
                              <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>
                            ))}
                          </Select>
                        )}
                      </TableCell>

                      {isSuperAdmin && (
                        <TableCell sx={{ py: 1.5 }}>
                          <Select
                            value={admin.teamId ?? ''}
                            onChange={(e) => e.target.value && handleTeamChange(admin, e.target.value)}
                            size="small"
                            displayEmpty
                            fullWidth
                            sx={selectSx}
                            renderValue={(val) =>
                              val ? (teamName(val) ?? val) : <Box component="span" sx={{ color: 'text.disabled' }}>No team</Box>
                            }
                          >
                            {teams.map((t) => (
                              <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                            ))}
                          </Select>
                        </TableCell>
                      )}

                      <TableCell align="right" sx={{ pr: 2.5, py: 1.5 }}>
                        {isSelf ? (
                          <Typography variant="body2" color="text.disabled" sx={{ fontSize: 12.5 }}>
                            You keep your own access
                          </Typography>
                        ) : confirming ? (
                          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end', alignItems: 'center' }}>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                              onClick={() => handleRemove(admin)}
                              sx={{ borderRadius: 9999, px: 2, fontSize: 12.5 }}
                            >
                              Remove
                            </Button>
                            <Button
                              size="small"
                              onClick={() => setConfirmRemove('')}
                              sx={{ borderRadius: 9999, px: 1.5, fontSize: 12.5, color: 'text.secondary' }}
                            >
                              Keep
                            </Button>
                          </Box>
                        ) : (
                          <Tooltip title="Remove access" placement="top">
                            <IconButton
                              size="small"
                              onClick={() => setConfirmRemove(admin.email)}
                              aria-label={`Remove access for ${admin.email}`}
                              sx={{ color: 'text.disabled', '&:hover': { color: 'error.main', bgcolor: 'error.light' } }}
                            >
                              <PersonRemoveOutlinedIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </TableContainer>

        {/* What the roles mean — the page is mostly role dropdowns, so it should say */}
        <Box sx={{ px: 0.5 }}>
          {roleOptions.map((r) => (
            <Box key={r.value} sx={{ display: 'flex', gap: 1, py: 0.4, flexWrap: 'wrap' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, fontSize: 12.5, minWidth: 110 }}>{r.label}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5 }}>{r.can}</Typography>
            </Box>
          ))}
        </Box>

      </Box>
    </Box>
  );
}
