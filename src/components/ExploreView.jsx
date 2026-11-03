import React from 'react';
import { PostCard, PeopleList } from './FeedView';

export function ExploreView({
  tab,
  searchQuery,
  setSearchQuery,
  posts,
  following,
  onFollowToggle,
  onLike,
  onComments,
  onShare,
  contacts
}) {
  const query = searchQuery.replace(/^#/, '').trim().toLowerCase();

  const filteredPosts = posts.filter(post =>
    `${post.content} ${post.author.name} ${post.author.handle} ${(post.tags || []).join(' ')}`
      .toLowerCase()
      .includes(query)
  );

  const filteredPeople = contacts.filter(person =>
    `${person.name} ${person.handle} ${person.role}`
      .toLowerCase()
      .includes(query)
  );

  const searchTags = ['AI', 'Design', 'Engineering', 'Photography', 'WebGL'];

  return (
    <section className="stack">
      <div className="panel">
        <h1 className="section-title">
          {tab === 'search' ? 'Explore & Search' : 'Discover your community'}
        </h1>
        <label className="sr-only" htmlFor="search-input">
          Search creators and posts
        </label>
        <input
          id="search-input"
          className="auth-input"
          type="search"
          placeholder="Search community posts, creators, or topics…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <div className="tags search-tags">
          {searchTags.map(tag => (
            <button
              key={tag}
              type="button"
              className="tag"
              onClick={() => setSearchQuery(tag)}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      <div id="search-results" className="stack">
        {filteredPeople.length > 0 && (
          <section className="panel">
            <h2 className="card-title">Creators</h2>
            <div className="stack">
              <PeopleList
                following={following}
                onFollowToggle={onFollowToggle}
                people={filteredPeople}
              />
            </div>
          </section>
        )}

        <div className="explore-grid">
          {filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              onLike={onLike}
              onComments={onComments}
              onShare={onShare}
            />
          ))}
        </div>

        {filteredPosts.length === 0 && filteredPeople.length === 0 && (
          <p className="empty-state">No results. Try another creator, topic, or keyword.</p>
        )}
      </div>
    </section>
  );
}
