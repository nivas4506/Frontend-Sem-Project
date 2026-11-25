import React from 'react';
import { Icon, Avatar, VerifiedBadge } from './Icons';
import { PostCard, formatCount } from './FeedView';
import { PostTile } from './ExploreView';
import { topicLabel } from '../data';

const PROFILE_TABS = [
  ['posts', 'Posts', 'list'],
  ['media', 'Media', 'grid'],
  ['saved', 'Saved', 'bookmark'],
  ['activity', 'Activity', 'activity']
];

export function ProfileView({
  user,
  posts,
  following,
  savedPosts = [],
  activity,
  onEditProfile,
  onLike,
  onComments,
  onShare,
  onSave,
  onNavigate
}) {
  const [profileTab, setProfileTab] = React.useState('posts');

  const ownPosts = posts.filter(post => post.author.id === user.id);
  const mediaPosts = ownPosts.filter(post => post.image);
  const saved = posts.filter(post => savedPosts.includes(post.id));
  const totalLikes = ownPosts.reduce((sum, post) => sum + (post.likes || 0), 0);
  const interests = user.interests || [];

  // 26-week contribution heatmap
  const cells = Array.from({ length: 182 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 181 + index);
    const key = date.toLocaleDateString('en-CA');
    const count = activity[key] || 0;
    return { key, title: `${date.toDateString()}: ${count} activities`, level: Math.min(4, count) };
  });
  const totalContributions = Object.values(activity).reduce((sum, count) => sum + count, 0);

  const renderPostList = (list, emptyIcon, emptyTitle, emptyText, cta) => (
    list.length > 0 ? (
      <div className="post-stream">
        {list.map(post => (
          <PostCard
            key={post.id}
            post={post}
            onLike={onLike}
            onComments={onComments}
            onShare={onShare}
            onSave={onSave}
            isSaved={savedPosts.includes(post.id)}
            currentUserId={user.id}
          />
        ))}
      </div>
    ) : (
      <div className="empty-card">
        <Icon name={emptyIcon} size={32} />
        <h3>{emptyTitle}</h3>
        <p>{emptyText}</p>
        {cta}
      </div>
    )
  );

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div className="hero-cover" aria-hidden="true" />
        <div className="hero-body">
          <div className="hero-top">
            <Avatar user={user} className="hero-avatar" />
            <button type="button" className="edit-profile-btn" onClick={onEditProfile}>
              <Icon name="settings" size={16} /> Edit profile
            </button>
          </div>

          <div className="hero-identity">
            <h1>
              {user.name}
              {user.role === 'verified_user' && <VerifiedBadge size={20} />}
            </h1>
            <p className="hero-handle">@{user.username || 'user'}</p>
          </div>

          <p className="hero-bio">{user.bio || 'Building connected experiences.'}</p>

          {interests.length > 0 && (
            <div className="hero-interests">
              {interests.map(id => (
                <span key={id} className="topic-chip">{topicLabel(id)}</span>
              ))}
            </div>
          )}

          <div className="hero-stats">
            <button type="button" onClick={() => setProfileTab('posts')}>
              <strong>{ownPosts.length}</strong> <span>Posts</span>
            </button>
            <button type="button" onClick={() => onNavigate?.('explore')}>
              <strong>{following.length}</strong> <span>Following</span>
            </button>
            <div>
              <strong>{formatCount(totalLikes)}</strong> <span>Likes</span>
            </div>
            <button type="button" onClick={() => setProfileTab('saved')}>
              <strong>{saved.length}</strong> <span>Saved</span>
            </button>
          </div>
        </div>

        <div className="profile-tabs" role="tablist" aria-label="Profile sections">
          {PROFILE_TABS.map(([id, label, icon]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={profileTab === id}
              className={`profile-tab ${profileTab === id ? 'active' : ''}`}
              onClick={() => setProfileTab(id)}
            >
              <Icon name={icon} size={16} /> {label}
            </button>
          ))}
        </div>
      </section>

      {profileTab === 'posts' && renderPostList(
        ownPosts,
        'image',
        'Share your first post',
        'When you share photos and thoughts, they will appear on your profile.',
        <button type="button" className="post-button" onClick={() => onNavigate?.('feed')}>Create a post</button>
      )}

      {profileTab === 'media' && (
        mediaPosts.length > 0 ? (
          <div className="explore-tiles profile-grid">
            {mediaPosts.map((post, idx) => (
              <PostTile key={post.id} post={post} index={idx} onOpen={onComments} />
            ))}
          </div>
        ) : (
          <div className="empty-card">
            <Icon name="grid" size={32} />
            <h3>No photos yet</h3>
            <p>Posts with photos you share will show up in this grid.</p>
          </div>
        )
      )}

      {profileTab === 'saved' && renderPostList(
        saved,
        'bookmark',
        'Nothing saved yet',
        'Tap the bookmark on any post to save it here. Only you can see what you’ve saved.'
      )}

      {profileTab === 'activity' && (
        <section className="side-card activity-card">
          <h2 className="card-title">Community activity</h2>
          <p className="small muted">Your contributions over the last six months</p>
          <div className="heatmap-scroll">
            <div className="activity-heatmap" role="img" aria-label="Daily community contributions">
              {cells.map(cell => (
                <span key={cell.key} className={`activity-cell level-${cell.level}`} title={cell.title} />
              ))}
            </div>
          </div>
          <div className="d-flex align-items-center justify-content-between small">
            <span>
              Less <span className="activity-cell level-0"></span>{' '}
              <span className="activity-cell level-2"></span>{' '}
              <span className="activity-cell level-4"></span> More
            </span>
            <span>{totalContributions} contributions</span>
          </div>
          <div className="tags achievement-tags">
            <span className="tag">✦ Community Member</span>
            {ownPosts.length > 0 && <span className="tag">⚡ Conversation Starter</span>}
            {following.length > 0 && <span className="tag">♡ Connected Creator</span>}
            {saved.length > 0 && <span className="tag">🔖 Curator</span>}
          </div>
        </section>
      )}
    </div>
  );
}
