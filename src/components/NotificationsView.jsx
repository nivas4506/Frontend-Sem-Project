import React from 'react';
import { Icon, Avatar } from './Icons';

function notificationType(action = '') {
  const text = action.toLowerCase();
  if (text.includes('follow')) return 'follow';
  if (text.includes('comment') || text.includes('repl') || text.includes('mention')) return 'comment';
  if (text.includes('message')) return 'message';
  return 'like';
}

const TYPE_ICONS = { follow: 'userPlus', comment: 'message', message: 'send', like: 'heart' };

export function NotificationsView({ notifications, following = [], onFollowToggle, onNavigate }) {
  const [filter, setFilter] = React.useState('all');

  const items = notifications.map(n => ({ ...n, type: notificationType(n.action) }));
  const visible = items.filter(n => {
    if (filter === 'all') return true;
    if (filter === 'follows') return n.type === 'follow';
    return n.type === 'comment' || n.type === 'message';
  });

  return (
    <section className="notifications-page">
      <div className="feed-tabs" role="tablist" aria-label="Filter notifications">
        {[['all', 'All'], ['follows', 'Follows'], ['mentions', 'Comments']].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`feed-tab ${filter === id ? 'active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="notif-list">
        {visible.length > 0 ? (
          visible.map(item => {
            // Seed notifications spread the person's profile (so `id` is the person id);
            // live gateway notifications may carry an explicit sender id instead.
            const personId = item.fromUserId || item.userId || item.id;
            const isFollowed = following.includes(personId);
            return (
              <article key={item.id} className="notif-row">
                <span className="notif-avatar">
                  <Avatar user={item} />
                  <span className={`notif-type type-${item.type}`} aria-hidden="true">
                    <Icon name={TYPE_ICONS[item.type]} size={11} />
                  </span>
                </span>
                <div className="notif-text">
                  <p><strong>{item.name}</strong> {item.action}</p>
                  <small>{item.time}</small>
                </div>
                {item.type === 'follow' && onFollowToggle && (
                  <button
                    type="button"
                    className={`connect-button ${isFollowed ? 'selected' : ''}`}
                    aria-pressed={isFollowed}
                    onClick={() => onFollowToggle(personId)}
                  >
                    {isFollowed ? 'Following' : 'Follow back'}
                  </button>
                )}
                {item.type === 'comment' && onNavigate && (
                  <button type="button" className="connect-button selected" onClick={() => onNavigate('profile')}>
                    View
                  </button>
                )}
              </article>
            );
          })
        ) : (
          <div className="empty-card">
            <Icon name="bell" size={32} />
            <h3>You’re all caught up</h3>
            <p>Likes, follows and comments on your posts will show up here.</p>
          </div>
        )}
      </div>
    </section>
  );
}
