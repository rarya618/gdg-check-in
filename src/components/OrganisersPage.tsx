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
import { listenAdmins, addAdmin, removeAdmin, updateAdminRole } from '../db';
import type { Admin, AdminRole } from '../types';

const SUPERADMIN_EMAIL = 'russalarya@gmail.com';

export default function OrganisersPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AdminRole>('team_member');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { return listenAdmins(setAdmins); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Email is required.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setError('Enter a valid email.'); return; }
    if (admins.some((a) => a.email === trimmed)) { setError('This person is already listed.'); return; }
    setAdding(true);
    setError('');
    try {
      await addAdmin(trimmed, role);
      setEmail('');
      setRole('organiser');
    } catch {
      setError('Failed to add organiser.');
    }
    setAdding(false);
  }

  async function handleRemove(admin: Admin) {
    if (admin.email === SUPERADMIN_EMAIL) return;
    await removeAdmin(admin.email);
  }

  async function handleRoleChange(admin: Admin, newRole: AdminRole) {
    if (admin.email === SUPERADMIN_EMAIL) return;
    await updateAdminRole(admin.email, newRole);
  }

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', mt: 4, px: 2 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Organisers</Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mt: 0.25 }}>
          Manage who can access the admin panel.
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
              <MenuItem value="superadmin">Super Admin</MenuItem>
            </Select>
          </FormControl>
          <Button
            type="submit"
            variant="contained"
            disabled={adding}
            sx={{ fontWeight: 700, borderRadius: 9999, whiteSpace: 'nowrap', px: 2.5 }}
          >
            {adding ? 'Adding…' : 'Add'}
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ mt: 1.5, borderRadius: 2 }}>{error}</Alert>}
      </Paper>

      <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
        {admins.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body2" color="text.secondary">No organisers yet.</Typography>
          </Box>
        ) : (
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Added</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {admins.map((admin) => {
                const isSelf = admin.email === SUPERADMIN_EMAIL;
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
                          <MenuItem value="superadmin">Super Admin</MenuItem>
                        </Select>
                      )}
                    </TableCell>
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
