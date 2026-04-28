import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import DownloadIcon from '@mui/icons-material/Download';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import CircularProgress from '@mui/material/CircularProgress';
import { listenAttendees } from '../db';
import type { Attendee } from '../types';

interface Props {
  eventId: string;
}

export default function Dashboard({ eventId }: Props) {
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsub = listenAttendees(eventId, (data) => {
      setAttendees(data);
      setLoading(false);
    });
    return unsub;
  }, [eventId]);

  const filtered = attendees.filter((a) => {
    const q = search.toLowerCase();
    return (
      a.firstName.toLowerCase().includes(q) ||
      a.lastName.toLowerCase().includes(q) ||
      a.email.toLowerCase().includes(q) ||
      a.ticketNumber.toLowerCase().includes(q)
    );
  });

  function exportCSV() {
    const header = 'Ticket number,First Name,Last Name,Email,Checkin Date (UTC)';
    const rows = attendees.map((a) =>
      [a.ticketNumber, a.firstName, a.lastName, a.email, new Date(a.checkinDate).toUTCString()]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `checkins-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', mt: 4, px: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2, mb: 4 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Attendees</Typography>
          <Typography variant="body2" color="text.secondary">{attendees.length} checked in</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search attendees…"
            size="small"
            sx={{ width: { xs: '100%', sm: 240 }, '& .MuiOutlinedInput-root': { borderRadius: 9999, px: 2 } }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button
            variant="contained"
            color="secondary"
            startIcon={<DownloadIcon />}
            onClick={exportCSV}
            disabled={attendees.length === 0}
            sx={{ borderRadius: 9999, whiteSpace: 'nowrap', px: 2.5 }}
          >
            Export CSV
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      ) : attendees.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 12, color: 'text.secondary' }}>
          <PeopleOutlinedIcon sx={{ fontSize: 56, opacity: 0.3, mb: 1.5 }} />
          <Typography variant="body1" sx={{ fontWeight: 500 }}>No attendees yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Check-ins will appear here in real time.
          </Typography>
        </Box>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 10, color: 'text.secondary' }}>
          <Typography>No results for "{search}"</Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2, overflowX: 'auto' }}>
          <Table size="medium">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: 110 }}>Ticket</TableCell>
                <TableCell>First Name</TableCell>
                <TableCell>Last Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Check-in (UTC)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.ticketNumber} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700 }} color="primary.main">
                      {a.ticketNumber}
                    </Typography>
                  </TableCell>
                  <TableCell>{a.firstName}</TableCell>
                  <TableCell>{a.lastName}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{a.email}</TableCell>
                  <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap', fontSize: 12 }}>
                    {new Date(a.checkinDate).toUTCString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
