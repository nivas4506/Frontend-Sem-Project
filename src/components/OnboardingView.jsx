import React from 'react';
import { Icon, Avatar } from './Icons';
import { avatars, topics } from '../data';
import { mediaURL } from '../utils/ui';

export function OnboardingView({ profile, setProfile, step, setStep, onFinish }) {
  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'username') {
      value = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleTopicToggle = (topicId) => {
    setProfile(prev => {
      const interests = prev.interests || [];
      const updated = interests.includes(topicId)
        ? interests.filter(id => id !== topicId)
        : [...interests, topicId];
      return { ...prev, interests: updated };
    });
  };

  const handleAvatarSelect = (src) => {
    setProfile(prev => ({ ...prev, avatar: src }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (step === 2 && (profile.interests || []).length < 3) return;
    if (step === 3) {
      onFinish();
    } else {
      setStep(s => s + 1);
    }
  };

  const titles = ['Design Your Identity', 'Select Your Interests', 'Privacy & Audience'];

  return (
    <main className="onboarding-main">
      <section className="auth-box-card onboarding-card animate-fade-in">
        <div className="row between">
          <span className="eyebrow">Step {step} of 3 • Profile Setup</span>
          <button
            type="button"
            className="text-button small"
            onClick={onFinish}
          >
            Skip to Platform
          </button>
        </div>

        <h1 className="section-title shiny-text">{titles[step - 1]}</h1>

        <div className="step-progress" aria-label={`Step ${step} of 3`}>
          {[1, 2, 3].map(n => (
            <span key={n} className={n <= step ? 'active' : ''}></span>
          ))}
        </div>

        <form onSubmit={handleSubmit} id="onboarding-form">
          {step === 1 && (
            <>
              <div className="identity-preview row">
                <Avatar user={profile} className="large" />
                <div>
                  <strong id="preview-name">{profile.name}</strong>
                  <p className="accent" id="preview-handle">@{profile.username}</p>
                  <small id="preview-bio">{profile.bio}</small>
                </div>
              </div>

              <p className="field-label">Select Avatar</p>
              <div className="avatar-options">
                {avatars.map((src, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`avatar-option ${profile.avatar === src ? 'selected' : ''}`}
                    aria-pressed={profile.avatar === src}
                    onClick={() => handleAvatarSelect(src)}
                  >
                    <img src={mediaURL(src)} alt={`Avatar ${index + 1}`} />
                  </button>
                ))}
              </div>

              <div className="auth-input-group">
                <label className="field-label" htmlFor="name">Display Name</label>
                <input
                  id="name"
                  name="name"
                  className="auth-input"
                  value={profile.name}
                  onChange={handleChange}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </div>

              <div className="auth-input-group">
                <label className="field-label" htmlFor="username">Unique Handle</label>
                <input
                  id="username"
                  name="username"
                  className="auth-input"
                  value={profile.username}
                  onChange={handleChange}
                  required
                  pattern="[a-zA-Z0-9_]+"
                  maxLength={30}
                />
              </div>

              <label className="field-label" htmlFor="bio">
                Bio <span className="muted">(up to 160 characters)</span>
              </label>
              <textarea
                id="bio"
                name="bio"
                className="auth-input bio-input"
                maxLength={160}
                value={profile.bio}
                onChange={handleChange}
              />
            </>
          )}

          {step === 2 && (
            <>
              <p className="description">
                Pick at least <strong>3 interests</strong> to personalize your feed.
              </p>
              <div className="topic-grid">
                {topics.map(topic => {
                  const selected = (profile.interests || []).includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className={`topic-option ${selected ? 'selected' : ''}`}
                      aria-pressed={selected}
                      onClick={() => handleTopicToggle(topic.id)}
                    >
                      <span className="topic-emoji">{topic.emoji}</span>
                      <strong>{topic.label}</strong>
                      <small>{topic.description}</small>
                    </button>
                  );
                })}
              </div>
              <p className="small accent">
                Selected: {(profile.interests || []).length} topics
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <p className="description">Choose your profile visibility preference.</p>
              <div className="stack">
                {[
                  ['public', 'Open Community', 'Anyone can discover your public profile.', 'compass'],
                  ['mutual', 'Friends & Mutuals Only', 'Share with connections and mutual friends.', 'user'],
                  ['private', 'Private Safe Space', 'Keep your profile visibility limited.', 'lock']
                ].map(([id, title, desc, glyph]) => {
                  const isSelected = profile.privacy === id;
                  return (
                    <label
                      key={id}
                      className={`privacy-option ${isSelected ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="privacy"
                        value={id}
                        checked={isSelected}
                        onChange={(e) => setProfile(prev => ({ ...prev, privacy: e.target.value }))}
                      />
                      <Icon name={glyph} />
                      <span>
                        <strong>{title}</strong>
                        <small>{desc}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </>
          )}

          <div className="row onboarding-actions">
            {step > 1 && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setStep(s => s - 1)}
              >
                Back
              </button>
            )}
            <button
              type="submit"
              className="auth-btn-continue"
              disabled={step === 2 && (profile.interests || []).length < 3}
            >
              {step === 3 ? 'Launch My Profile' : 'Continue'} →
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
