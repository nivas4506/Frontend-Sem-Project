import { useState, useCallback } from 'react';
import { authService, generateMockJWT } from '../services/authService';
import { avatars } from '../data';

export function useAuth() {
  const [session, setSession] = useState(() => {
    authService.ensureSeededAdmin();
    let s = authService.getStoredSession();
    return s?.user?.id ? s : null;
  });

  const [authMode, setAuthMode] = useState('signin');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [profileDraft, setProfileDraft] = useState(null);

  const makeProfileDraft = useCallback((user) => {
    if (!user) return null;
    return {
      ...user,
      username: user.username || user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'creator',
      bio: user.bio ?? 'Crafting social connections & exploring new ideas.',
      avatar: user.avatar || avatars[0],
      interests: user.interests || ['ai', 'design', 'code'],
      privacy: user.privacy || 'public'
    };
  }, []);

  const signIn = useCallback(async (email, password, portal = 'user') => {
    const res = await authService.signInWithEmail(email, password, portal);
    setSession(res);
    setProfileDraft(makeProfileDraft(res.user));
    setOnboardingStep(1);
    return res;
  }, [makeProfileDraft]);

  const signUp = useCallback(async ({ name, email, password }) => {
    const res = await authService.signUpWithEmail({ name, email, password });
    setSession(res);
    setProfileDraft(makeProfileDraft(res.user));
    setOnboardingStep(1);
    return res;
  }, [makeProfileDraft]);

  const completeOAuth = useCallback(async (provider, overrides, isSignUp) => {
    const res = await authService.completeOAuthFlow(provider, overrides, isSignUp);
    setSession(res);
    setProfileDraft(makeProfileDraft(res.user));
    setOnboardingStep(1);
    return res;
  }, [makeProfileDraft]);

  const createOAuthRequest = useCallback((provider, isSignUp) => {
    return authService.createOAuthRequest(provider, isSignUp);
  }, []);

  const requestPasswordReset = useCallback(async (email) => {
    return await authService.requestPasswordReset(email);
  }, []);

  const updateProfile = useCallback((fields) => {
    if (!session) return;
    const updatedUser = { ...session.user, ...fields };
    const updatedSession = {
      ...session,
      user: updatedUser,
      jwt: generateMockJWT(updatedUser)
    };
    authService.saveSession(updatedSession);
    const users = authService.getRegisteredUsers().map(u => u.id === updatedUser.id ? { ...u, ...fields } : u);
    localStorage.setItem('scp_registered_users', JSON.stringify(users));
    setSession(updatedSession);
    return updatedSession;
  }, [session]);

  const signOut = useCallback(() => {
    authService.clearSession();
    setSession(null);
    setProfileDraft(null);
    setAuthMode('signin');
  }, []);

  return {
    session,
    authMode,
    setAuthMode,
    onboardingStep,
    setOnboardingStep,
    profileDraft,
    setProfileDraft,
    makeProfileDraft,
    signIn,
    signUp,
    completeOAuth,
    createOAuthRequest,
    requestPasswordReset,
    updateProfile,
    signOut
  };
}
