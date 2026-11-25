const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const SESSION_KEY = 'scp_auth_session';

let refreshPromise = null;

async function refreshStoredToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      const refreshToken = session?.jwt?.refreshToken;
      if (!refreshToken) return null;

      const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (!res.ok) return null;
      const data = await res.json();
      const updated = { ...session, user: data.user, jwt: data.jwt };
      localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
      return data.jwt?.accessToken || null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function apiRequest(path, { method = 'GET', body, token, allowRefresh = true } = {}) {
  const headers = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (networkErr) {
    const err = new Error(networkErr?.message || 'Backend unavailable');
    err.isNetworkError = true;
    throw err;
  }

  if (response.status === 401 && token && allowRefresh && !path.startsWith('/api/auth/')) {
    const freshToken = await refreshStoredToken();
    if (freshToken) {
      return apiRequest(path, { method, body, token: freshToken, allowRefresh: false });
    }
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    if (
      [502, 503, 504].includes(response.status) ||
      (!data && response.status >= 500) ||
      (!isJson && [404, 405].includes(response.status)) ||
      (response.status === 405 && !data?.detail)
    ) {
      const proxyErr = new Error('Backend proxy unavailable');
      proxyErr.isNetworkError = true;
      proxyErr.status = response.status;
      throw proxyErr;
    }
    const err = new Error(data?.detail || data?.message || `Request failed (${response.status})`);
    err.status = response.status;
    throw err;
  }

  if (response.status !== 204 && !isJson) {
    const htmlErr = new Error('Backend API unavailable');
    htmlErr.isNetworkError = true;
    htmlErr.status = response.status;
    throw htmlErr;
  }

  return data;
}

export const apiService = {
  signup: (payload) => apiRequest('/api/auth/signup', { method: 'POST', body: payload }),
  signin: (payload) => apiRequest('/api/auth/signin', { method: 'POST', body: payload }),
  oauth: (payload) => apiRequest('/api/auth/oauth', { method: 'POST', body: payload }),
  refreshToken: (refreshToken) =>
    apiRequest('/api/auth/refresh', { method: 'POST', body: { refreshToken }, allowRefresh: false }),
  logout: (token) => apiRequest('/api/auth/logout', { method: 'POST', token, allowRefresh: false }),
  resetPassword: (email) => apiRequest('/api/auth/reset-password', { method: 'POST', body: { email } }),
  updateProfile: (fields, token) => apiRequest('/api/auth/profile', { method: 'PATCH', body: fields, token }),

  getAdminOverview: (token) => apiRequest('/api/admin/overview', { token }),
  listAdminUsers: (token) => apiRequest('/api/admin/users', { token }),
  createAdminUser: (payload, token) =>
    apiRequest('/api/admin/users', { method: 'POST', body: payload, token }),
  updateAdminUserRole: (userId, role, token) =>
    apiRequest(`/api/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: { role },
      token
    }),
  setAdminUserActive: (userId, active, token) =>
    apiRequest(`/api/admin/users/${encodeURIComponent(userId)}/active`, {
      method: 'PATCH',
      body: { active },
      token
    }),
  deleteAdminUser: (userId, token) =>
    apiRequest(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      token
    }),
  listAdminPosts: (token) => apiRequest('/api/admin/posts', { token }),
  deleteAdminPost: (postId, token) =>
    apiRequest(`/api/admin/posts/${encodeURIComponent(postId)}`, {
      method: 'DELETE',
      token
    }),
  deleteAdminComment: (commentId, token) =>
    apiRequest(`/api/admin/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      token
    }),
  listAdminStories: (token) => apiRequest('/api/admin/stories', { token }),
  deleteAdminStory: (storyId, token) =>
    apiRequest(`/api/admin/stories/${encodeURIComponent(storyId)}`, {
      method: 'DELETE',
      token
    }),
  listAdminEvents: (token) => apiRequest('/api/admin/events', { token }),
  createAdminEvent: (payload, token) =>
    apiRequest('/api/admin/events', { method: 'POST', body: payload, token }),
  deleteAdminEvent: (eventId, token) =>
    apiRequest(`/api/admin/events/${encodeURIComponent(eventId)}`, {
      method: 'DELETE',
      token
    }),
  broadcastAdminAnnouncement: (payload, token) =>
    apiRequest('/api/admin/announcements', { method: 'POST', body: payload, token }),
  getAdminAuditLogs: (limit = 50, token) =>
    apiRequest(`/api/admin/audit-logs?limit=${encodeURIComponent(limit)}`, { token }),

  getState: (token) => apiRequest('/api/state', { token }),
  getFeed: (mode, token) => apiRequest(`/api/feed?mode=${encodeURIComponent(mode)}`, { token }),
  searchPosts: (q, token) => apiRequest(`/api/search?q=${encodeURIComponent(q)}`, { token }),

  getStories: (token) => apiRequest('/api/stories', { token }),
  createStory: (payload, token) => apiRequest('/api/stories', { method: 'POST', body: payload, token }),
  markStoryViewed: (storyId, token) =>
    apiRequest(`/api/stories/${encodeURIComponent(storyId)}/view`, { method: 'POST', token }),

  getNotifications: (token) => apiRequest('/api/notifications', { token }),
  markNotificationsRead: (token) => apiRequest('/api/notifications/read', { method: 'POST', token }),

  uploadMedia: (dataUrl, token) =>
    apiRequest('/api/media/upload', { method: 'POST', body: { dataUrl }, token }),

  createPost: (post, token) => apiRequest('/api/posts', { method: 'POST', body: post, token }),
  toggleLike: (postId, token) => apiRequest(`/api/posts/${encodeURIComponent(postId)}/like`, { method: 'POST', token }),
  toggleSave: (postId, token) => apiRequest(`/api/posts/${encodeURIComponent(postId)}/save`, { method: 'POST', token }),

  addComment: (postId, payload, token) =>
    apiRequest(`/api/posts/${encodeURIComponent(postId)}/comments`, {
      method: 'POST',
      body: payload,
      token
    }),
  toggleCommentLike: (commentId, token) =>
    apiRequest(`/api/comments/${encodeURIComponent(commentId)}/like`, { method: 'POST', token }),
  deleteComment: (commentId, token) =>
    apiRequest(`/api/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE', token }),

  toggleFollow: (targetId, token) =>
    apiRequest(`/api/users/${encodeURIComponent(targetId)}/follow`, { method: 'POST', token }),
  toggleRsvp: (eventId, token) =>
    apiRequest(`/api/events/${encodeURIComponent(eventId)}/rsvp`, { method: 'POST', token }),

  sendMessage: (payload, token) => apiRequest('/api/messages', { method: 'POST', body: payload, token }),
  markMessagesRead: (partnerId, token) =>
    apiRequest(`/api/messages/${encodeURIComponent(partnerId)}/read`, { method: 'POST', token })
};
