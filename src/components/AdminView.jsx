import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { adminService } from '../services/adminService';
import { DEMO_ADMIN_ID } from '../services/authService';
import { mediaURL } from '../utils/ui';
import { toast } from '../utils/toast';
import { Avatar, Icon } from './Icons';

const ROLE_OPTIONS = [
  { value: 'standard_user', label: 'Standard User' },
  { value: 'verified_user', label: 'Verified User' },
  { value: 'moderator', label: 'Moderator' }
];

function roleBadgeClass(role) {
  if (role === 'admin') return 'text-bg-primary';
  if (role === 'moderator') return 'text-bg-warning';
  if (role === 'verified_user') return 'text-bg-info';
  return 'text-bg-secondary';
}

function actionBadgeClass(action) {
  if (!action) return 'text-bg-secondary';
  if (action.includes('delete') || action.includes('deactivate')) return 'text-bg-danger';
  if (action.includes('create') || action.includes('activate')) return 'text-bg-success';
  if (action.includes('broadcast')) return 'text-bg-info';
  return 'text-bg-warning';
}

export function AdminView({ user, onSignOut }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Core data states
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [posts, setPosts] = useState([]);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [stories, setStories] = useState([]);
  const [events, setEvents] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // Users tab state
  const [userQuery, setUserQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [userSort, setUserSort] = useState('newest');
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'standard_user'
  });
  const [creatingUser, setCreatingUser] = useState(false);

  // Moderation tab state
  const [modSection, setModSection] = useState('posts');
  const [modQuery, setModQuery] = useState('');
  const [expandedPostIds, setExpandedPostIds] = useState({});

  // Events & Broadcast tab state
  const [announcementForm, setAnnouncementForm] = useState({ target: 'all', message: '' });
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [lastBroadcast, setLastBroadcast] = useState(null);
  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    location: '',
    tag: 'Community'
  });
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Audit Log tab state
  const [auditQuery, setAuditQuery] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('all');

  const loadAll = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [ov, usrList, postBundle, storyList, eventList, logs] = await Promise.all([
        adminService.getOverview(),
        adminService.listUsers(),
        adminService.listPosts(),
        adminService.listStories(),
        adminService.listEvents(),
        adminService.getAuditLogs(100)
      ]);
      setOverview(ov);
      setUsers(usrList || []);
      setPosts(postBundle?.posts || []);
      setCommentsByPost(postBundle?.commentsByPost || {});
      setStories(storyList || []);
      setEvents(eventList || []);
      setAuditLogs(logs || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load admin portal data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Filtered & sorted users
  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    const list = users.filter((u) => {
      if (q && !(u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q))) {
        return false;
      }
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      const isActive = u.active !== false;
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (userSort === 'name') return (a.name || '').localeCompare(b.name || '');
      if (userSort === 'oldest') return (a.createdAt || '').localeCompare(b.createdAt || '');
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
  }, [users, userQuery, roleFilter, statusFilter, userSort]);

  const selectableVisibleIds = useMemo(
    () => filteredUsers.filter((u) => u.id !== DEMO_ADMIN_ID).map((u) => u.id),
    [filteredUsers]
  );

  const allVisibleSelected =
    selectableVisibleIds.length > 0 &&
    selectableVisibleIds.every((id) => selectedUserIds.includes(id));

  // Filtered moderation posts & stories
  const filteredPosts = useMemo(() => {
    const q = modQuery.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.content?.toLowerCase().includes(q) ||
        p.author?.name?.toLowerCase().includes(q) ||
        (p.tags || []).some((t) => t.toLowerCase().includes(q))
    );
  }, [posts, modQuery]);

  const filteredStories = useMemo(() => {
    const q = modQuery.trim().toLowerCase();
    if (!q) return stories;
    return stories.filter(
      (s) =>
        s.userName?.toLowerCase().includes(q) ||
        s.caption?.toLowerCase().includes(q)
    );
  }, [stories, modQuery]);

  // Filtered audit logs
  const auditActions = useMemo(
    () => Array.from(new Set(auditLogs.map((l) => l.action))).sort(),
    [auditLogs]
  );

  const filteredAuditLogs = useMemo(() => {
    const q = auditQuery.trim().toLowerCase();
    return auditLogs.filter((entry) => {
      if (auditActionFilter !== 'all' && entry.action !== auditActionFilter) return false;
      if (!q) return true;
      return (
        entry.action?.toLowerCase().includes(q) ||
        entry.adminName?.toLowerCase().includes(q) ||
        entry.targetId?.toLowerCase().includes(q) ||
        entry.details?.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditQuery, auditActionFilter]);

  const maxActivity = useMemo(() => {
    const counts = (overview?.recentActivity || []).map((d) => d.count || 0);
    return Math.max(1, ...counts);
  }, [overview]);

  // Handlers: Users
  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedUserIds((prev) => prev.filter((id) => !selectableVisibleIds.includes(id)));
    } else {
      setSelectedUserIds((prev) => Array.from(new Set([...prev, ...selectableVisibleIds])));
    }
  };

  const handleToggleSelectUser = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleBulkActive = async (nextActive) => {
    if (selectedUserIds.length === 0) return;
    try {
      await Promise.all(
        selectedUserIds.map((id) => adminService.setUserActive(id, nextActive))
      );
      toast(
        `${selectedUserIds.length} account(s) marked ${nextActive ? 'active' : 'deactivated'}.`,
        'success'
      );
      setSelectedUserIds([]);
      await loadAll();
    } catch (err) {
      toast(err.message || 'Bulk update failed.', 'error');
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreatingUser(true);
    try {
      const created = await adminService.createUser(newUserForm);
      toast(`Created user ${created.name}.`, 'success');
      setNewUserForm({ name: '', email: '', password: '', role: 'standard_user' });
      setShowCreateUser(false);
      await loadAll();
    } catch (err) {
      toast(err.message || 'Could not create user.', 'error');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleRoleChange = async (managedUser, nextRole) => {
    if (nextRole === managedUser.role) return;
    try {
      await adminService.updateUserRole(managedUser.id, nextRole);
      toast(`${managedUser.name} is now ${nextRole.replace('_', ' ')}.`, 'success');
      await loadAll();
    } catch (err) {
      toast(err.message || 'Could not update role.', 'error');
    }
  };

  const handleToggleActive = async (managedUser) => {
    try {
      const nextState = managedUser.active === false;
      await adminService.setUserActive(managedUser.id, nextState);
      toast(`${managedUser.name} is now ${nextState ? 'active' : 'deactivated'}.`, 'success');
      await loadAll();
    } catch (err) {
      toast(err.message || 'Could not update this account.', 'error');
    }
  };

  const handleDeleteUser = async (managedUser) => {
    if (!window.confirm(`Delete ${managedUser.name}'s account?`)) return;
    try {
      await adminService.deleteUser(managedUser.id);
      setSelectedUserIds((prev) => prev.filter((id) => id !== managedUser.id));
      toast(`${managedUser.name}'s account was deleted.`, 'success');
      await loadAll();
    } catch (err) {
      toast(err.message || 'Could not delete this account.', 'error');
    }
  };

  // Handlers: Moderation
  const handleDeletePost = async (post) => {
    if (!window.confirm(`Remove post by ${post.author?.name || 'user'}?`)) return;
    try {
      await adminService.deletePost(post.id);
      toast('Post removed from platform.', 'success');
      await loadAll();
    } catch (err) {
      toast(err.message || 'Could not remove post.', 'error');
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await adminService.deleteComment(commentId);
      toast('Comment removed.', 'success');
      await loadAll();
    } catch (err) {
      toast(err.message || 'Could not remove comment.', 'error');
    }
  };

  const handleDeleteStory = async (story) => {
    if (!window.confirm(`Remove story slide by ${story.userName}?`)) return;
    try {
      await adminService.deleteStory(story.id);
      toast('Story slide removed.', 'success');
      await loadAll();
    } catch (err) {
      toast(err.message || 'Could not remove story.', 'error');
    }
  };

  // Handlers: Events & Announcements
  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!announcementForm.message.trim()) {
      toast('Enter an announcement message first.', 'error');
      return;
    }
    setSendingAnnouncement(true);
    try {
      const res = await adminService.broadcastAnnouncement(announcementForm);
      setLastBroadcast(res);
      setAnnouncementForm((prev) => ({ ...prev, message: '' }));
      toast(`Announcement sent to ${res.sentCount} user(s).`, 'success');
      await loadAll();
    } catch (err) {
      toast(err.message || 'Broadcast failed.', 'error');
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleCreateEvent = async (e) => {
    e.preventDefault();
    setCreatingEvent(true);
    try {
      const created = await adminService.createEvent(eventForm);
      toast(`Published event "${created.title}".`, 'success');
      setEventForm({ title: '', date: '', location: '', tag: 'Community' });
      await loadAll();
    } catch (err) {
      toast(err.message || 'Could not create event.', 'error');
    } finally {
      setCreatingEvent(false);
    }
  };

  const handleDeleteEvent = async (evt) => {
    if (!window.confirm(`Delete event "${evt.title}"?`)) return;
    try {
      await adminService.deleteEvent(evt.id);
      toast('Event deleted.', 'success');
      await loadAll();
    } catch (err) {
      toast(err.message || 'Could not delete event.', 'error');
    }
  };

  const metrics = overview?.metrics || {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.active !== false).length,
    inactiveUsers: users.filter((u) => u.active === false).length,
    verifiedUsers: users.filter((u) => u.role !== 'standard_user').length,
    onlineUsers: 0,
    connectedSockets: 0,
    totalPosts: posts.length,
    totalComments: 0,
    totalLikes: 0,
    totalMessages: 0,
    activeStories: stories.length,
    totalEvents: events.length,
    totalRsvps: 0,
    unreadNotifications: 0
  };

  return (
    <main className="admin-page container-xl">
      <header className="admin-header d-flex align-items-center justify-content-between gap-3 flex-wrap">
        <div>
          <p className="admin-eyebrow">SocialConnect Operations</p>
          <h1>Admin Command Center</h1>
          <p className="muted">
            Monitor platform health, manage user access, moderate posts &amp; stories, publish events, and audit actions.
          </p>
        </div>
        <div className="admin-header-actions d-flex align-items-center gap-2 flex-wrap">
          <span className="badge rounded-pill text-bg-success d-inline-flex align-items-center gap-1 px-3 py-2">
            <Icon name="activity" size={14} />
            {metrics.onlineUsers} online ({metrics.connectedSockets} ws)
          </span>
          <span className="admin-identity badge rounded-pill px-3 py-2">{user.name}</span>
          <button
            type="button"
            className="btn btn-outline-info btn-sm"
            disabled={refreshing}
            onClick={() => loadAll(true)}
          >
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </button>
          <button type="button" className="btn btn-outline-secondary secondary-button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <nav className="admin-nav nav nav-pills gap-2 mb-4" aria-label="Admin sections">
        <button
          type="button"
          className={`nav-link d-inline-flex align-items-center gap-2 ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Icon name="activity" size={15} />
          Overview
        </button>
        <button
          type="button"
          className={`nav-link d-inline-flex align-items-center gap-2 ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Icon name="user" size={15} />
          Users
          <span className="badge rounded-pill text-bg-dark">{users.length}</span>
        </button>
        <button
          type="button"
          className={`nav-link d-inline-flex align-items-center gap-2 ${activeTab === 'moderation' ? 'active' : ''}`}
          onClick={() => setActiveTab('moderation')}
        >
          <Icon name="shield" size={15} />
          Moderation
          <span className="badge rounded-pill text-bg-dark">{posts.length + stories.length}</span>
        </button>
        <button
          type="button"
          className={`nav-link d-inline-flex align-items-center gap-2 ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <Icon name="calendar" size={15} />
          Events &amp; Broadcast
          <span className="badge rounded-pill text-bg-dark">{events.length}</span>
        </button>
        <button
          type="button"
          className={`nav-link d-inline-flex align-items-center gap-2 ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <Icon name="list" size={15} />
          Audit Log
          <span className="badge rounded-pill text-bg-dark">{auditLogs.length}</span>
        </button>
      </nav>

      {error && (
        <div className="alert alert-danger auth-error-banner mb-4" role="alert">
          {error}
        </div>
      )}

      {loading && <p className="muted">Loading Admin Command Center…</p>}

      {!loading && activeTab === 'overview' && (
        <section className="d-flex flex-column gap-4" aria-label="Platform overview">
          <div className="admin-kpi-grid">
            <div className="admin-stat-card">
              <span className="admin-eyebrow">Registered Users</span>
              <strong>{metrics.totalUsers}</strong>
              <span className="muted">
                {metrics.activeUsers} active · {metrics.inactiveUsers} deactivated
              </span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-eyebrow">Verified &amp; Staff</span>
              <strong>{metrics.verifiedUsers}</strong>
              <span className="muted">verified creators, moderators &amp; admins</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-eyebrow">Posts &amp; Engagement</span>
              <strong>{metrics.totalPosts}</strong>
              <span className="muted">
                {metrics.totalLikes} likes · {metrics.totalComments} comments
              </span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-eyebrow">Active 24h Stories</span>
              <strong>{metrics.activeStories}</strong>
              <span className="muted">live ephemeral slides across creators</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-eyebrow">Direct Messages</span>
              <strong>{metrics.totalMessages}</strong>
              <span className="muted">{metrics.unreadNotifications} unread notifications</span>
            </div>
            <div className="admin-stat-card">
              <span className="admin-eyebrow">Community Events</span>
              <strong>{metrics.totalEvents}</strong>
              <span className="muted">{metrics.totalRsvps} total RSVPs</span>
            </div>
          </div>

          <div className="row g-3">
            <div className="col-lg-7">
              <section className="admin-panel h-100">
                <div className="d-flex align-items-center justify-content-between mb-3">
                  <div>
                    <h2 className="h5 mb-1">7-Day Platform Activity</h2>
                    <p className="muted small">Daily interactions logged across posts, comments, likes, and DMs.</p>
                  </div>
                  <Icon name="trending" size={18} />
                </div>
                <div className="d-flex flex-column gap-2">
                  {(overview?.recentActivity || []).map((day) => (
                    <div key={day.day} className="admin-activity-row">
                      <span className="admin-mono small">{day.day}</span>
                      <progress className="admin-meter" value={day.count} max={maxActivity} />
                      <span className="badge text-bg-secondary admin-mono">{day.count}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="col-lg-5">
              <section className="admin-panel h-100 d-flex flex-column gap-3">
                <div>
                  <h2 className="h5 mb-2">Role &amp; Auth Breakdown</h2>
                  <div className="d-flex flex-wrap gap-2">
                    {Object.entries(overview?.roleBreakdown || {}).map(([role, count]) => (
                      <span key={role} className={`badge rounded-pill ${roleBadgeClass(role)} px-3 py-2`}>
                        {role}: {count}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="h6 muted mb-2">Identity Providers</h3>
                  <div className="d-flex flex-wrap gap-2">
                    {Object.entries(overview?.providerBreakdown || {}).map(([prov, count]) => (
                      <span key={prov} className="badge rounded-pill text-bg-dark border border-secondary px-3 py-2">
                        {prov}: {count}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="h6 muted mb-2">Top Post Topics</h3>
                  <div className="d-flex flex-wrap gap-2">
                    {(overview?.topTags || []).length === 0 && (
                      <span className="muted small">No topic tags yet.</span>
                    )}
                    {(overview?.topTags || []).map((item) => (
                      <span key={item.tag} className="badge rounded-pill text-bg-secondary px-3 py-2">
                        #{item.tag} ({item.count})
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="admin-panel">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <div>
                <h2 className="h5 mb-1">Recent Admin Actions</h2>
                <p className="muted small">Latest administrative changes recorded in SQLite.</p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setActiveTab('audit')}
              >
                View full audit log
              </button>
            </div>
            {(overview?.recentAuditLogs || []).length === 0 ? (
              <p className="muted small">No admin actions recorded yet. Changes to users, posts, events, or announcements appear here.</p>
            ) : (
              <div className="d-flex flex-column gap-2">
                {(overview?.recentAuditLogs || []).slice(0, 5).map((log) => (
                  <div key={log.id} className="admin-audit-preview d-flex align-items-center justify-content-between gap-3 flex-wrap">
                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      <span className={`badge ${actionBadgeClass(log.action)}`}>{log.action}</span>
                      <span>{log.details}</span>
                    </div>
                    <span className="muted small">{log.time}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </section>
      )}

      {!loading && activeTab === 'users' && (
        <section className="admin-users-card" aria-labelledby="admin-users-heading">
          <div className="admin-users-toolbar d-flex align-items-center justify-content-between gap-3 flex-wrap">
            <div>
              <h2 id="admin-users-heading">User management</h2>
              <p className="muted">Create accounts, assign roles, bulk toggle access, or export CSV.</p>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1"
                onClick={() => setShowCreateUser((v) => !v)}
              >
                <Icon name="plus" size={14} />
                {showCreateUser ? 'Close form' : 'Add user'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  adminService.exportUsersCsv(filteredUsers);
                  toast(`Exported ${filteredUsers.length} user(s) to CSV.`, 'success');
                }}
              >
                Export CSV
              </button>
            </div>
          </div>

          {showCreateUser && (
            <form className="admin-create-panel mt-3" onSubmit={handleCreateUser}>
              <h3 className="h6 mb-3">Create New User Account</h3>
              <div className="row g-2">
                <div className="col-md-3">
                  <input
                    className="form-control admin-search w-100"
                    type="text"
                    required
                    placeholder="Full name"
                    value={newUserForm.name}
                    onChange={(e) => setNewUserForm((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="col-md-3">
                  <input
                    className="form-control admin-search w-100"
                    type="email"
                    required
                    placeholder="Email address"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="col-md-2">
                  <input
                    className="form-control admin-search w-100"
                    type="password"
                    required
                    minLength={6}
                    placeholder="Password (6+)"
                    value={newUserForm.password}
                    onChange={(e) => setNewUserForm((p) => ({ ...p, password: e.target.value }))}
                  />
                </div>
                <div className="col-md-2">
                  <select
                    className="form-select admin-select"
                    aria-label="New user role"
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm((p) => ({ ...p, role: e.target.value }))}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2 d-grid">
                  <button type="submit" className="btn btn-success" disabled={creatingUser}>
                    {creatingUser ? 'Creating…' : 'Create User'}
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="row g-2 mt-3">
            <div className="col-md-5">
              <input
                className="form-control admin-search w-100"
                type="search"
                value={userQuery}
                onChange={(event) => setUserQuery(event.target.value)}
                placeholder="Search by name, handle, or email…"
                aria-label="Search users by name or email"
              />
            </div>
            <div className="col-sm-4 col-md-2">
              <select
                className="form-select admin-select"
                aria-label="Filter by role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="moderator">Moderator</option>
                <option value="verified_user">Verified</option>
                <option value="standard_user">Standard</option>
              </select>
            </div>
            <div className="col-sm-4 col-md-2">
              <select
                className="form-select admin-select"
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active only</option>
                <option value="inactive">Deactivated</option>
              </select>
            </div>
            <div className="col-sm-4 col-md-3">
              <select
                className="form-select admin-select"
                aria-label="Sort users"
                value={userSort}
                onChange={(e) => setUserSort(e.target.value)}
              >
                <option value="newest">Sort: Newest first</option>
                <option value="oldest">Sort: Oldest first</option>
                <option value="name">Sort: Name (A–Z)</option>
              </select>
            </div>
          </div>

          <div className="admin-bulk-bar d-flex align-items-center justify-content-between gap-2 flex-wrap mt-3">
            <label className="form-check-label d-inline-flex align-items-center gap-2 small">
              <input
                type="checkbox"
                className="form-check-input"
                checked={allVisibleSelected}
                onChange={handleToggleSelectAll}
              />
              Select all non-admin ({selectableVisibleIds.length})
            </label>
            {selectedUserIds.length > 0 && (
              <div className="d-flex align-items-center gap-2">
                <span className="small text-info">{selectedUserIds.length} selected</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={() => handleBulkActive(true)}
                >
                  Activate selected
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-warning"
                  onClick={() => handleBulkActive(false)}
                >
                  Deactivate selected
                </button>
              </div>
            )}
          </div>

          {filteredUsers.length === 0 ? (
            <p className="muted admin-empty-state">No users match your filters.</p>
          ) : (
            <div className="admin-user-list">
              {filteredUsers.map((managedUser) => {
                const protectedAdmin = managedUser.id === DEMO_ADMIN_ID;
                const active = managedUser.active !== false;
                const checked = selectedUserIds.includes(managedUser.id);
                return (
                  <article
                    className="admin-user-row d-flex align-items-center justify-content-between gap-3"
                    key={managedUser.id}
                  >
                    <div className="d-flex align-items-center gap-3 flex-grow-1 min-w-0">
                      <input
                        type="checkbox"
                        className="form-check-input flex-shrink-0"
                        disabled={protectedAdmin}
                        checked={checked}
                        aria-label={`Select ${managedUser.name}`}
                        onChange={() => handleToggleSelectUser(managedUser.id)}
                      />
                      <Avatar user={managedUser} className="admin-avatar" />
                      <div className="admin-user-details">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <strong>{managedUser.name}</strong>
                          <span className="badge rounded-pill text-bg-dark border border-secondary">
                            {managedUser.provider || 'local'}
                          </span>
                        </div>
                        <span className="muted small">
                          {managedUser.email}
                          {managedUser.username ? ` · @${managedUser.username}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="d-flex align-items-center gap-2 flex-wrap">
                      {protectedAdmin ? (
                        <span className="admin-role badge rounded-pill text-bg-primary">admin (protected)</span>
                      ) : (
                        <select
                          className="form-select form-select-sm admin-select-inline"
                          aria-label={`Role for ${managedUser.name}`}
                          value={managedUser.role || 'standard_user'}
                          onChange={(e) => handleRoleChange(managedUser, e.target.value)}
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      )}

                      <span className={`admin-status badge rounded-pill ${active ? 'text-bg-success' : 'text-bg-danger'}`}>
                        {active ? 'Active' : 'Deactivated'}
                      </span>

                      <div className="admin-user-actions d-flex align-items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm secondary-button"
                          disabled={protectedAdmin}
                          onClick={() => handleToggleActive(managedUser)}
                        >
                          {active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm admin-delete-button"
                          disabled={protectedAdmin}
                          onClick={() => handleDeleteUser(managedUser)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}

      {!loading && activeTab === 'moderation' && (
        <section className="admin-panel" aria-label="Content moderation">
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
            <div>
              <h2 className="h4 mb-1">Content Moderation Queue</h2>
              <p className="muted small">Inspect posts, nested comments, and active 24-hour story slides.</p>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="btn-group btn-group-sm" role="group" aria-label="Moderation content type">
                <button
                  type="button"
                  className={`btn ${modSection === 'posts' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setModSection('posts')}
                >
                  Posts ({posts.length})
                </button>
                <button
                  type="button"
                  className={`btn ${modSection === 'stories' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setModSection('stories')}
                >
                  Stories ({stories.length})
                </button>
              </div>
              <input
                type="search"
                className="form-control admin-search"
                placeholder={`Search ${modSection}…`}
                value={modQuery}
                onChange={(e) => setModQuery(e.target.value)}
              />
            </div>
          </div>

          {modSection === 'posts' && (
            <div className="d-flex flex-column gap-3">
              {filteredPosts.length === 0 ? (
                <p className="muted">No posts match your search.</p>
              ) : (
                filteredPosts.map((post) => {
                  const postComments = commentsByPost[post.id] || [];
                  const expanded = Boolean(expandedPostIds[post.id]);
                  return (
                    <article key={post.id} className="admin-mod-card">
                      <div className="d-flex align-items-start justify-content-between gap-3 flex-wrap">
                        <div className="d-flex align-items-center gap-2">
                          <Avatar user={post.author} className="admin-avatar" />
                          <div>
                            <strong>{post.author?.name || 'User'}</strong>
                            <div className="muted small">
                              @{post.author?.handle || 'member'} · {post.timestamp}
                            </div>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <span className="badge text-bg-secondary">{post.likes} likes</span>
                          <span className="badge text-bg-secondary">{post.comments} comments</span>
                          {postComments.length > 0 && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-info"
                              onClick={() =>
                                setExpandedPostIds((prev) => ({
                                  ...prev,
                                  [post.id]: !prev[post.id]
                                }))
                              }
                            >
                              {expanded ? 'Hide comments' : `Review comments (${postComments.length})`}
                            </button>
                          )}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger admin-delete-button"
                            onClick={() => handleDeletePost(post)}
                          >
                            Remove post
                          </button>
                        </div>
                      </div>

                      <p className="mt-2 mb-2">{post.content || <em>(Image post with no caption)</em>}</p>

                      {post.image && (
                        <img
                          src={mediaURL(post.image)}
                          alt="Post attachment"
                          className="admin-mod-thumb mb-2"
                          loading="lazy"
                        />
                      )}

                      {(post.tags || []).length > 0 && (
                        <div className="d-flex flex-wrap gap-1">
                          {post.tags.map((tag) => (
                            <span key={tag} className="badge text-bg-dark border border-secondary">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {expanded && postComments.length > 0 && (
                        <div className="admin-comments-box mt-3 pt-2 border-top border-secondary-subtle d-flex flex-column gap-2">
                          {postComments.map((c) => (
                            <div key={c.id} className="d-flex align-items-center justify-content-between gap-2">
                              <div className="small">
                                <strong>{c.author?.name || 'User'}</strong>: {c.content}{' '}
                                <span className="muted">({c.timestamp})</span>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteComment(c.id)}
                              >
                                Delete
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          )}

          {modSection === 'stories' && (
            <div className="row g-3">
              {filteredStories.length === 0 ? (
                <div className="col-12">
                  <p className="muted">No active stories found.</p>
                </div>
              ) : (
                filteredStories.map((story) => (
                  <div key={story.id} className="col-sm-6 col-lg-4">
                    <article className="admin-mod-card h-100 d-flex flex-column justify-content-between gap-2">
                      <div>
                        <img
                          src={mediaURL(story.image)}
                          alt={story.caption || `Story by ${story.userName}`}
                          className="admin-story-thumb mb-2"
                          loading="lazy"
                        />
                        <div className="d-flex align-items-center justify-content-between gap-2">
                          <strong>{story.userName}</strong>
                          <span className="muted small">{story.time}</span>
                        </div>
                        <p className="small muted mt-1">{story.caption || 'No caption'}</p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-danger admin-delete-button w-100"
                        onClick={() => handleDeleteStory(story)}
                      >
                        Remove story slide
                      </button>
                    </article>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      )}

      {!loading && activeTab === 'events' && (
        <section className="row g-4" aria-label="Events and announcements">
          <div className="col-lg-5">
            <section className="admin-panel h-100">
              <div className="d-flex align-items-center gap-2 mb-2">
                <Icon name="bell" size={18} />
                <h2 className="h4 mb-0">Broadcast Announcement</h2>
              </div>
              <p className="muted small mb-3">
                Deliver persistent platform-wide notifications and live WebSocket alerts directly to members.
              </p>

              <form onSubmit={handleBroadcast} className="d-flex flex-column gap-3">
                <div>
                  <label htmlFor="broadcast-target" className="form-label small muted">
                    Target audience
                  </label>
                  <select
                    id="broadcast-target"
                    className="form-select admin-select"
                    value={announcementForm.target}
                    onChange={(e) => setAnnouncementForm((p) => ({ ...p, target: e.target.value }))}
                  >
                    <option value="all">All registered users</option>
                    <option value="active">Active users only</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="broadcast-message" className="form-label small muted">
                    Announcement message
                  </label>
                  <textarea
                    id="broadcast-message"
                    rows={4}
                    maxLength={240}
                    className="form-control admin-textarea"
                    placeholder="Write an important platform update, maintenance notice, or event alert…"
                    value={announcementForm.message}
                    onChange={(e) => setAnnouncementForm((p) => ({ ...p, message: e.target.value }))}
                  />
                  <div className="text-end muted small mt-1">
                    {announcementForm.message.length}/240
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sendingAnnouncement}
                >
                  {sendingAnnouncement ? 'Sending broadcast…' : 'Send announcement'}
                </button>
              </form>

              {lastBroadcast && (
                <div className="alert alert-info mt-3 mb-0 small" role="status">
                  Delivered to <strong>{lastBroadcast.sentCount}</strong> user(s) ({lastBroadcast.target}): &ldquo;{lastBroadcast.message}&rdquo;
                </div>
              )}
            </section>
          </div>

          <div className="col-lg-7">
            <section className="admin-panel h-100">
              <div className="d-flex align-items-center gap-2 mb-2">
                <Icon name="calendar" size={18} />
                <h2 className="h4 mb-0">Community Events Manager</h2>
              </div>
              <p className="muted small mb-3">
                Create official SocialConnect events or remove outdated listings.
              </p>

              <form onSubmit={handleCreateEvent} className="admin-create-panel mb-4">
                <div className="row g-2">
                  <div className="col-md-6">
                    <input
                      type="text"
                      required
                      className="form-control admin-search w-100"
                      placeholder="Event title"
                      value={eventForm.title}
                      onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <input
                      type="text"
                      required
                      className="form-control admin-search w-100"
                      placeholder="Date & time (e.g. Nov 30, 2026 · 6:00 PM UTC)"
                      value={eventForm.date}
                      onChange={(e) => setEventForm((p) => ({ ...p, date: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-6">
                    <input
                      type="text"
                      required
                      className="form-control admin-search w-100"
                      placeholder="Location or Stream URL"
                      value={eventForm.location}
                      onChange={(e) => setEventForm((p) => ({ ...p, location: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3">
                    <input
                      type="text"
                      className="form-control admin-search w-100"
                      placeholder="Tag"
                      value={eventForm.tag}
                      onChange={(e) => setEventForm((p) => ({ ...p, tag: e.target.value }))}
                    />
                  </div>
                  <div className="col-md-3 d-grid">
                    <button type="submit" className="btn btn-success" disabled={creatingEvent}>
                      {creatingEvent ? 'Adding…' : 'Publish'}
                    </button>
                  </div>
                </div>
              </form>

              <div className="d-flex flex-column gap-2">
                {events.length === 0 ? (
                  <p className="muted">No events scheduled.</p>
                ) : (
                  events.map((evt) => (
                    <article
                      key={evt.id}
                      className="admin-mod-card d-flex align-items-center justify-content-between gap-3 flex-wrap"
                    >
                      <div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <strong>{evt.title}</strong>
                          <span className="badge text-bg-info">{evt.tag}</span>
                        </div>
                        <div className="muted small mt-1">
                          {evt.date} · {evt.location}
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="badge rounded-pill text-bg-secondary">
                          {evt.attendees} RSVPs
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger admin-delete-button"
                          onClick={() => handleDeleteEvent(evt)}
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      )}

      {!loading && activeTab === 'audit' && (
        <section className="admin-panel" aria-label="Admin audit log">
          <div className="d-flex align-items-center justify-content-between gap-3 flex-wrap mb-3">
            <div>
              <h2 className="h4 mb-1">Admin Audit Trail</h2>
              <p className="muted small">Immutable record of administrative operations.</p>
            </div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <select
                className="form-select admin-select"
                aria-label="Filter by action type"
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
              >
                <option value="all">All actions</option>
                {auditActions.map((act) => (
                  <option key={act} value={act}>
                    {act}
                  </option>
                ))}
              </select>
              <input
                type="search"
                className="form-control admin-search"
                placeholder="Search audit log…"
                value={auditQuery}
                onChange={(e) => setAuditQuery(e.target.value)}
              />
            </div>
          </div>

          {filteredAuditLogs.length === 0 ? (
            <p className="muted">No audit log entries match your filter.</p>
          ) : (
            <div className="table-responsive">
              <table className="table table-dark table-hover align-middle admin-audit-table mb-0">
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Admin</th>
                    <th scope="col">Action</th>
                    <th scope="col">Target</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAuditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="small text-nowrap muted">{log.time}</td>
                      <td className="small">{log.adminName}</td>
                      <td>
                        <span className={`badge ${actionBadgeClass(log.action)}`}>{log.action}</span>
                      </td>
                      <td className="small admin-mono">
                        {log.targetType}:{log.targetId}
                      </td>
                      <td className="small">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
