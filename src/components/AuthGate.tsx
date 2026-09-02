import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { getAdmin, seedAdmin } from '../db';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

import type { User } from 'firebase/auth';
import type { AdminRole } from '../types';
import AppLogo from './AppLogo';

/** The four Google colours, as the rule across the top of the card. */
const BRAND = ['#4285F4', '#EA4335', '#FBBC05', '#34A853'];

const page = {
  minHeight: '100dvh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  bgcolor: '#F1F3F4',
  px: 2,
  py: 5,
};

const card = {
  width: '100%',
  maxWidth: 400,
  borderRadius: 4,
  overflow: 'hidden',
  border: '1px solid',
  borderColor: 'divider',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

/** The brand rule that tops every card on this screen. */
function BrandRule() {
  return (
    <Box sx={{ display: 'flex', height: 5 }}>
      {BRAND.map((c) => (
        <Box key={c} sx={{ flex: 1, bgcolor: c }} />
      ))}
    </Box>
  );
}

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
        setDenied(`${u.email} isn’t on the list for this app. Ask an organiser to add you, then sign in again.`);
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
      <Box sx={page}>
        <Paper elevation={0} sx={card}>
          <BrandRule />
          <Box sx={{ p: { xs: 3, sm: 4 } }}>
            <Box sx={{ ml: -1.5, mb: 2.5 }}>
              <AppLogo size={20} />
            </Box>

            <Typography sx={{ fontWeight: 700, fontSize: 22, lineHeight: 1.25, letterSpacing: '-0.02em' }}>
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              For organisers and volunteers working the door.
            </Typography>

            <Box sx={{ mt: 3.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Button
                fullWidth
                variant="outlined"
                onClick={handleSignIn}
                disabled={signing}
                startIcon={signing ? <CircularProgress size={16} color="inherit" /> : <GoogleIcon />}
                sx={{
                  borderColor: 'divider',
                  color: 'text.primary',
                  '&:hover': { borderColor: 'primary.main', bgcolor: 'primary.light' },
                  borderRadius: 9999,
                  py: 1.5,
                  fontSize: 16,
                }}
              >
                {signing ? 'Signing in…' : 'Continue with Google'}
              </Button>

              {(denied || signInError) && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {denied || signInError}
                </Alert>
              )}

              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12.5, lineHeight: 1.5 }}>
                Use the Google account an organiser added for you. Attendees don’t sign in — they scan the QR code at the door.
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    );
  }

  return <>{children(user, role, teamId, handleSignOut)}</>;
}
