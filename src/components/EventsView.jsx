import React from 'react';
import { Icon } from './Icons';

function bannerVariant(tag) {
  if (tag === 'Engineering') return 'engineering';
  if (tag === 'Design') return 'design';
  return 'default';
}

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
      <div className="row g-3 events-grid">
        {events.map(event => {
          const { month, day } = dateParts(event.date);
          const [when, time] = event.date.split('•').map(s => s.trim());
          return (
            <div key={event.id} className="col-12 col-md-6">
              <article className="event-card card h-100">
                <div className={`event-banner event-banner-${bannerVariant(event.tag)}`}>
                  <span className="event-tag badge rounded-pill">{event.tag}</span>
                  <span className="event-date-badge" aria-hidden="true">
                    <small>{month}</small>
                    <strong>{day}</strong>
                  </span>
                </div>
                <div className="event-body card-body d-flex flex-column">
                  <h3 className="event-title">{event.title}</h3>
                  <div className="event-details">
                    <p><Icon name="clock" size={15} /> {when}{time ? ` · ${time}` : ''}</p>
                    <p><Icon name="pin" size={15} /> {event.location}</p>
                    <p><Icon name="user" size={15} /> {event.attendees.toLocaleString()} going</p>
                  </div>
                  <button
                    type="button"
                    className={`btn w-100 rsvp-button ${event.rsvpd ? 'confirmed' : ''}`}
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
            </div>
          );
        })}
      </div>
    </section>
  );
}
