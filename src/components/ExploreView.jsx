import React from 'react';
import { Icon, Avatar } from './Icons';
import { mediaURL } from '../utils/ui';
import { PostCard, formatCount } from './FeedView';

export function PostTile({ post, index = 0, featured = false, onOpen }) {
  return (
    <button
      type="button"
      className={`explore-tile ${post.image ? '' : `text-tile tile-grad-${index % 4}`} ${featured ? 'featured' : ''}`}
      onClick={() => onOpen(post.id)}
      aria-label={`Open post by ${post.author.name}`}
    >
      {post.image ? (
        <img src={mediaURL(post.image)} alt="" loading="lazy" />
      ) : (
        <span className="tile-text">
          <span>{post.content}</span>
          <small>@{post.author.handle}</small>
        </span>
      )}
      <span className="tile-overlay" aria-hidden="true">
        <span><Icon name="heart" size={18} /> {formatCount(post.likes)}</span>
        <span><Icon name="message" size={18} /> {formatCount(post.comments)}</span>
      </span>
    </button>
  );
}

export function ExploreView({
  tab,
  searchQuery,
  setSearchQuery,
  posts,
  following,
  savedPosts = [],
  currentUserId,
  onFollowToggle,
  onLike,
  onComments,
  onShare,
  onSave,
  contacts,
  creators = [],
  trending = []
}) {
  const query = searchQuery.replace(/^#/, '').trim().toLowerCase();
  const people = [...contacts, ...creators];

  const filteredPosts = posts.filter(post =>
    `${post.content} ${post.author.name} ${post.author.handle} ${(post.tags || []).join(' ')}`
      .toLowerCase()
      .includes(query)
  );

  const filteredPeople = people.filter(person =>
    `${person.name} ${person.handle} ${person.role}`
      .toLowerCase()
      .includes(query)
  );

  const chips = ['AI', 'design', 'photography', 'travel', 'indiedev', 'music', 'WebGL'];
  const isSearching = query.length > 0;

  return (
    <section className="explore-page">
      <div className="explore-search">
        <Icon name="search" size={18} />
        <label className="visually-hidden" htmlFor="search-input">Search creators and posts</label>
        <input
          id="search-input"
          type="search"
          placeholder="Search people, posts and #hashtags"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus={tab === 'search'}
        />
        {searchQuery && (
          <button type="button" className="clear-search" onClick={() => setSearchQuery('')} aria-label="Clear search">
            <Icon name="close" size={16} />
          </button>
        )}
      </div>

      <div className="chip-row" role="group" aria-label="Popular topics">
        <button
          type="button"
          className={`chip ${!isSearching ? 'active' : ''}`}
          onClick={() => setSearchQuery('')}
        >
          For you
        </button>
        {chips.map(tag => (
          <button
            key={tag}
            type="button"
            className={`chip ${query === tag.toLowerCase() ? 'active' : ''}`}
            onClick={() => setSearchQuery(tag)}
          >
            #{tag}
          </button>
        ))}
      </div>

      <div id="search-results" className="explore-results">
        {filteredPeople.length > 0 && (
          <section>
            <h2 className="section-heading">{isSearching ? 'People' : 'Creators to follow'}</h2>
            <div className="creator-row">
              {filteredPeople.map(person => {
                const isFollowed = following.includes(person.id);
                return (
                  <article key={person.id} className="creator-card">
                    <span className="story-ring"><Avatar user={person} /></span>
                    <strong>{person.name}</strong>
                    <small>@{person.handle}</small>
                    <small className="creator-role">{person.role}</small>
                    <button
                      type="button"
                      className={`connect-button ${isFollowed ? 'selected' : ''}`}
                      aria-pressed={isFollowed}
                      onClick={() => onFollowToggle(person.id)}
                    >
                      {isFollowed ? 'Following' : 'Follow'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {!isSearching && trending.length > 0 && (
          <section>
            <h2 className="section-heading">Trending hashtags</h2>
            <div className="trend-chips">
              {trending.map(item => (
                <button key={item.tag} type="button" className="trend-chip" onClick={() => setSearchQuery(item.tag)}>
                  <Icon name="trending" size={16} />
                  <span>
                    <strong>#{item.tag}</strong>
                    <small>{item.posts}</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {filteredPosts.length > 0 && (
          <section>
            <h2 className="section-heading">{isSearching ? `Posts matching “${searchQuery}”` : 'Popular right now'}</h2>
            {isSearching ? (
              <div className="post-stream">
                {filteredPosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onLike={onLike}
                    onComments={onComments}
                    onShare={onShare}
                    onSave={onSave}
                    isSaved={savedPosts.includes(post.id)}
                    onTag={setSearchQuery}
                    currentUserId={currentUserId}
                    isFollowing={following.includes(post.author.id)}
                    onFollowToggle={onFollowToggle}
                  />
                ))}
              </div>
            ) : (
              <div className="explore-tiles">
                {[...filteredPosts]
                  .sort((a, b) => b.likes - a.likes)
                  .map((post, idx) => (
                    <PostTile
                      key={post.id}
                      post={post}
                      index={idx}
                      featured={idx === 0 && Boolean(post.image)}
                      onOpen={onComments}
                    />
                  ))}
              </div>
            )}
          </section>
        )}

        {filteredPosts.length === 0 && filteredPeople.length === 0 && (
          <div className="empty-card">
            <Icon name="search" size={32} />
            <h3>No results for “{searchQuery}”</h3>
            <p>Try searching for another creator, topic, or hashtag.</p>
          </div>
        )}
      </div>
    </section>
  );
}
