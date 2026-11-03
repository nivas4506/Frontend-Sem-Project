import React from 'react';
import { Icon, Avatar } from './Icons';

export function NotificationsView({ notifications }) {
  return (
    <section className="panel notifications-panel">
      <h1 className="section-title">
        <Icon name="heart" /> Recent Activity
      </h1>
      <div className="stack">
        {notifications.length > 0 ? (
          notifications.map(item => (
            <article key={item.id} className="notification-row">
              <Avatar user={item} />
              <div>
                <strong>{item.name}</strong>
                <p>{item.action}</p>
                <small>{item.time}</small>
              </div>
            </article>
          ))
        ) : (
          <p className="empty-state">You’re all caught up.</p>
        )}
      </div>
    </section>
  );
}
