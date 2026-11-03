import React from 'react';
import { Icon } from './Icons';

export function EventsView({ events, onRsvp }) {
  return (
    <>
      <h1 className="section-title">Community Events</h1>
      <div className="events-grid">
        {events.map(event => (
          <article key={event.id} className="panel">
            <span className="tag">{event.tag}</span>
            <h2 className="event-title">{event.title}</h2>
            <div className="event-details">
              <p><Icon name="clock" size={14} /> {event.date}</p>
              <p><Icon name="pin" size={14} /> {event.location}</p>
              <p><Icon name="user" size={14} /> {event.attendees} going</p>
            </div>
            <button
              type="button"
              className={`primary-button full-width ${event.rsvpd ? 'confirmed' : ''}`}
              aria-pressed={event.rsvpd}
              onClick={() => onRsvp(event.id)}
            >
              {event.rsvpd ? (
                <>
                  <Icon name="check" size={14} /> RSVP Confirmed
                </>
              ) : (
                "RSVP - I'm Going"
              )}
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
