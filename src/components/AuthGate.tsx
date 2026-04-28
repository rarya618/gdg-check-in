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

const SUPERADMIN_EMAIL = 'russalarya@gmail.com';

interface Props {
  children: (user: User, role: AdminRole, onSignOut: () => void) => React.ReactNode;
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
        setLoading(false);
        return;
      }

      const admin = await getAdmin(u.email);
      if (!admin) {
        await signOut(auth);
        setDenied(`${u.email} is not authorised to access this app.`);
        setUser(null);
        setRole(null);
      } else {
        setUser(u);
        setRole(admin.role);
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
    await signOut(auth);
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!user || !role) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', px: 2 }}>
        <Paper elevation={1} sx={{ p: 4, width: '100%', maxWidth: 380, textAlign: 'center', borderRadius: 2 }}>
          <AppLogo />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3.5 }}>
            Sign in to manage events and check-ins.
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
            }}
          >
            {signing ? 'Signing in…' : 'Sign in with Google'}
          </Button>

          {(denied || signInError) && (
            <Alert severity="error" sx={{ mt: 2, textAlign: 'left', borderRadius: 2 }}>
              {denied || signInError}
            </Alert>
          )}
        </Paper>
      </Box>
    );
  }

  return <>{children(user, role, handleSignOut)}</>;
}
