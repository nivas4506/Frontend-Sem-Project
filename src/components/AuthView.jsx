import React, { useState } from 'react';
import { Icon, ProviderMark, providers } from './Icons';
import logoImg from '../assets/logo.png';
import { DEMO_ADMIN_EMAIL, DEMO_ADMIN_PASSWORD } from '../services/authService';

export function AuthView({
  authMode,
  setAuthMode,
  background,
  onToggleBackground,
  onOpenHelp,
  onOpenOAuth,
  onAuthenticate
}) {
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordGroup, setShowPasswordGroup] = useState(authMode === 'signup');
  const [expandedProviders, setExpandedProviders] = useState(false);
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [portalMode, setPortalMode] = useState('user');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    terms: true
  });

  const adminMode = portalMode === 'admin';
  const signup = authMode === 'signup' && !adminMode;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const calculatePasswordStrength = (pass) => {
    if (!pass) return '';
    const score = [
      pass.length >= 8,
      /[0-9]/.test(pass),
      /[A-Z]/.test(pass),
      /[^A-Za-z0-9]/.test(pass)
    ].filter(Boolean).length;
    return `Strength: ${['Weak', 'Fair', 'Good', 'Strong'][Math.max(0, score - 1)]}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');

    // In signin mode: if password group is hidden, show it first (mimics vanilla JS behavior)
    if (!signup && !showPasswordGroup) {
      setShowPasswordGroup(true);
      return;
    }

    setSubmitting(true);
    try {
      await onAuthenticate(formData, authMode, portalMode);
    } catch (err) {
      setAuthError(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const providerList = Object.entries(providers);

  const renderOAuthButtons = () => (
    <>
      <div className={`auth-oauth-group ${signup ? 'provider-grid' : ''}`}>
        {providerList.map(([id, name], index) => {
          const isExtra = index > 2;
          if (isExtra && !expandedProviders) return null;
          return (
            <button
              key={id}
              type="button"
              className="auth-btn-oauth"
              onClick={() => onOpenOAuth(id)}
            >
              <ProviderMark provider={id} />
              <span>{signup ? name : `Sign in with ${name}`}</span>
            </button>
          );
        })}
      </div>
      <div className="auth-view-more">
        <button
          type="button"
          className="auth-view-more-btn"
          aria-expanded={expandedProviders}
          onClick={() => setExpandedProviders(prev => !prev)}
        >
          {signup
            ? (expandedProviders ? 'View less' : 'More providers (Discord, X)')
            : (expandedProviders ? 'View less' : 'View more')}
        </button>
      </div>
    </>
  );

  return (
    <>
      <header className="auth-header">
        <div className="brand">
          <img src={logoImg} alt="Platform Logo" className="brand-logo" />
          <span className="auth-brand-name">Social Connectivity Platform</span>
        </div>
        <div className="row">
          <button
            type="button"
            className="pill background-toggle"
            onClick={onToggleBackground}
          >
            <Icon name="sparkle" size={14} />{' '}
            <span>{background === 'fibers' ? 'Ghost Fibers' : 'Silk Gradient'}</span>
          </button>
          <button type="button" className="pill" onClick={onOpenHelp}>
            Need Help?
          </button>
        </div>
      </header>

      <main className="auth-main">
        <div className="auth-box-wrapper animate-fade-in">
          <div className="auth-box-halo" aria-hidden="true"></div>
          <section className={`auth-box-card ${signup ? 'signup-card' : ''}`}>
            <div className="portal-switch" role="group" aria-label="Choose portal">
              <button
                type="button"
                className={`portal-switch-button ${portalMode === 'user' ? 'active' : ''}`}
                aria-pressed={portalMode === 'user'}
                onClick={() => {
                  setPortalMode('user');
                  setAuthMode('signin');
                  setShowPasswordGroup(true);
                  setAuthError('');
                }}
              >
                User portal
              </button>
              <button
                type="button"
                className={`portal-switch-button ${portalMode === 'admin' ? 'active' : ''}`}
                aria-pressed={portalMode === 'admin'}
                onClick={() => {
                  setPortalMode('admin');
                  setAuthMode('signin');
                  setShowPasswordGroup(true);
                  setAuthError('');
                }}
              >
                Admin portal
              </button>
            </div>
            <h1 className="auth-heading">{signup ? 'Sign up' : 'Sign in'}</h1>
            <p className="auth-subheading">
              {adminMode
                ? 'Sign in with administrator credentials'
                : (signup ? 'Already have an account?' : 'New user?')}{' '}
              {!adminMode && (
                <button
                  type="button"
                  className="auth-subheading-link"
                  onClick={() => {
                    setAuthMode(signup ? 'signin' : 'signup');
                    setShowPasswordGroup(!signup);
                    setAuthError('');
                  }}
                >
                  {signup ? 'Sign in' : 'Create an account'}
                </button>
              )}
            </p>

            {authError && (
              <div id="auth-error" className="auth-error-banner" role="alert">
                {authError}
              </div>
            )}

            {adminMode && (
              <div className="admin-demo-hint">
                Demo credentials: <strong>{DEMO_ADMIN_EMAIL}</strong> / <strong>{DEMO_ADMIN_PASSWORD}</strong>
              </div>
            )}

            {signup && (
              <>
                {renderOAuthButtons()}
                <div className="auth-divider">
                  <span className="auth-divider-text">or with email</span>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} data-mode={authMode}>
              {signup && (
                <div className="auth-input-group">
                  <label className="field-label" htmlFor="name">Full name</label>
                  <input
                    id="name"
                    name="name"
                    className="auth-input"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Full name"
                    autoComplete="name"
                    minLength={2}
                    maxLength={80}
                    required
                    disabled={submitting}
                  />
                </div>
              )}

              <div className="auth-input-group">
                <label className="field-label" htmlFor="email">Email address</label>
                <input
                  id="email"
                  name="email"
                  className="auth-input"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email address"
                  autoComplete="email"
                  required
                  disabled={submitting}
                />
              </div>

              {(signup || showPasswordGroup) && (
                <div id="password-group" className="auth-input-group">
                  <label className="field-label" htmlFor="password">
                    {signup ? 'Create password' : 'Password'}
                  </label>
                  <div className="password-wrapper">
                    <input
                      id="password"
                      name="password"
                      className="auth-input"
                      type={showPassword ? 'text' : 'password'}
                      placeholder={signup ? 'Create password' : 'Enter your password'}
                      autoComplete={signup ? 'new-password' : 'current-password'}
                      value={formData.password}
                      onChange={handleChange}
                      minLength={signup ? 6 : undefined}
                      required
                      disabled={submitting}
                      autoFocus={!signup && showPasswordGroup}
                    />
                    <button
                      type="button"
                      className="password-toggle icon-button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword(prev => !prev)}
                    >
                      <Icon name="eye" />
                    </button>
                  </div>
                  {signup ? (
                    <div id="password-strength" className="password-strength" aria-live="polite">
                      {calculatePasswordStrength(formData.password)}
                    </div>
                  ) : (
                    <div className="text-right">
                      <button
                        type="button"
                        className="text-button small"
                        onClick={onOpenHelp}
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              )}

              {signup && (
                <label className="terms-row">
                  <input
                    type="checkbox"
                    name="terms"
                    checked={formData.terms}
                    onChange={handleChange}
                    required
                  />{' '}
                  <span>I agree to the Terms and Privacy Policy.</span>
                </label>
              )}

              <button
                type="submit"
                className="auth-btn-continue"
                disabled={submitting}
              >
                {submitting ? 'Please wait…' : (signup ? 'Create account' : 'Continue')}
              </button>
            </form>

            {!signup && !adminMode && (
              <>
                <div className="auth-divider">
                  <span className="auth-divider-text">Or</span>
                </div>
                {renderOAuthButtons()}
              </>
            )}

            <div className="auth-card-footer">
              {signup ? 'Need assistance?' : "Can't sign in?"}{' '}
              <button type="button" className="text-button" onClick={onOpenHelp}>
                {signup ? 'Get help' : 'Get help'}
              </button>
            </div>
          </section>
        </div>
      </main>

      <footer className="auth-footer">
        <p>
          <Icon name="lock" size={13} /> Local account & OAuth flow demo
        </p>
        <small>Social Connectivity Platform · React & Vite</small>
      </footer>
    </>
  );
}
