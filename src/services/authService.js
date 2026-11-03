/**
 * OAuth 2.0 & Identity Management Service
 * Follows the Social Connectivity Platform System Design Document (SDD Step 1):
 * - OAuth 2.0 / OIDC Protocol with JWT tokens (RS256 structure)
 * - Dynamic User Accounts (No pre-existing mock emails/passwords)
 * - Accounts are registered on-the-fly and preserved in local storage
 */

const STORAGE_KEY = 'scp_auth_session';
const PENDING_OAUTH_KEY = 'scp_pending_oauth';
const USERS_DB_KEY = 'scp_registered_users';

export const DEMO_ADMIN_EMAIL = 'admin@socialconnect.local';
export const DEMO_ADMIN_PASSWORD = 'Admin@12345';
export const DEMO_ADMIN_ID = 'usr_demo_admin';

// Helper to base64url encode JSON
function base64UrlEncode(obj) {
  const jsonStr = JSON.stringify(obj);
  return btoa(unescape(encodeURIComponent(jsonStr)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Generates simulated RS256 JWT Token
export function generateMockJWT(user) {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
    kid: 'scp-auth-key-2026-v1'
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    picture: user.avatar,
    provider: user.provider,
    role: user.role || 'standard_user',
    token_ver: 1,
    iss: 'https://auth.socialplatform.io',
    aud: 'scp-web-client',
    iat: now,
    exp: now + 900 // 15 minutes validity (per SDD Step 1)
  };

  const mockSignature = 'k8s_rs256_mock_sig_' + Math.random().toString(36).substring(2, 15);
  const token = `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.${mockSignature}`;
  
  const refreshToken = 'rt_' + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);

  return {
    accessToken: token,
    refreshToken,
    expiresIn: 900,
    tokenType: 'Bearer',
    decoded: payload
  };
}

export const authService = {
  ensureSeededAdmin() {
    const users = this.getRegisteredUsers();
    if (users.some((user) => user.id === DEMO_ADMIN_ID)) {
      return users.find((user) => user.id === DEMO_ADMIN_ID);
    }

    const admin = {
      id: DEMO_ADMIN_ID,
      name: 'Platform Administrator',
      email: DEMO_ADMIN_EMAIL,
      password: DEMO_ADMIN_PASSWORD,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=Admin`,
      role: 'admin',
      provider: 'local',
      active: true,
      createdAt: new Date().toISOString(),
      onboardingCompleted: true
    };

    this.saveRegisteredUser(admin);
    return admin;
  },

  // Retrieve registered users from localStorage (No pre-existing default accounts)
  getRegisteredUsers() {
    try {
      const data = localStorage.getItem(USERS_DB_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  // Save registered user
  saveRegisteredUser(user) {
    const users = this.getRegisteredUsers();
    users.push(user);
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
  },

  // Retrieve active session from localStorage
  getStoredSession() {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return null;
      const parsed = JSON.parse(data);
      // If user is already authenticated from a regular login or has a valid session, ensure onboardingCompleted is respected
      if (parsed?.user && parsed?.authMethod && parsed.authMethod !== 'email:signup') {
        if (parsed.user.onboardingCompleted === undefined) {
          parsed.user.onboardingCompleted = true;
        }
      }
      return parsed;
    } catch {
      return null;
    }
  },

  // Save session
  saveSession(session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  },

  // Clear session
  clearSession() {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(PENDING_OAUTH_KEY);
  },

  // Generate OAuth 2.0 PKCE parameters
  createOAuthRequest(provider, isSignUp = false) {
    const state = 'st_' + Math.random().toString(36).substring(2, 12);
    const codeVerifier = 'cv_' + Math.random().toString(36).substring(2, 20) + Math.random().toString(36).substring(2, 20);
    const codeChallenge = 'cc_' + Math.random().toString(36).substring(2, 20);

    const pending = {
      provider,
      state,
      codeVerifier,
      codeChallenge,
      isSignUp: Boolean(isSignUp),
      createdAt: Date.now()
    };
    sessionStorage.setItem(PENDING_OAUTH_KEY, JSON.stringify(pending));

    return pending;
  },

  // Complete OAuth 2.0 Flow
  async completeOAuthFlow(provider, profileOverride = {}, isSignUp = false) {
    await new Promise((res) => setTimeout(res, 600));

    const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);
    const email = profileOverride.email || `user@${provider}.com`;
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists in registered users
    const registeredUsers = this.getRegisteredUsers();
    let existingUser = registeredUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    let userProfile;

    if (existingUser) {
      // Existing user: already has an account, so profile is ready
      userProfile = {
        ...existingUser,
        onboardingCompleted: true
      };
      const idx = registeredUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
      if (idx !== -1) {
        registeredUsers[idx].onboardingCompleted = true;
        localStorage.setItem(USERS_DB_KEY, JSON.stringify(registeredUsers));
      }
    } else {
      // Brand new user:
      // If initiated from Sign Up -> needs profile creation (onboardingCompleted: false)
      // If initiated from Sign In -> directly available (onboardingCompleted: true)
      userProfile = {
        id: 'usr_' + provider.substring(0, 2) + '_' + Math.random().toString(36).substring(2, 8),
        name: profileOverride.name || `${providerName} User`,
        email: cleanEmail,
        avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(provider + Date.now())}`,
        provider: provider,
        role: 'verified_user',
        active: true,
        onboardingCompleted: !isSignUp
      };

      this.saveRegisteredUser(userProfile);
    }

    const jwt = generateMockJWT(userProfile);

    const session = {
      user: userProfile,
      jwt,
      authMethod: `oauth2:${provider}`,
      authenticatedAt: new Date().toISOString()
    };

    this.saveSession(session);
    return session;
  },

  // Email / Password Login (Authenticates against registered users)
  async signInWithEmail(email, password, portal = 'user') {
    await new Promise((res) => setTimeout(res, 500));

    this.ensureSeededAdmin();

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    if (!password) {
      throw new Error('Please enter your password.');
    }

    const registeredUsers = this.getRegisteredUsers();
    const existing = registeredUsers.find((u) => u.email.toLowerCase() === cleanEmail);

    if (!existing) {
      throw new Error('No account found with this email. Please click "Create an account" to sign up first.');
    }

    if (existing.password && existing.password !== password) {
      throw new Error('Incorrect password. Please verify your credentials.');
    }

    if (existing.active === false) {
      throw new Error('This account has been deactivated. Contact an administrator.');
    }

    if (portal === 'admin' && (
      existing.id !== DEMO_ADMIN_ID ||
      cleanEmail !== DEMO_ADMIN_EMAIL ||
      password !== DEMO_ADMIN_PASSWORD
    )) {
      throw new Error('Admin portal credentials are required.');
    }

    if (portal !== 'admin' && existing.role === 'admin') {
      throw new Error('Select Admin portal mode to sign in as an administrator.');
    }

    // Existing user logging in: bypass profile setup and enter platform directly!
    const userToLogin = {
      ...existing,
      onboardingCompleted: true
    };

    // Update in registered users database
    const idx = registeredUsers.findIndex((u) => u.email.toLowerCase() === cleanEmail);
    if (idx !== -1) {
      registeredUsers[idx].onboardingCompleted = true;
      localStorage.setItem(USERS_DB_KEY, JSON.stringify(registeredUsers));
    }

    const jwt = generateMockJWT(userToLogin);
    const session = {
      user: userToLogin,
      jwt,
      authMethod: 'email:password',
      authenticatedAt: new Date().toISOString()
    };

    this.saveSession(session);
    return session;
  },

  // Email Sign Up (Creates a brand new account - requires profile setup)
  async signUpWithEmail({ name, email, password }) {
    await new Promise((res) => setTimeout(res, 600));

    const cleanName = (name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      throw new Error('Please provide your full name.');
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const registeredUsers = this.getRegisteredUsers();
    const exists = registeredUsers.some((u) => u.email.toLowerCase() === cleanEmail);

    if (exists) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    // New user created: onboardingCompleted is false so they are prompted to create their profile
    const newUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 8),
      name: cleanName,
      email: cleanEmail,
      password: password,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
      role: 'standard_user',
      provider: 'local',
      active: true,
      createdAt: new Date().toISOString(),
      onboardingCompleted: false
    };

    this.saveRegisteredUser(newUser);

    const jwt = generateMockJWT(newUser);
    const session = {
      user: newUser,
      jwt,
      authMethod: 'email:signup',
      authenticatedAt: new Date().toISOString()
    };

    this.saveSession(session);
    return session;
  },

  // Password reset request
  async requestPasswordReset(email) {
    await new Promise((res) => setTimeout(res, 400));
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    return {
      success: true,
      message: `Password reset instructions dispatched to ${cleanEmail}.`
    };
  },

  listManagedUsers() {
    this.ensureSeededAdmin();
    return this.getRegisteredUsers().map(({ password, ...user }) => user);
  },

  setUserActive(userId, active) {
    this.ensureSeededAdmin();
    const users = this.getRegisteredUsers();
    const index = users.findIndex((user) => user.id === userId);

    if (index === -1) {
      throw new Error('User account could not be found.');
    }
    if (userId === DEMO_ADMIN_ID) {
      throw new Error('The seeded admin account cannot be deactivated.');
    }

    users[index] = { ...users[index], active: Boolean(active) };
    localStorage.setItem(USERS_DB_KEY, JSON.stringify(users));
    const { password, ...updatedUser } = users[index];
    return updatedUser;
  },

  deleteManagedUser(userId) {
    this.ensureSeededAdmin();
    if (userId === DEMO_ADMIN_ID) {
      throw new Error('The seeded admin account cannot be deleted.');
    }

    const users = this.getRegisteredUsers();
    const remaining = users.filter((user) => user.id !== userId);
    if (remaining.length === users.length) {
      throw new Error('User account could not be found.');
    }

    localStorage.setItem(USERS_DB_KEY, JSON.stringify(remaining));
    return true;
  }
};
