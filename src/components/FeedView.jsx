import React from 'react';
import { Icon, Avatar } from './Icons';
import { mediaURL } from '../utils/ui';
import { toast } from '../utils/toast';

export function PostCard({ post, onLike, onComments, onShare }) {
  return (
    <article className="panel post-card" data-post={post.id} id={`post-${post.id}`}>
      <div className="author-row">
        <Avatar user={post.author} />
        <div>
          <strong>
            {post.author.name}{' '}
            {post.author.role === 'verified_user' && (
              <span className="accent">
                <Icon name="shield" size={14} />
              </span>
            )}
          </strong>
          <small>@{post.author.handle} • {post.timestamp}</small>
        </div>
      </div>

      <p className="post-content">{post.content}</p>

      {post.image && (
        <img
          className="post-media"
          src={mediaURL(post.image)}
          alt="Post attachment"
          loading="lazy"
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}

      <div className="post-actions">
        <button
          type="button"
          className={`text-button ${post.liked ? 'liked' : ''}`}
          onClick={() => onLike(post.id)}
          aria-label={`Like post by ${post.author.name}`}
          aria-pressed={!!post.liked}
        >
          <Icon name="heart" size={17} /> <span>{post.likes}</span>
        </button>

        <button
          type="button"
          className="text-button"
          onClick={() => onComments(post.id)}
          aria-label={`Comments on post by ${post.author.name}`}
        >
          <Icon name="message" size={17} /> <span>{post.comments}</span>
        </button>

        <button
          type="button"
          className="text-button"
          onClick={() => onShare(post)}
        >
          <Icon name="share" size={17} /> Share
        </button>
      </div>
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
              <small>{person.role}</small>
            </div>
            <button
              type="button"
              className={`connect-button ${isFollowed ? 'selected' : ''}`}
              aria-pressed={isFollowed}
              onClick={() => onFollowToggle(person.id)}
            >
              {isFollowed ? 'Connected' : 'Connect'}
            </button>
          </div>
        );
      })}
    </>
  );
}

export function FeedView({
  posts,
  user,
  following,
  onFollowToggle,
  onLike,
  onComments,
  onShare,
  onSearchTopic,
  onCreatePost,
  contacts
}) {
  const [postDraft, setPostDraft] = React.useState('');
  const [postImage, setPostImage] = React.useState('');
  const fileInputRef = React.useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size > 2 * 1024 * 1024) {
      toast('Choose a PNG, JPEG, WebP, or GIF image smaller than 2 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPostImage(reader.result);
    reader.onerror = () => {
      toast('Could not read this image.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handlePostSubmit = (e) => {
    e.preventDefault();
    if (!postDraft.trim() && !postImage) return;
    onCreatePost(postDraft, postImage);
    setPostDraft('');
    setPostImage('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const suggestedPeople = contacts.slice(0, 2);
  const userInterests = user.interests?.length ? user.interests : ['ai', 'design', 'code'];

  return (
    <div className="feed-grid">
      <section className="stack">
        <section className="panel composer-card">
          <form onSubmit={handlePostSubmit} id="post-form">
            <div className="row align-start">
              <Avatar user={user} />
              <label className="sr-only" htmlFor="post-composer-input">Write a post</label>
              <textarea
                id="post-composer-input"
                name="content"
                maxLength={5000}
                placeholder={`What's inspiring you today, ${user.name.split(' ')[0]}?`}
                value={postDraft}
                onChange={(e) => setPostDraft(e.target.value)}
              />
            </div>

            {postImage && (
              <div id="attachment-preview">
                <img src={postImage} alt="Selected attachment" />
                <button
                  type="button"
                  className="text-button small"
                  onClick={() => {
                    setPostImage('');
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Remove photo
                </button>
              </div>
            )}

            <div className="row between composer-footer">
              <label className="text-button accent file-label">
                <Icon name="image" size={16} /> Photo
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
                type="submit"
                className="primary-button"
                disabled={!postDraft.trim() && !postImage}
              >
                Share Post <Icon name="send" size={14} />
              </button>
            </div>
          </form>
        </section>

        <div id="post-stream" className="stack">
          {posts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onLike={onLike}
              onComments={onComments}
              onShare={onShare}
            />
          ))}
        </div>
      </section>

      <aside className="stack feed-sidebar">
        <section className="panel">
          <h2 className="card-title">People You May Know</h2>
          <div id="suggested-people" className="stack">
            <PeopleList
              following={following}
              onFollowToggle={onFollowToggle}
              people={suggestedPeople}
            />
          </div>
        </section>

        <section className="panel">
          <h2 className="card-title">Your Topics</h2>
          <div className="tags">
            {userInterests.map(tag => (
              <button
                key={tag}
                type="button"
                className="tag"
                onClick={() => onSearchTopic(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
