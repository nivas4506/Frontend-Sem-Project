import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, Avatar } from './Icons';
import { readStored } from '../utils/ui';

const SEEN_KEY = 'scp_seen_stories';

export function StoriesBar({ user, stories, onAddStory }) {
  // Snapshot of the story order taken when the viewer opens, so marking
  // stories as seen does not reshuffle them mid-playback.
  const [viewer, setViewer] = useState(null);
  const [seen, setSeen] = useState(() => readStored(SEEN_KEY, []));

  const markSeen = useCallback((id) => {
    setSeen(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(next)); } catch { /* storage full */ }
      return next;
    });
  }, []);

  // Unseen stories first, like most social apps.
  const ordered = [...stories].sort(
    (a, b) => Number(seen.includes(a.id)) - Number(seen.includes(b.id))
  );

  return (
    <>
      <section className="stories-bar" aria-label="Stories">
        <button type="button" className="story-item" onClick={onAddStory}>
          <span className="story-ring own">
            <Avatar user={user} />
            <span className="story-add" aria-hidden="true"><Icon name="plus" size={12} /></span>
          </span>
          <span className="story-name">Your story</span>
        </button>

        {ordered.map((story, idx) => {
          const isSeen = seen.includes(story.id);
          return (
            <button
              key={story.id}
              type="button"
              className="story-item"
              onClick={() => setViewer({ list: ordered, index: idx })}
              aria-label={`View story from ${story.user.name}${isSeen ? ' (seen)' : ''}`}
            >
              <span className={`story-ring ${isSeen ? 'seen' : ''}`}>
                <Avatar user={story.user} />
              </span>
              <span className="story-name">{story.user.handle}</span>
            </button>
          );
        })}
      </section>

      {viewer && (
        <StoryViewer
          stories={viewer.list}
          startIndex={viewer.index}
          onClose={() => setViewer(null)}
          onSeen={markSeen}
        />
      )}
    </>
  );
}

function StoryViewer({ stories, startIndex, onClose, onSeen }) {
  const [storyIdx, setStoryIdx] = useState(startIndex);
  const [slideIdx, setSlideIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(null);

  const story = stories[storyIdx];
  const slide = story.slides[slideIdx];

  useEffect(() => { onSeen(story.id); }, [story.id, onSeen]);
  useEffect(() => { closeRef.current?.focus(); }, []);

  const next = useCallback(() => {
    if (slideIdx < story.slides.length - 1) {
      setSlideIdx(s => s + 1);
    } else if (storyIdx < stories.length - 1) {
      setStoryIdx(i => i + 1);
      setSlideIdx(0);
    } else {
      onClose();
    }
  }, [slideIdx, storyIdx, story.slides.length, stories.length, onClose]);

  const prev = useCallback(() => {
    if (slideIdx > 0) {
      setSlideIdx(s => s - 1);
    } else if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
      setSlideIdx(0);
    }
  }, [slideIdx, storyIdx]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') { e.preventDefault(); setPaused(p => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, prev, onClose]);

  return (
    <div
      className="story-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`Story from ${story.user.name}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="story-frame"
        onPointerDown={() => setPaused(true)}
        onPointerUp={() => setPaused(false)}
        onPointerLeave={() => setPaused(false)}
      >
        <img key={slide.image} src={slide.image} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div className="story-shade" aria-hidden="true" />

        <div className="story-progress" aria-hidden="true">
          {story.slides.map((_, i) => (
            <span key={i} className={i < slideIdx ? 'done' : i === slideIdx ? 'active' : ''}>
              {i === slideIdx ? (
                <i
                  key={`${storyIdx}-${slideIdx}`}
                  style={{ animationPlayState: paused ? 'paused' : 'running' }}
                  onAnimationEnd={next}
                />
              ) : <i />}
            </span>
          ))}
        </div>

        <div className="story-head">
          <Avatar user={story.user} />
          <strong>{story.user.handle}</strong>
          <small>{slide.time}</small>
          <button
            ref={closeRef}
            type="button"
            className="story-close"
            onClick={onClose}
            onPointerDown={(e) => e.stopPropagation()}
            aria-label="Close story"
          >
            <Icon name="close" size={22} />
          </button>
        </div>

        <button type="button" className="story-tap prev" onClick={prev} aria-label="Previous" />
        <button type="button" className="story-tap next" onClick={next} aria-label="Next" />

        {slide.caption && <p className="story-caption">{slide.caption}</p>}
      </div>

      {storyIdx > 0 && (
        <button type="button" className="story-nav left" onClick={prev} aria-label="Previous story">
          <Icon name="chevronLeft" size={22} />
        </button>
      )}
      <button type="button" className="story-nav right" onClick={next} aria-label="Next story">
        <Icon name="chevronRight" size={22} />
      </button>
    </div>
  );
}
