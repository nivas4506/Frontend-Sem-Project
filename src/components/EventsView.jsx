import React from 'react';
import { Icon } from './Icons';

const BANNERS = {
  Engineering: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
  Design: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
  default: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)'
};

function dateParts(dateText = '') {
  const match = dateText.match(/^([A-Za-z]+)\.?\s+(\d{1,2})/);
  return match ? { month: match[1].slice(0, 3).toUpperCase(), day: match[2] } : { month: '', day: '•' };
}

export function EventsView({ events, onRsvp }) {
  return (
    <section className="events-page">
      <div className="events-intro">
        <h2 className="section-heading">Discover events</h2>
        <p className="muted small">Meet your community online and in person.</p>
      </div>
      <div className="events-grid">
        {events.map(event => {
          const { month, day } = dateParts(event.date);
          const [when, time] = event.date.split('•').map(s => s.trim());
          return (
            <article key={event.id} className="event-card">
              <div className="event-banner" style={{ background: BANNERS[event.tag] || BANNERS.default }}>
                <span className="event-tag">{event.tag}</span>
                <span className="event-date-badge" aria-hidden="true">
                  <small>{month}</small>
                  <strong>{day}</strong>
                </span>
              </div>
              <div className="event-body">
                <h3 className="event-title">{event.title}</h3>
                <div className="event-details">
                  <p><Icon name="clock" size={15} /> {when}{time ? ` · ${time}` : ''}</p>
                  <p><Icon name="pin" size={15} /> {event.location}</p>
                  <p><Icon name="user" size={15} /> {event.attendees.toLocaleString()} going</p>
                </div>
                <button
                  type="button"
                  className={`rsvp-button ${event.rsvpd ? 'confirmed' : ''}`}
                  aria-pressed={event.rsvpd}
                  onClick={() => onRsvp(event.id)}
                >
                  {event.rsvpd ? (
                    <><Icon name="check" size={15} /> You’re going</>
                  ) : (
                    <><Icon name="calendar" size={15} /> Interested · RSVP</>
                  )}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
