import { apiService } from './apiService';
import { authService, DEMO_ADMIN_ID } from './authService';
import {
  seedComments,
  seedEvents,
  seedPosts,
  stories as seedStories
} from '../data';

const AUDIT_STORAGE_KEY = 'scp_admin_audit_logs';
const EVENTS_STORAGE_KEY = 'scp_admin_events';
const REMOVED_POSTS_KEY = 'scp_admin_removed_posts';
const REMOVED_COMMENTS_KEY = 'scp_admin_removed_comments';
const REMOVED_STORIES_KEY = 'scp_admin_removed_stories';
const USERS_DB_KEY = 'scp_registered_users';

const ALLOWED_ROLES = new Set(['standard_user', 'verified_user', 'moderator']);

function getToken() {
  return authService.getStoredSession()?.jwt?.accessToken || '';
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

function appendOfflineAudit(action, targetType, targetId, details) {
  const session = authService.getStoredSession();
  const admin = session?.user || { id: DEMO_ADMIN_ID, name: 'Platform Administrator' };
  const entry = {
    id: `audit_${Math.random().toString(36).slice(2, 10)}`,
    adminId: admin.id,
    adminName: admin.name,
    action,
    targetType,
    targetId,
    details,
    createdAt: Date.now(),
    time: 'Just now',
    isoTime: new Date().toISOString()
  };
  const existing = readJson(AUDIT_STORAGE_KEY, []);
  const next = [entry, ...existing].slice(0, 100);
  writeJson(AUDIT_STORAGE_KEY, next);
  return entry;
}

function getOfflineEvents() {
  const stored = readJson(EVENTS_STORAGE_KEY, null);
  if (Array.isArray(stored)) return stored;
  writeJson(EVENTS_STORAGE_KEY, seedEvents);
  return seedEvents;
}

function getOfflinePostsBundle() {
  const removedPosts = new Set(readJson(REMOVED_POSTS_KEY, []));
  const removedComments = new Set(readJson(REMOVED_COMMENTS_KEY, []));
  const posts = seedPosts.filter((p) => !removedPosts.has(p.id));
  const commentsByPost = {};
  for (const [postId, items] of Object.entries(seedComments)) {
    if (removedPosts.has(postId)) continue;
    commentsByPost[postId] = items.filter((c) => !removedComments.has(c.id));
  }
  return { posts, commentsByPost };
}

function getOfflineStories() {
  const removed = new Set(readJson(REMOVED_STORIES_KEY, []));
  const flat = [];
  for (const group of seedStories) {
    (group.slides || []).forEach((slide, idx) => {
      const id = `${group.id}_slide_${idx}`;
      if (removed.has(id)) return;
      flat.push({
        id,
        groupId: group.id,
        userId: group.user.id,
        userName: group.user.name,
        userHandle: group.user.handle,
        userAvatar: group.user.avatar,
        image: slide.image,
        caption: slide.caption || '',
        time: slide.time || '1h'
      });
    });
  }
  return flat;
}

function escapeCsvCell(value) {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export const adminService = {
  async getOverview() {
    const token = getToken();
    if (token) {
      try {
        return await apiService.getAdminOverview(token);
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }

    const users = await authService.listManagedUsers();
    const { posts, commentsByPost } = getOfflinePostsBundle();
    const stories = getOfflineStories();
    const events = getOfflineEvents();
    const auditLogs = readJson(AUDIT_STORAGE_KEY, []);

    const roleBreakdown = {};
    const providerBreakdown = {};
    let activeUsers = 0;
    let verifiedUsers = 0;
    for (const u of users) {
      if (u.active !== false) activeUsers += 1;
      if (['verified_user', 'moderator', 'admin'].includes(u.role)) verifiedUsers += 1;
      const roleKey = u.role || 'standard_user';
      const provKey = u.provider || 'local';
      roleBreakdown[roleKey] = (roleBreakdown[roleKey] || 0) + 1;
      providerBreakdown[provKey] = (providerBreakdown[provKey] || 0) + 1;
    }

    const tagCounts = {};
    let totalLikes = 0;
    for (const p of posts) {
      totalLikes += Number(p.likes || 0);
      for (const tag of p.tags || []) {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      }
    }
    const topTags = Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }));

    const totalComments = Object.values(commentsByPost).reduce((sum, list) => sum + list.length, 0);
    const totalRsvps = events.reduce((sum, evt) => sum + Number(evt.attendees || 0), 0);

    const today = new Date();
    const recentActivity = Array.from({ length: 7 }, (_, idx) => {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - (6 - idx));
      return {
        day: d.toISOString().slice(0, 10),
        count: idx === 6 ? posts.length + totalComments : Math.max(1, (idx + 2) % 6)
      };
    });

    return {
      metrics: {
        totalUsers: users.length,
        activeUsers,
        inactiveUsers: users.length - activeUsers,
        verifiedUsers,
        onlineUsers: 3,
        connectedSockets: 0,
        totalPosts: posts.length,
        totalComments,
        totalLikes,
        totalMessages: 2,
        activeStories: stories.length,
        totalEvents: events.length,
        totalRsvps,
        unreadNotifications: 0
      },
      roleBreakdown,
      providerBreakdown,
      topTags,
      recentActivity,
      recentAuditLogs: auditLogs.slice(0, 12)
    };
  },

  async listUsers() {
    return authService.listManagedUsers();
  },

  async createUser(payload) {
    const token = getToken();
    if (token) {
      try {
        const res = await apiService.createAdminUser(payload, token);
        return res.user;
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }

    authService.ensureSeededAdmin();
    const cleanName = (payload.name || '').trim();
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    const role = (payload.role || 'standard_user').trim();
    if (cleanName.length < 2) throw new Error('Please provide a full name (at least 2 chars).');
    if (!cleanEmail.includes('@')) throw new Error('Please provide a valid email address.');
    if (!payload.password || payload.password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }
    if (!ALLOWED_ROLES.has(role)) {
      throw new Error('Role must be standard_user, verified_user, or moderator.');
    }

    const users = authService.getRegisteredUsers();
    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('An account with this email already exists.');
    }
    const created = {
      id: `usr_${Math.random().toString(36).slice(2, 8)}`,
      name: cleanName,
      email: cleanEmail,
      password: payload.password,
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
      role,
      provider: 'local',
      active: true,
      onboardingCompleted: true,
      createdAt: new Date().toISOString()
    };
    authService.saveRegisteredUser(created);
    appendOfflineAudit('user.create', 'user', created.id, `Created ${cleanEmail} (${role})`);
    const { password, ...safeUser } = created;
    return safeUser;
  },

  async updateUserRole(userId, role) {
    const token = getToken();
    if (token) {
      try {
        const res = await apiService.updateAdminUserRole(userId, role, token);
        return res.user;
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }

    if (userId === DEMO_ADMIN_ID) {
      throw new Error('The seeded admin account role cannot be modified.');
    }
    if (!ALLOWED_ROLES.has(role)) {
      throw new Error('Role must be standard_user, verified_user, or moderator.');
    }
    const users = authService.getRegisteredUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error('User account could not be found.');
    users[idx] = { ...users[idx], role };
    writeJson(USERS_DB_KEY, users);
    appendOfflineAudit('user.role_change', 'user', userId, `Changed ${users[idx].email} role to ${role}`);
    const { password, ...safeUser } = users[idx];
    return safeUser;
  },

  async setUserActive(userId, active) {
    const updated = await authService.setUserActive(userId, active);
    if (!getToken()) {
      appendOfflineAudit(
        active ? 'user.activate' : 'user.deactivate',
        'user',
        userId,
        `Set ${updated.email} active=${Boolean(active)}`
      );
    }
    return updated;
  },

  async deleteUser(userId) {
    const res = await authService.deleteManagedUser(userId);
    if (!getToken()) {
      appendOfflineAudit('user.delete', 'user', userId, `Deleted user ${userId}`);
    }
    return res;
  },

  async listPosts() {
    const token = getToken();
    if (token) {
      try {
        return await apiService.listAdminPosts(token);
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }
    return getOfflinePostsBundle();
  },

  async deletePost(postId) {
    const token = getToken();
    if (token) {
      try {
        return await apiService.deleteAdminPost(postId, token);
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }
    const removed = readJson(REMOVED_POSTS_KEY, []);
    if (!removed.includes(postId)) {
      writeJson(REMOVED_POSTS_KEY, [...removed, postId]);
    }
    appendOfflineAudit('post.delete', 'post', postId, `Removed post ${postId}`);
    return { deleted: true, postId };
  },

  async deleteComment(commentId) {
    const token = getToken();
    if (token) {
      try {
        return await apiService.deleteAdminComment(commentId, token);
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }
    const removed = readJson(REMOVED_COMMENTS_KEY, []);
    if (!removed.includes(commentId)) {
      writeJson(REMOVED_COMMENTS_KEY, [...removed, commentId]);
    }
    appendOfflineAudit('comment.delete', 'comment', commentId, `Removed comment ${commentId}`);
    return { deleted: true, commentId };
  },

  async listStories() {
    const token = getToken();
    if (token) {
      try {
        const res = await apiService.listAdminStories(token);
        return res.stories || [];
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }
    return getOfflineStories();
  },

  async deleteStory(storyId) {
    const token = getToken();
    if (token) {
      try {
        return await apiService.deleteAdminStory(storyId, token);
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }
    const removed = readJson(REMOVED_STORIES_KEY, []);
    if (!removed.includes(storyId)) {
      writeJson(REMOVED_STORIES_KEY, [...removed, storyId]);
    }
    appendOfflineAudit('story.delete', 'story', storyId, `Removed story ${storyId}`);
    return { deleted: true, storyId };
  },

  async listEvents() {
    const token = getToken();
    if (token) {
      try {
        const res = await apiService.listAdminEvents(token);
        return res.events || [];
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }
    return getOfflineEvents();
  },

  async createEvent(payload) {
    const token = getToken();
    if (token) {
      try {
        const res = await apiService.createAdminEvent(payload, token);
        return res.event;
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }
    const title = (payload.title || '').trim();
    const date = (payload.date || '').trim();
    const location = (payload.location || '').trim();
    const tag = (payload.tag || 'Community').trim();
    if (!title || !date || !location) {
      throw new Error('Title, date, and location are required for an event.');
    }
    const created = {
      id: `evt_${Math.random().toString(36).slice(2, 8)}`,
      title,
      date,
      location,
      attendees: 1,
      rsvpd: false,
      tag
    };
    const events = [created, ...getOfflineEvents()];
    writeJson(EVENTS_STORAGE_KEY, events);
    appendOfflineAudit('event.create', 'event', created.id, `Published event: ${title}`);
    return created;
  },

  async deleteEvent(eventId) {
    const token = getToken();
    if (token) {
      try {
        return await apiService.deleteAdminEvent(eventId, token);
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }
    const events = getOfflineEvents().filter((e) => e.id !== eventId);
    writeJson(EVENTS_STORAGE_KEY, events);
    appendOfflineAudit('event.delete', 'event', eventId, `Deleted event ${eventId}`);
    return { deleted: true, eventId };
  },

  async broadcastAnnouncement(payload) {
    const token = getToken();
    if (token) {
      try {
        return await apiService.broadcastAdminAnnouncement(payload, token);
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }
    const message = (payload.message || '').trim();
    if (!message) throw new Error('Announcement message is required.');
    const target = payload.target === 'active' ? 'active' : 'all';
    const users = await authService.listManagedUsers();
    const recipients = users.filter((u) => {
      if (u.id === DEMO_ADMIN_ID) return false;
      return target === 'active' ? u.active !== false : true;
    });
    appendOfflineAudit(
      'announcement.broadcast',
      'announcement',
      target,
      `Broadcast to ${recipients.length} ${target} user(s): "${message.slice(0, 60)}"`
    );
    return { sentCount: recipients.length, target, message };
  },

  async getAuditLogs(limit = 50) {
    const token = getToken();
    if (token) {
      try {
        const res = await apiService.getAdminAuditLogs(limit, token);
        return res.logs || [];
      } catch (err) {
        if (!err.isNetworkError) throw err;
      }
    }
    return readJson(AUDIT_STORAGE_KEY, []).slice(0, limit);
  },

  exportUsersCsv(users) {
    const headers = ['ID', 'Name', 'Email', 'Username', 'Role', 'Provider', 'Status', 'Created At'];
    const rows = users.map((u) => [
      u.id,
      u.name,
      u.email,
      u.username || '',
      u.role || 'standard_user',
      u.provider || 'local',
      u.active === false ? 'Deactivated' : 'Active',
      u.createdAt || ''
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map(escapeCsvCell).join(','))
      .join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `socialconnect-users-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
