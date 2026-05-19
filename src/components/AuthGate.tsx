import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { getAdmin, seedAdmin } from '../db';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import type { User } from 'firebase/auth';
import type { AdminRole } from '../types';
import AppLogo from './AppLogo';

const FEATURES = [
  { label: 'Real-time check-in for pre-registered and walk-in attendees' },
  { label: 'Import attendee lists from Bevy CSV with deduplication' },
  { label: 'Merch draw with live, transparent picks' },
  { label: 'Team-based roles with scoped event access' },
];

const SUPERADMIN_EMAIL = 'russalarya@gmail.com';

interface Props {
  children: (user: User, role: AdminRole, teamId: string | undefined, onSignOut: () => void) => React.ReactNode;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

export default function AuthGate({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [teamId, setTeamId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState('');
  const [signing, setSigning] = useState(false);
  const [signInError, setSignInError] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u?.email) {
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }

      if (u.email.toLowerCase() === SUPERADMIN_EMAIL) {
        await seedAdmin(SUPERADMIN_EMAIL, 'superadmin');
        setUser(u);
        setRole('superadmin');
        setTeamId(undefined);
        setLoading(false);
        return;
      }

      const admin = await getAdmin(u.email);
      if (!admin) {
        await signOut(auth);
        setDenied(`${u.email} is not authorised to access this app.`);
        setUser(null);
        setRole(null);
        setTeamId(undefined);
      } else {
        setUser(u);
        setRole(admin.role);
        setTeamId(admin.teamId);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  async function handleSignIn() {
    setSigning(true);
    setSignInError('');
    setDenied('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setSignInError(err instanceof Error ? err.message : 'Sign-in failed.');
      }
    }
    setSigning(false);
  }

  async function handleSignOut() {
    setUser(null);
    setRole(null);
    setTeamId(undefined);
    await signOut(auth);
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #E8F0FE 0%, #FCE8E6 50%, #FEF7E0 100%)' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!user || !role) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column-reverse', md: 'row' } }}>

        {/* Left panel */}
        <Box sx={{
          flex: { md: '0 0 65%' },
          background: `
            radial-gradient(ellipse at 10% 20%, rgba(66, 133, 244, 0.25) 0%, transparent 45%),
            radial-gradient(ellipse at 90% 10%, rgba(234, 67, 53, 0.2) 0%, transparent 40%),
            radial-gradient(ellipse at 80% 90%, rgba(52, 168, 83, 0.2) 0%, transparent 45%),
            radial-gradient(ellipse at 15% 85%, rgba(251, 188, 5, 0.18) 0%, transparent 40%),
            #0D1B2A
          `,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          px: { xs: 4, md: 7, lg: 10 },
          py: { xs: 5, md: 8 },
        }}>
          {/* Logo — desktop only */}
          <Box sx={{ mb: 5, alignSelf: 'flex-start', bgcolor: '#fff', borderRadius: 9999, pl: 2, pr: 3, pt: 0.75, pb: 0, display: { xs: 'none', md: 'inline-flex' }, alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
            <AppLogo />
          </Box>

          {/* Tagline */}
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.15,
              mb: 1.5,
              fontSize: { xs: '1.9rem', md: '2.4rem', lg: '2.75rem' },
              letterSpacing: '-0.02em',
            }}
          >
            Event check-in,<br />done right.
          </Typography>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.5)', mb: 5, fontSize: 15, maxWidth: 420 }}>
            Everything your GDG team needs to run a smooth event, from the door to the draw.
          </Typography>

          {/* Feature list */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {FEATURES.map((f) => (
              <Box key={f.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.75 }}>
                <Box sx={{
                  mt: '3px',
                  flexShrink: 0,
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  bgcolor: 'rgba(25, 118, 210, 0.25)',
                  border: '1.5px solid rgba(25, 118, 210, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#42A5F5', display: 'block' }} />
                </Box>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.55, fontSize: 14 }}>
                  {f.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Right panel */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.default',
          px: { xs: 3, md: 6 },
          py: { xs: 5, md: 8 },
        }}>
          <Box sx={{ width: '100%', maxWidth: 340 }}>
            {/* Logo — mobile only */}
            <Box sx={{ mb: 3, display: { xs: 'inline-flex', md: 'none' }, bgcolor: '#fff', borderRadius: 9999, pl: 2, pr: 3, pt: 0.75, pb: 0, alignItems: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <AppLogo />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.75, letterSpacing: '-0.01em' }}>
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, lineHeight: 1.6 }}>
              Access is restricted to authorised team members. Sign in with your Google account to continue.
            </Typography>
            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleSignIn}
              disabled={signing}
              startIcon={<GoogleIcon />}
              sx={{
                borderColor: 'divider',
                color: 'text.primary',
                '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.light' },
                borderRadius: 9999,
                py: 1.25,
                px: 2.5,
                fontWeight: 600,
              }}
            >
              {signing ? 'Signing in…' : 'Sign in with Google'}
            </Button>
            {(denied || signInError) && (
              <Alert severity="error" sx={{ mt: 2.5, textAlign: 'left', borderRadius: 2 }}>
                {denied || signInError}
              </Alert>
            )}
          </Box>
        </Box>

      </Box>
    );
  }

  return <>{children(user, role, teamId, handleSignOut)}</>;
}
