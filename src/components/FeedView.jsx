import React from 'react';
import { Icon, Avatar, VerifiedBadge } from './Icons';
import { mediaURL } from '../utils/ui';
import { toast } from '../utils/toast';
import { topicLabel } from '../data';
import { StoriesBar } from './StoriesBar';
import { BRAND_NAME } from './Shell';

const QUICK_EMOJIS = ['😀', '😂', '😍', '🔥', '🚀', '✨', '🎉', '👏', '💡', '❤️'];

export function formatCount(value = 0) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (value >= 10_000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return value.toLocaleString();
}

export function RichText({ text, onTag }) {
  const parts = String(text || '').split(/(#\w+)/g);
  return parts.map((part, idx) => {
    if (/^#\w+$/.test(part)) {
      return onTag ? (
        <button key={idx} type="button" className="hashtag" onClick={() => onTag(part.slice(1))}>
          {part}
        </button>
      ) : (
        <span key={idx} className="hashtag">{part}</span>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function PostCard({
  post,
  onLike,
  onComments,
  onShare,
  onSave,
  isSaved = false,
  onTag,
  currentUserId,
  isFollowing = false,
  onFollowToggle
}) {
  const [burst, setBurst] = React.useState(false);
  const burstTimer = React.useRef(null);

  React.useEffect(() => () => clearTimeout(burstTimer.current), []);

  const handleDoubleLike = () => {
    if (!post.liked) onLike(post.id);
    setBurst(true);
    clearTimeout(burstTimer.current);
    burstTimer.current = setTimeout(() => setBurst(false), 750);
  };

  const isVerified = post.author.role === 'verified_user';
  const isOwnPost = post.author.id === currentUserId;
  const showFollow = Boolean(onFollowToggle) && !isOwnPost;
  const topics = (post.tags || []).slice(0, 2).map(topicLabel);

  return (
    <article className="post-card" data-post={post.id} id={`post-${post.id}`}>
      <header className="post-header">
        <Avatar user={post.author} />
        <div className="post-author">
          <div className="post-author-line">
            <strong>{post.author.name}</strong>
            {isVerified && <VerifiedBadge size={15} />}
          </div>
          <small>@{post.author.handle} · {post.timestamp}</small>
        </div>
        {showFollow && (
          <button
            type="button"
            className={`follow-pill ${isFollowing ? 'following' : ''}`}
            aria-pressed={isFollowing}
            onClick={() => onFollowToggle(post.author.id)}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}
      </header>

      {post.content && (
        <p className="post-content">
          <RichText text={post.content} onTag={onTag} />
        </p>
      )}

      {post.image && (
        <div
          className="post-media-wrap"
          onDoubleClick={handleDoubleLike}
          title="Double-click to like"
        >
          <img
            className="post-media"
            src={mediaURL(post.image)}
            alt={`Photo shared by ${post.author.name}`}
            loading="lazy"
            onError={(e) => { e.currentTarget.parentElement.style.display = 'none'; }}
          />
          {burst && (
            <span className="like-burst" aria-hidden="true">
              <Icon name="heart" size={96} />
            </span>
          )}
        </div>
      )}

      {topics.length > 0 && (
        <div className="post-topics">
          {topics.map(topic => (
            <span key={topic} className="topic-chip">{topic}</span>
          ))}
        </div>
      )}

      <div className="post-actions">
        <button
          type="button"
          className={`action-btn like ${post.liked ? 'liked' : ''}`}
          onClick={() => onLike(post.id)}
          aria-label={`${post.liked ? 'Unlike' : 'Like'} post by ${post.author.name}`}
          aria-pressed={!!post.liked}
        >
          <Icon name="heart" size={19} /> <span>{formatCount(post.likes)}</span>
        </button>

        <button
          type="button"
          className="action-btn comment"
          onClick={() => onComments(post.id)}
          aria-label={`Comments on post by ${post.author.name}`}
        >
          <Icon name="message" size={19} /> <span>{formatCount(post.comments)}</span>
        </button>

        <button
          type="button"
          className="action-btn share"
          onClick={() => onShare(post)}
          aria-label={`Share post by ${post.author.name}`}
        >
          <Icon name="share" size={19} /> <span>Share</span>
        </button>

        <span className="post-spacer" />

        {onSave && (
          <button
            type="button"
            className={`action-btn save ${isSaved ? 'saved' : ''}`}
            onClick={() => onSave(post.id)}
            aria-label={isSaved ? 'Remove from saved' : 'Save post'}
            aria-pressed={isSaved}
            title={isSaved ? 'Saved' : 'Save'}
          >
            <Icon name="bookmark" size={19} />
          </button>
        )}
      </div>

      <button type="button" className="view-comments" onClick={() => onComments(post.id)}>
        {post.comments > 0
          ? `View all ${formatCount(post.comments)} comments`
          : 'Be the first to comment…'}
      </button>
    </article>
  );
}

export function PeopleList({ following, onFollowToggle, people }) {
  return (
    <>
      {people.map(person => {
        const isFollowed = following.includes(person.id);
        return (
          <div key={person.id} className="person-row">
            <Avatar user={person} />
            <div>
              <strong>{person.name}</strong>
              <small>
                @{person.handle}
                {person.mutuals ? ` · ${person.mutuals} mutual${person.mutuals > 1 ? 's' : ''}` : ` · ${person.role}`}
              </small>
            </div>
            <button
              type="button"
              className={`connect-button ${isFollowed ? 'selected' : ''}`}
              aria-pressed={isFollowed}
              aria-label={`${isFollowed ? 'Unfollow' : 'Follow'} ${person.name}`}
              onClick={() => onFollowToggle(person.id)}
            >
              {isFollowed ? 'Following' : 'Follow'}
            </button>
          </div>
        );
      })}
    </>
  );
}

function Composer({ user, onCreatePost }) {
  const [postDraft, setPostDraft] = React.useState('');
  const [postImage, setPostImage] = React.useState('');
  const [showEmojis, setShowEmojis] = React.useState(false);
  const fileInputRef = React.useRef(null);
  const textareaRef = React.useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast('Choose a PNG, JPEG, WebP, or GIF image smaller than 2 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPostImage(reader.result);
    reader.onerror = () => toast('Could not read this image.', 'error');
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setPostImage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const insertEmoji = (emoji) => {
    setPostDraft(prev => `${prev}${emoji}`);
    textareaRef.current?.focus();
  };

  const handlePostSubmit = (e) => {
    e.preventDefault();
    if (!postDraft.trim() && !postImage) return;
    onCreatePost(postDraft, postImage);
    setPostDraft('');
    setShowEmojis(false);
    clearImage();
  };

  const remaining = 5000 - postDraft.length;

  return (
    <section className="composer-card">
      <form onSubmit={handlePostSubmit} id="post-form">
        <div className="composer-row">
          <Avatar user={user} />
          <label className="sr-only" htmlFor="post-composer-input">Write a post</label>
          <textarea
            id="post-composer-input"
            ref={textareaRef}
            name="content"
            maxLength={5000}
            placeholder={`What's happening, ${user.name.split(' ')[0]}?`}
            value={postDraft}
            onChange={(e) => setPostDraft(e.target.value)}
          />
        </div>

        {postImage && (
          <div id="attachment-preview">
            <img src={postImage} alt="Selected attachment" />
            <button
              type="button"
              className="attachment-remove"
              onClick={clearImage}
              aria-label="Remove photo"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}

        {showEmojis && (
          <div className="emoji-tray" role="group" aria-label="Insert emoji">
            {QUICK_EMOJIS.map(emoji => (
              <button key={emoji} type="button" onClick={() => insertEmoji(emoji)} aria-label={`Insert ${emoji}`}>
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="composer-footer">
          <div className="composer-tools">
            <label className="composer-tool file-label" title="Add photo">
              <Icon name="image" size={19} />
              <span>Photo</span>
              <input
                id="post-photo"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="sr-only"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
            </label>
            <button
              type="button"
              className={`composer-tool ${showEmojis ? 'active' : ''}`}
              onClick={() => setShowEmojis(v => !v)}
              aria-expanded={showEmojis}
              title="Add emoji"
            >
              <Icon name="smile" size={19} />
              <span>Feeling</span>
            </button>
          </div>
          <div className="composer-submit">
            {remaining < 500 && (
              <small className={remaining < 100 ? 'char-warning' : ''}>{remaining}</small>
            )}
            <button
              type="submit"
              className="post-button"
              disabled={!postDraft.trim() && !postImage}
            >
              Post
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

export function FeedView({
  posts,
  user,
  following,
  savedPosts = [],
  onFollowToggle,
  onLike,
  onComments,
  onShare,
  onSave,
  onSearchTopic,
  onCreatePost,
  onFocusComposer,
  onNavigate,
  onOpenHelp,
  contacts,
  creators = [],
  stories = [],
  trending = [],
  events = []
}) {
  const [feedTab, setFeedTab] = React.useState('foryou');

  const allPeople = [...contacts, ...creators];
  const suggestedPeople = allPeople.filter(p => !following.includes(p.id)).slice(0, 4);
  const visiblePosts = feedTab === 'following'
    ? posts.filter(p => following.includes(p.author.id) || p.author.id === user.id)
    : posts;
  const upcomingEvents = events.slice(0, 2);

  return (
    <div className="feed-grid">
      <section className="feed-column">
        <StoriesBar user={user} stories={stories} onAddStory={onFocusComposer} />

        <Composer user={user} onCreatePost={onCreatePost} />

        <div className="feed-tabs" role="tablist" aria-label="Feed">
          {[['foryou', 'For you'], ['following', 'Following']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={feedTab === id}
              className={`feed-tab ${feedTab === id ? 'active' : ''}`}
              onClick={() => setFeedTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div id="post-stream" className="post-stream">
          {visiblePosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onLike={onLike}
              onComments={onComments}
              onShare={onShare}
              onSave={onSave}
              isSaved={savedPosts.includes(post.id)}
              onTag={onSearchTopic}
              currentUserId={user.id}
              isFollowing={following.includes(post.author.id)}
              onFollowToggle={onFollowToggle}
            />
          ))}

          {visiblePosts.length === 0 && (
            <div className="empty-card">
              <Icon name="userPlus" size={32} />
              <h3>Your Following feed is empty</h3>
              <p>Follow creators you like and their posts will show up here.</p>
              <button type="button" className="post-button" onClick={() => setFeedTab('foryou')}>
                Discover posts
              </button>
            </div>
          )}

          {visiblePosts.length > 0 && (
            <p className="feed-end">
              <Icon name="check" size={16} /> You're all caught up
            </p>
          )}
        </div>
      </section>

      <aside className="feed-sidebar">
        <section className="side-card me-card">
          <Avatar user={user} />
          <div>
            <strong>{user.name}</strong>
            <small>@{user.username || 'user'}</small>
          </div>
          <button type="button" className="link-button" onClick={() => onNavigate('profile')}>
            View
          </button>
        </section>

        {suggestedPeople.length > 0 && (
          <section className="side-card">
            <div className="side-card-head">
              <h2 className="card-title">Suggested for you</h2>
              <button type="button" className="link-button" onClick={() => onNavigate('explore')}>
                See all
              </button>
            </div>
            <div id="suggested-people" className="people-stack">
              <PeopleList
                following={following}
                onFollowToggle={onFollowToggle}
                people={suggestedPeople}
              />
            </div>
          </section>
        )}

        <section className="side-card">
          <div className="side-card-head">
            <h2 className="card-title">Trending now</h2>
            <Icon name="trending" size={18} className="muted" />
          </div>
          <div className="trend-list">
            {trending.map(item => (
              <button
                key={item.tag}
                type="button"
                className="trend-item"
                onClick={() => onSearchTopic(item.tag)}
              >
                <small>{item.category}</small>
                <strong>#{item.tag}</strong>
                <small>{item.posts}</small>
              </button>
            ))}
          </div>
          {(user.interests || []).length > 0 && (
            <div className="tags side-tags">
              {user.interests.map(tag => (
                <button key={tag} type="button" className="tag" onClick={() => onSearchTopic(tag)}>
                  #{tag}
                </button>
              ))}
            </div>
          )}
        </section>

        {upcomingEvents.length > 0 && (
          <section className="side-card">
            <div className="side-card-head">
              <h2 className="card-title">Upcoming events</h2>
              <button type="button" className="link-button" onClick={() => onNavigate('events')}>
                All events
              </button>
            </div>
            <div className="mini-events">
              {upcomingEvents.map(event => (
                <button key={event.id} type="button" className="mini-event" onClick={() => onNavigate('events')}>
                  <span className="mini-event-icon"><Icon name="calendar" size={18} /></span>
                  <span>
                    <strong>{event.title}</strong>
                    <small>{event.date.split('•')[0].trim()} · {event.attendees} going{event.rsvpd ? ' · You’re in' : ''}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className="side-footer">
          <button type="button" className="link-button muted" onClick={onOpenHelp}>Help</button>
          <span>·</span>
          <span>© 2026 {BRAND_NAME}</span>
        </footer>
      </aside>
    </div>
  );
}
