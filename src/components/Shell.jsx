import React from 'react';
import { Icon, Avatar } from './Icons';
import { navigation } from '../data';

export function Shell({
  user,
  tab,
  onNavigate,
  onOpenCreatePost,
  onOpenMenu,
  onOpenCommands,
  onSignOut,
  socketConnected,
  unreadCount,
  children
}) {
  return (
    <>
      <nav className="nav-rail" aria-label="Main navigation">
        <button
          type="button"
          className="nav-logo"
          onClick={() => onNavigate('feed')}
          aria-label="Home"
        >
          <img src="/src/assets/logo.png" alt="" />
        </button>

        <div className="nav-links">
          {navigation.map(([id, glyph, label]) => {
            const isActive = tab === id;
            return (
              <button
                key={id}
                type="button"
                className={`nav-button ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(id)}
                title={label}
                aria-label={label}
                aria-current={isActive ? 'page' : undefined}
              >
                {id === 'profile' ? <Avatar user={user} /> : <Icon name={glyph} size={24} />}
                {id === 'messages' && unreadCount > 0 && (
                  <span id="unread-badge" className="unread-badge">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            className="nav-button create-button"
            onClick={onOpenCreatePost}
            aria-label="Create New Post"
            title="Create New Post"
          >
            <Icon name="plus" size={25} />
          </button>
        </div>

        <button
          type="button"
          className="nav-button menu-button"
          onClick={onOpenMenu}
          aria-label="More options"
          title="More options"
        >
          <Icon name="menu" size={25} />
        </button>
      </nav>

      <main className="platform-main">
        <header className="platform-header panel">
          <div className="header-brand">
            <strong className="shiny-text">Social Connectivity Platform</strong>
            <span
              id="connection-status"
              className={`connection-status ${socketConnected ? 'connected' : ''}`}
            >
              {socketConnected ? '● WS Gateway: Live' : '● Offline · local mode'}
            </span>
          </div>

          <button
            type="button"
            className="command-trigger"
            onClick={onOpenCommands}
          >
            <Icon name="search" size={14} />{' '}
            <span>Search & Commands</span> <kbd>Ctrl K</kbd>
          </button>

          <div className="header-user">
            <div>
              <strong>{user.name}</strong>
              <small className="accent">@{user.username || 'user'}</small>
            </div>
            <Avatar user={user} />
            <button
              type="button"
              className="icon-button"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="logout" size={16} />
            </button>
          </div>
        </header>

        <div id="view" className="animate-fade-in">
          {children}
        </div>
      </main>
    </>
  );
}
