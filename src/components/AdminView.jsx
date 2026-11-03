import React, { useEffect, useMemo, useState } from 'react';
import { authService, DEMO_ADMIN_ID } from '../services/authService';
import { toast } from '../utils/toast';

export function AdminView({ user, onSignOut }) {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refreshUsers = () => {
    try {
      setUsers(authService.listManagedUsers());
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load user accounts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return users;
    return users.filter((managedUser) => (
      managedUser.name?.toLowerCase().includes(normalizedQuery) ||
      managedUser.email?.toLowerCase().includes(normalizedQuery)
    ));
  }, [query, users]);

  const handleToggleActive = (managedUser) => {
    try {
      const nextState = managedUser.active === false;
      authService.setUserActive(managedUser.id, nextState);
      refreshUsers();
      toast(`${managedUser.name} is now ${nextState ? 'active' : 'deactivated'}.`, 'success');
    } catch (err) {
      toast(err.message || 'Could not update this account.', 'error');
    }
  };

  const handleDelete = (managedUser) => {
    if (!window.confirm(`Delete ${managedUser.name}'s account?`)) return;

    try {
      authService.deleteManagedUser(managedUser.id);
      refreshUsers();
      toast(`${managedUser.name}'s account was deleted.`, 'success');
    } catch (err) {
      toast(err.message || 'Could not delete this account.', 'error');
    }
  };

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <p className="admin-eyebrow">Social Connectivity Platform</p>
          <h1>Admin portal</h1>
          <p className="muted">Manage registered user accounts from one protected workspace.</p>
        </div>
        <div className="admin-header-actions">
          <span className="admin-identity">{user.name}</span>
          <button type="button" className="secondary-button" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      <section className="admin-content">
        <div className="admin-stat-card">
          <span className="admin-eyebrow">Registered users</span>
          <strong>{users.length}</strong>
          <span className="muted">including the protected admin account</span>
        </div>

        <section className="admin-users-card" aria-labelledby="admin-users-heading">
          <div className="admin-users-toolbar">
            <div>
              <h2 id="admin-users-heading">User management</h2>
              <p className="muted">Search by name or email to manage access.</p>
            </div>
            <input
              className="admin-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search users"
              aria-label="Search users by name or email"
            />
          </div>

          {error && <div className="auth-error-banner" role="alert">{error}</div>}
          {loading && <p className="muted">Loading user accounts…</p>}
          {!loading && !error && filteredUsers.length === 0 && (
            <p className="muted admin-empty-state">No users match your search.</p>
          )}

          {!loading && filteredUsers.length > 0 && (
            <div className="admin-user-list">
              {filteredUsers.map((managedUser) => {
                const protectedAdmin = managedUser.id === DEMO_ADMIN_ID;
                const active = managedUser.active !== false;
                return (
                  <article className="admin-user-row" key={managedUser.id}>
                    <div className="admin-user-details">
                      <strong>{managedUser.name}</strong>
                      <span className="muted">{managedUser.email}</span>
                    </div>
                    <span className="admin-role">{managedUser.role}</span>
                    <span className={`admin-status ${active ? 'active' : 'inactive'}`}>
                      {active ? 'Active' : 'Deactivated'}
                    </span>
                    <div className="admin-user-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={protectedAdmin}
                        onClick={() => handleToggleActive(managedUser)}
                      >
                        {active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        className="admin-delete-button"
                        disabled={protectedAdmin}
                        onClick={() => handleDelete(managedUser)}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
