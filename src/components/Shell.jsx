import React from 'react';
import { Icon, Avatar } from './Icons';
import { navigation } from '../data';
import logoImg from '../assets/logo.png';

export const BRAND_NAME = 'SocialConnect';

const pageTitles = {
  feed: 'Home',
  explore: 'Explore',
  search: 'Search',
  messages: 'Messages',
  notifications: 'Notifications',
  events: 'Events',
  profile: 'Profile'
};

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
  notificationCount = 0,
  children
}) {
  return (
    <div className="social-app">
      <div className="app-backdrop" aria-hidden="true" />

      <nav className="nav-rail" aria-label="Main navigation">
        <button
          type="button"
          className="nav-logo"
          onClick={() => onNavigate('feed')}
          aria-label={`${BRAND_NAME} home`}
        >
          <img src={logoImg} alt="" />
          <span className="brand-wordmark">{BRAND_NAME}</span>
        </button>

        <div className="nav-links">
          {navigation.map(([id, glyph, label]) => {
            const isActive = tab === id;
            const badge = id === 'messages' ? unreadCount : id === 'notifications' ? notificationCount : 0;
            return (
              <button
                key={id}
                type="button"
                className={`nav-button nav-${id} ${isActive ? 'active' : ''}`}
                onClick={() => onNavigate(id)}
                title={label}
                aria-label={badge > 0 ? `${label}, ${badge} new` : label}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="nav-icon">
                  {id === 'profile' ? <Avatar user={user} /> : <Icon name={glyph} size={24} />}
                  {badge > 0 && (
                    <span id={id === 'messages' ? 'unread-badge' : undefined} className="unread-badge">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </span>
                <span className="nav-label">{label}</span>
              </button>
            );
          })}

          <button
            type="button"
            className="create-post-btn"
            onClick={onOpenCreatePost}
            aria-label="Create new post"
            title="Create new post"
          >
            <Icon name="plus" size={22} />
            <span className="nav-label">Create post</span>
          </button>
        </div>

        <div className="sidebar-user">
          <button
            type="button"
            className="sidebar-user-info"
            onClick={() => onNavigate('profile')}
            title="View your profile"
          >
            <span className="avatar-wrap">
              <Avatar user={user} />
              <span className={`presence-dot ${socketConnected ? 'online' : ''}`} aria-hidden="true" />
            </span>
            <span className="sidebar-user-text">
              <strong>{user.name}</strong>
              <small>@{user.username || 'user'}</small>
            </span>
          </button>
          <button
            type="button"
            className="sidebar-more"
            onClick={onOpenMenu}
            aria-label="More options"
            title="More options"
          >
            <Icon name="more" size={20} />
          </button>
        </div>
      </nav>

      <main className="platform-main">
        <header className="platform-header topbar">
          <div className="topbar-title">
            <button
              type="button"
              className="topbar-brand"
              onClick={() => onNavigate('feed')}
              aria-label={`${BRAND_NAME} home`}
            >
              <img src={logoImg} alt="" />
              <span className="brand-wordmark">{BRAND_NAME}</span>
            </button>
            <h1 className="topbar-heading">{pageTitles[tab] || 'Home'}</h1>
            <span
              id="connection-status"
              className={`connection-status ${socketConnected ? 'connected' : ''}`}
              title={socketConnected ? 'Real-time gateway connected' : 'Offline · changes are saved locally'}
            >
              <span className="status-dot" aria-hidden="true" />
              {socketConnected ? 'Live' : 'Offline'}
            </span>
          </div>

          <button
            type="button"
            className="command-trigger search-pill"
            onClick={onOpenCommands}
            aria-label="Search and commands"
          >
            <Icon name="search" size={16} />
            <span>Search {BRAND_NAME}</span>
            <kbd>Ctrl K</kbd>
          </button>

          <div className="topbar-actions">
            <button
              type="button"
              className="topbar-icon"
              onClick={() => onNavigate('notifications')}
              aria-label="Notifications"
              title="Notifications"
            >
              <Icon name="bell" size={20} />
              {notificationCount > 0 && <span className="dot-badge" aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="topbar-icon"
              onClick={() => onNavigate('messages')}
              aria-label="Messages"
              title="Messages"
            >
              <Icon name="send" size={20} />
              {unreadCount > 0 && <span className="dot-badge" aria-hidden="true" />}
            </button>
            <button
              type="button"
              className="topbar-icon mobile-only"
              onClick={onOpenMenu}
              aria-label="More options"
              title="More options"
            >
              <Icon name="menu" size={20} />
            </button>
            <button
              type="button"
              className="topbar-icon desktop-only"
              onClick={onSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <Icon name="logout" size={18} />
            </button>
          </div>
        </header>

        <div id="view" className="animate-fade-in" key={tab}>
          {children}
        </div>
      </main>
    </div>
  );
}
