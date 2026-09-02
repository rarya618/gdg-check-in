import { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import CircularProgress from '@mui/material/CircularProgress';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { importBevyAttendees } from '../db';
import type { Attendee } from '../types';

interface Props {
  eventId: string;
}

type ParsedRow = Omit<Attendee, 'source'>;

/**
 * Parses a Bevy attendee export CSV into structured rows.
 *
 * Columns are located by header name (case-insensitive), not by position, so
 * Bevy exports with extra or reordered columns import correctly. Recognised
 * headers: `Order number`, `Ticket number`, `First Name`, `Last Name`, `Email`,
 * `Title` / `Job Title`, `Company`, `Ticket Type`, `Ticket title`,
 * `Ticket venue`, `Checkin Date (UTC)`.
 *
 * Rows are skipped if they lack a ticket number or email, or if the email is
 * the internal Bevy support address (`gdg-support@google.com`). A non-empty
 * `Checkin Date (UTC)` seeds the attendee's check-in state.
 *
 * Uses a hand-rolled RFC-4180 field parser instead of a library to avoid
 * dependencies and to handle Bevy's specific quoting style reliably.
 *
 * @returns `{ rows }` — valid attendee rows ready to pass to `importBevyAttendees`.
 */
function parseCSV(text: string): { rows: ParsedRow[]; skippedRows: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], skippedRows: 0 };

  // Simple RFC-4180 field parser
  function parseFields(line: string): string[] {
    const fields: string[] = [];
    let i = 0;
    while (i < line.length) {
      if (line[i] === '"') {
        let val = '';
        i++;
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
          else if (line[i] === '"') { i++; break; }
          else { val += line[i++]; }
        }
        fields.push(val);
        if (line[i] === ',') i++;
      } else {
        const end = line.indexOf(',', i);
        if (end === -1) { fields.push(line.slice(i)); break; }
        fields.push(line.slice(i, end));
        i = end + 1;
      }
    }
    return fields;
  }

  // Map header names -> column index (case-insensitive)
  const headers = parseFields(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (...names: string[]): number => {
    for (const n of names) {
      const i = headers.indexOf(n.toLowerCase());
      if (i !== -1) return i;
    }
    return -1;
  };
  const col = {
    orderNumber: idx('order number'),
    ticketNumber: idx('ticket number'),
    firstName: idx('first name'),
    lastName: idx('last name'),
    email: idx('email'),
    jobTitle: idx('job title', 'title'),
    company: idx('company'),
    ticketType: idx('ticket type'),
    ticketTitle: idx('ticket title'),
    ticketVenue: idx('ticket venue'),
    checkinDate: idx('checkin date (utc)', 'checkin date'),
  };

  const dataLines = lines.slice(1);
  const rows: ParsedRow[] = [];
  let skippedRows = 0;

  const at = (f: string[], i: number) => (i >= 0 ? f[i]?.trim() ?? '' : '');

  for (const line of dataLines) {
    const f = parseFields(line);
    const orderNumber = at(f, col.orderNumber);
    const ticketNumber = at(f, col.ticketNumber);
    const firstName = at(f, col.firstName);
    const lastName = at(f, col.lastName);
    const email = at(f, col.email);
    const jobTitle = at(f, col.jobTitle);
    const company = at(f, col.company);
    const ticketType = at(f, col.ticketType);
    const ticketTitle = at(f, col.ticketTitle);
    const ticketVenue = at(f, col.ticketVenue);
    const rawCheckin = at(f, col.checkinDate);

    // Skip rows without a ticket number or email
    if (!ticketNumber || !email) { skippedRows++; continue; }
    // Skip known system entries
    if (email.toLowerCase() === 'gdg-support@google.com') { skippedRows++; continue; }

    let checkinDate = '';
    if (rawCheckin) {
      const d = new Date(rawCheckin.replace(' ', 'T'));
      if (!isNaN(d.getTime())) checkinDate = d.toISOString();
    }

    rows.push({
      ticketNumber,
      ...(orderNumber ? { bevyOrderNumber: orderNumber } : {}),
      firstName: firstName || email.split('@')[0],
      lastName,
      email,
      ...(jobTitle ? { jobTitle } : {}),
      ...(company ? { company } : {}),
      ...(ticketType ? { ticketType } : {}),
      ...(ticketTitle ? { ticketTitle } : {}),
      ...(ticketVenue ? { ticketVenue } : {}),
      ...(checkinDate ? { checkinDate } : {}),
    });
  }

  return { rows, skippedRows };
}

/**
 * Three-phase import flow for a Bevy attendee CSV:
 *   1. **File selection** — hidden `<input type="file">` triggered by a styled button.
 *   2. **Preview** — parsed rows shown in a table before committing.
 *   3. **Result** — success banner with imported / skipped counts.
 *
 * Existing tickets are merged server-side by `importBevyAttendees` (check-in
 * state preserved), so re-uploading the same CSV is safe.
 */
export default function BevyImport({ eventId }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; updated: number } | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      try {
        const { rows } = parseCSV(text);
        if (rows.length === 0) {
          setParseError('No valid attendee rows found in the file.');
          setParsed(null);
        } else {
          setParsed(rows);
        }
      } catch {
        setParseError('Failed to parse the CSV file. Please check the format.');
        setParsed(null);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    try {
      const res = await importBevyAttendees(eventId, parsed);
      setResult(res);
      setParsed(null);
    } catch {
      setParseError('Import failed. Please try again.');
    }
    setImporting(false);
  }

  function handleReset() {
    setParsed(null);
    setResult(null);
    setParseError('');
  }

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {result ? (
        <Box>
          <Alert severity="success" sx={{ borderRadius: 2, mb: 2 }}>
            <strong>{result.imported}</strong> attendee{result.imported !== 1 ? 's' : ''} imported.
            {result.updated > 0 && ` ${result.updated} existing ${result.updated !== 1 ? 'records were' : 'record was'} updated.`}
          </Alert>
          <Button variant="outlined" size="small" onClick={handleReset} sx={{ borderRadius: 9999 }}>
            Import another file
          </Button>
        </Box>
      ) : parsed ? (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            {parsed.length} attendee{parsed.length !== 1 ? 's' : ''} ready to import. Existing tickets will be updated without losing check-in status.
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2, maxHeight: 280, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Ticket</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>First Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Last Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parsed.map((row) => (
                  <TableRow key={row.ticketNumber}>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{row.ticketNumber}</TableCell>
                    <TableCell>{row.firstName}</TableCell>
                    <TableCell>{row.lastName}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', fontSize: 13 }}>{row.email}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button
              variant="contained"
              onClick={handleImport}
              disabled={importing}
              startIcon={importing ? <CircularProgress size={16} color="inherit" /> : undefined}
              sx={{ borderRadius: 9999, px: 2.5 }}
            >
              {importing ? 'Importing…' : `Import ${parsed.length} attendees`}
            </Button>
            <Button variant="outlined" onClick={handleReset} sx={{ borderRadius: 9999, borderColor: 'divider', color: 'text.secondary' }}>
              Cancel
            </Button>
          </Box>
        </Box>
      ) : (
        <Box>
          {parseError && <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{parseError}</Alert>}
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => fileInputRef.current?.click()}
            sx={{ borderRadius: 9999, borderColor: 'divider', color: 'text.secondary', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}
          >
            Choose CSV file
          </Button>
        </Box>
      )}
    </Box>
  );
}
