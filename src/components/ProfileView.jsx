import React from 'react';
import { Avatar } from './Icons';
import { PostCard } from './FeedView';

export function ProfileView({
  user,
  posts,
  following,
  activity,
  onEditProfile,
  onLike,
  onComments,
  onShare
}) {
  const ownPosts = posts.filter(post => post.author.id === user.id);

  // Generate 182 days heatmap
  const cells = Array.from({ length: 182 }, (_, index) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - 181 + index);
    const key = date.toLocaleDateString('en-CA');
    const count = activity[key] || 0;
    return {
      key,
      title: `${date.toDateString()}: ${count} activities`,
      level: Math.min(4, count)
    };
  });

  const totalContributions = Object.values(activity).reduce((sum, count) => sum + count, 0);

  return (
    <div className="profile-layout stack">
      <section className="panel profile-card">
        <div className="profile-cover"></div>
        <Avatar user={user} className="profile-avatar" />
        <h1>{user.name}</h1>
        <p className="accent font-mono">@{user.username || 'user'}</p>
        <p className="profile-bio">{user.bio || 'Building connected experiences.'}</p>
        <div className="profile-stats">
          <div>
            <strong>{following.length}</strong>
            <small>Connections</small>
          </div>
          <div>
            <strong>{ownPosts.length}</strong>
            <small>Posts</small>
          </div>
          <div>
            <strong>{(user.interests || []).length}</strong>
            <small>Interests</small>
          </div>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={onEditProfile}
        >
          Edit profile
        </button>
      </section>

      <section className="panel">
        <h2 className="card-title">Community Activity</h2>
        <p className="small muted">Your contributions over the last six months</p>
        <div className="heatmap-scroll">
          <div className="activity-heatmap" role="img" aria-label="Daily community contributions">
            {cells.map((cell, idx) => (
              <span
                key={idx}
                className={`activity-cell level-${cell.level}`}
                title={cell.title}
              />
            ))}
          </div>
        </div>
        <div className="row between small">
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
        </div>
      </section>

      {ownPosts.length > 0 && (
        <>
          <h2 className="card-title">Your Posts</h2>
          {ownPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onLike={onLike}
              onComments={onComments}
              onShare={onShare}
            />
          ))}
        </>
      )}
    </div>
  );
}
