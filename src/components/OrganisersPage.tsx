import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import { listenAdmins, addAdmin, removeAdmin, updateAdminRole, updateAdminTeam, addTeamMember, removeTeamMember, listenTeams } from '../db';
import type { Admin, AdminRole, Team } from '../types';

interface Props {
  userRole: AdminRole;
  userEmail: string;
  userTeamId?: string;
}

export default function OrganisersPage({ userRole, userEmail, userTeamId }: Props) {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('team_member');
  const [newTeamId, setNewTeamId] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const isSuperAdmin = userRole === 'superadmin';

  useEffect(() => { return listenAdmins(setAdmins); }, []);
  useEffect(() => { return listenTeams(setTeams); }, []);

  const visibleAdmins = isSuperAdmin
    ? admins
    : admins.filter((a) => a.teamId === userTeamId);

  function teamName(teamId?: string) {
    if (!teamId) return null;
    return teams.find((t) => t.id === teamId)?.name ?? teamId;
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Email is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Enter a valid email.'); return; }
    if (admins.some((a) => a.email === trimmed)) { setError('This person is already listed.'); return; }
    const assignedTeam = isSuperAdmin ? newTeamId || undefined : userTeamId;
    if (!isSuperAdmin && !assignedTeam) { setError('No team assigned to your account.'); return; }
    setAdding(true);
    setError('');
    try {
      await addAdmin(trimmed, role, assignedTeam);
      if (assignedTeam) await addTeamMember(assignedTeam, trimmed);
      setEmail('');
      setRole('team_member');
      setNewTeamId('');
    } catch {
      setError('Failed to add organiser.');
    }
    setAdding(false);
  }

  async function handleRemove(admin: Admin) {
    if (admin.email === userEmail) return;
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

  return (
    <Box sx={{ mt: 4, px: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Organisers</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.25 }}>
          {isSuperAdmin ? 'Manage who can access the admin panel.' : 'Manage your team members.'}
        </Typography>
      </Box>

      <Paper elevation={1} sx={{ p: 3, mb: 2.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2 }}>Add organiser</Typography>
        <Box component="form" onSubmit={handleAdd} sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="organiser@example.com"
            label="Email"
            size="small"
            sx={{ flex: 1, minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={role}
              label="Role"
              onChange={(e) => setRole(e.target.value as AdminRole)}
            >
              <MenuItem value="team_member">Check-in Only</MenuItem>
              <MenuItem value="organiser">Organiser</MenuItem>
              {isSuperAdmin && <MenuItem value="superadmin">Super Admin</MenuItem>}
            </Select>
          </FormControl>
          {isSuperAdmin && (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel shrink>Team</InputLabel>
              <Select
                value={newTeamId}
                label="Team"
                notched
                onChange={(e) => setNewTeamId(e.target.value)}
                displayEmpty
              >
                <MenuItem value="">(none)</MenuItem>
                {teams.map((t) => (
                  <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Button
            type="submit"
            variant="contained"
            disabled={adding}
            sx={{ fontWeight: 700, borderRadius: 9999, whiteSpace: 'nowrap', px: 2.5 }}
          >
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </Box>
        {!isSuperAdmin && userTeamId && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            New members will be added to your team: <strong>{teamName(userTeamId)}</strong>
          </Typography>
        )}
        {error && <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2 }}>{error}</Alert>}
      </Paper>

      <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
        {visibleAdmins.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" color="text.secondary">No organisers yet.</Typography>
          </Box>
        ) : (
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                {isSuperAdmin && <TableCell>Team</TableCell>}
                <TableCell>Added</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleAdmins.map((admin) => {
                const isSelf = admin.email === userEmail;
                return (
                  <TableRow key={admin.email} hover>
                    <TableCell>
                      <Typography variant="body1" sx={{ fontWeight: 700 }}>
                        {admin.email}
                        {isSelf && (
                          <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                            (you)
                          </Typography>
                        )}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {isSelf ? (
                        <Chip
                          label={admin.role === 'superadmin' ? 'Super Admin' : admin.role === 'organiser' ? 'Organiser' : 'Check-in Only'}
                          size="medium"
                          sx={{
                            fontSize: 12,
                            px: 1,
                            bgcolor: admin.role === 'superadmin' ? 'warning.light' : 'primary.light',
                            color: admin.role === 'superadmin' ? '#B45309' : 'primary.main',
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      ) : (
                        <Select
                          value={admin.role}
                          onChange={(e) => handleRoleChange(admin, e.target.value as AdminRole)}
                          size="small"
                          sx={{ fontSize: 12, fontWeight: 700, height: 30, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } }}
                        >
                          <MenuItem value="team_member">Check-in Only</MenuItem>
                          <MenuItem value="organiser">Organiser</MenuItem>
                          {isSuperAdmin && <MenuItem value="superadmin">Super Admin</MenuItem>}
                        </Select>
                      )}
                    </TableCell>
                    {isSuperAdmin && (
                      <TableCell>
                        <Select
                          value={admin.teamId ?? ''}
                          onChange={(e) => e.target.value && handleTeamChange(admin, e.target.value)}
                          size="small"
                          displayEmpty
                          sx={{ fontSize: 12, height: 30, minWidth: 140, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' } }}
                          renderValue={(val) => val ? (teamName(val) ?? val) : (
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>Unassigned</Typography>
                          )}
                        >
                          {teams.map((t) => (
                            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                    )}
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {new Date(admin.addedAt).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      {!isSelf && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleRemove(admin)}
                          sx={{ minWidth: 0, fontSize: 12, borderRadius: 9999, px: 1.5, fontWeight: 700 }}
                        >
                          Remove
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TableContainer>
    </Box>
  );
}
