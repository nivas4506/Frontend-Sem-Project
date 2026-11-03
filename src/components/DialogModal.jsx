import React, { useState, useEffect, useRef } from 'react';
import { Icon, Avatar, ProviderMark, providers } from './Icons';
import { navigation, avatars } from '../data';
import { mediaURL } from '../utils/ui';

export function DialogModal({
  dialogType,
  dialogData,
  onClose,
  currentUser,
  // Dialog specific actions
  onOAuthSubmit,
  onResetSubmit,
  onProfileSubmit,
  onCommentSubmit,
  onLikeComment,
  onDeleteComment,
  onNavigate,
  onPartnerSelect,
  onCreatePost,
  onSwitchBackground,
  onSignOut
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (dialogType) {
      document.body.classList.add('dialog-open');
    } else {
      document.body.classList.remove('dialog-open');
    }
    return () => {
      document.body.classList.remove('dialog-open');
    };
  }, [dialogType]);

  // Click outside to close
  const handleBackdropClick = (e) => {
    if (dialogRef.current && !dialogRef.current.contains(e.target)) {
      onClose();
    }
  };

  if (!dialogType) return null;

  return (
    <div
      className="modal-overlay"
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: dialogType === 'comments' ? 'stretch' : 'center',
        justifyContent: dialogType === 'comments' ? 'flex-end' : 'center',
        background: 'rgba(3, 7, 18, 0.72)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <dialog
        ref={dialogRef}
        id="app-dialog"
        open
        className={dialogType === 'comments' ? 'discussion-dialog' : ''}
        style={{
          margin: dialogType === 'comments' ? '0 0 0 auto' : 'auto',
          display: 'block'
        }}
      >
        {dialogType === 'help' && (
          <HelpDialog onClose={onClose} onResetSubmit={onResetSubmit} />
        )}
        {dialogType === 'oauth' && (
          <OAuthDialog
            pending={dialogData.pendingOAuth}
            onClose={onClose}
            onOAuthSubmit={onOAuthSubmit}
          />
        )}
        {dialogType === 'commands' && (
          <CommandsDialog
            onClose={onClose}
            onNavigate={onNavigate}
            onPartnerSelect={onPartnerSelect}
            onCreatePost={onCreatePost}
            onOpenHelp={() => {
              onClose();
              dialogData.openDialog('help');
            }}
            contacts={dialogData.contacts}
          />
        )}
        {dialogType === 'menu' && (
          <MenuDialog
            onClose={onClose}
            onEditProfile={() => {
              onClose();
              dialogData.openDialog('profile');
            }}
            onSwitchBackground={onSwitchBackground}
            onOpenHelp={() => {
              onClose();
              dialogData.openDialog('help');
            }}
            onSignOut={onSignOut}
          />
        )}
        {dialogType === 'profile' && (
          <ProfileEditDialog
            profile={dialogData.profileDraft}
            onClose={onClose}
            onSubmit={onProfileSubmit}
          />
        )}
        {dialogType === 'comments' && (
          <CommentsDialog
            post={dialogData.post}
            comments={dialogData.comments}
            currentUser={currentUser}
            onClose={onClose}
            onCommentSubmit={onCommentSubmit}
            onLikeComment={onLikeComment}
            onDeleteComment={onDeleteComment}
          />
        )}
      </dialog>
    </div>
  );
}

function DialogHeader({ title, onClose }) {
  return (
    <header className="modal-header">
      <h2 id="dialog-title">{title}</h2>
      <button
        type="button"
        className="modal-close-btn"
        aria-label="Close dialog"
        onClick={onClose}
      >
        <Icon name="close" />
      </button>
    </header>
  );
}

function HelpDialog({ onClose, onResetSubmit }) {
  const [resetEmail, setResetEmail] = useState('');
  const [resetStatus, setResetStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!resetEmail) return;
    setSubmitting(true);
    try {
      await onResetSubmit(resetEmail);
      setResetStatus('Demo reset request recorded. No email has been sent.');
    } catch (err) {
      setResetStatus(err.message || 'Error processing reset');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader title="How can we help?" onClose={onClose} />
      <div className="stack modal-body">
        <p>New here? Create an account, set up your profile, and start connecting with the community.</p>
        <details>
          <summary>How do I sign in?</summary>
          <p>Use an email registered in this browser, or try one of the simulated provider flows.</p>
        </details>
        <details>
          <summary>Where is my account stored?</summary>
          <p>This project saves demo accounts, posts, and preferences in your browser’s local storage.</p>
        </details>
        <details>
          <summary>How do live messages work?</summary>
          <p>Start the JavaScript gateway with <code>npm run server</code>. Text messages, presence, and likes then update through the browser’s WebSocket API.</p>
        </details>

        <form onSubmit={handleReset} id="reset-form">
          <h3>Password reset demo</h3>
          <p className="small muted">This demo records the request; it does not send email.</p>
          <label className="field-label" htmlFor="reset-email">Account email</label>
          <input
            id="reset-email"
            className="auth-input"
            type="email"
            required
            placeholder="you@example.com"
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
          />
          <button className="auth-btn-continue" type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : 'Request reset'}
          </button>
          {resetStatus && (
            <p id="reset-result" className="small accent" role="status">
              {resetStatus}
            </p>
          )}
        </form>
      </div>
    </>
  );
}

function OAuthDialog({ pending, onClose, onOAuthSubmit }) {
  if (!pending) return null;
  const name = providers[pending.provider] || pending.provider;
  const [oauthName, setOauthName] = useState('');
  const [oauthEmail, setOauthEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onOAuthSubmit({ name: oauthName, email: oauthEmail }, pending);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <DialogHeader title={`${name} OAuth 2.0 Demo`} onClose={onClose} />
      <form onSubmit={handleSubmit} id="oauth-form" className="stack modal-body">
        <div className="text-center">
          <ProviderMark provider={pending.provider} />
          <h3>{pending.isSignUp ? 'Sign up' : 'Sign in'} with {name}</h3>
          <p className="small muted">Simulated provider authorization for this local demo.</p>
        </div>

        <div className="scope-list">
          <strong>Requested scopes</strong>
          <p>✓ openid — identity</p>
          <p>✓ profile — name and avatar</p>
          <p>✓ email — email address</p>
        </div>

        <label className="field-label" htmlFor="oauth-name">Your name</label>
        <input
          id="oauth-name"
          name="oauth-name"
          className="auth-input"
          placeholder={`${name} User`}
          maxLength={80}
          value={oauthName}
          onChange={(e) => setOauthName(e.target.value)}
        />

        <label className="field-label" htmlFor="oauth-email">Email address</label>
        <input
          id="oauth-email"
          name="oauth-email"
          className="auth-input"
          type="email"
          placeholder={`user@${pending.provider}.com`}
          value={oauthEmail}
          onChange={(e) => setOauthEmail(e.target.value)}
        />

        <details>
          <summary>Inspect demo PKCE parameters</summary>
          <pre>
{`client_id: scp-web-client-2026
response_type: code
state: ${pending.state}
code_challenge: ${pending.codeChallenge}`}
          </pre>
        </details>

        <div className="row">
          <button type="button" className="secondary-button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="auth-btn-continue" disabled={submitting}>
            {submitting ? 'Authorizing…' : 'Authorize & Continue'}
          </button>
        </div>
      </form>
    </>
  );
}

function CommandsDialog({
  onClose,
  onNavigate,
  onPartnerSelect,
  onCreatePost,
  onOpenHelp,
  contacts
}) {
  const [query, setQuery] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  const commandList = [
    ...navigation.map(([id, glyph, label]) => ({
      type: 'navigate',
      target: id,
      label,
      glyph
    })),
    { type: 'create-post', label: 'Create New Post', glyph: 'plus' },
    { type: 'help', label: 'Help & Documentation', glyph: 'help' },
    ...contacts.map(person => ({
      type: 'partner',
      target: person.id,
      label: `Message ${person.name}`,
      glyph: 'message'
    }))
  ].filter(cmd => cmd.label.toLowerCase().includes(query.toLowerCase()));

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => (i + 1) % (commandList.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => (i - 1 + commandList.length) % (commandList.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (commandList[focusedIndex]) {
        executeCommand(commandList[focusedIndex]);
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const executeCommand = (cmd) => {
    onClose();
    if (cmd.type === 'navigate') onNavigate(cmd.target);
    else if (cmd.type === 'create-post') onCreatePost();
    else if (cmd.type === 'help') onOpenHelp();
    else if (cmd.type === 'partner') onPartnerSelect(cmd.target);
  };

  return (
    <>
      <DialogHeader title="Search & Commands" onClose={onClose} />
      <label className="sr-only" htmlFor="command-input">Find a command</label>
      <input
        id="command-input"
        className="auth-input"
        type="search"
        placeholder="Where would you like to go?"
        autoComplete="off"
        autoFocus
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setFocusedIndex(0);
        }}
        onKeyDown={handleKeyDown}
      />
      <div id="command-results" className="command-results">
        {commandList.length > 0 ? (
          commandList.map((cmd, idx) => (
            <button
              key={idx}
              type="button"
              className={`command-option ${idx === focusedIndex ? 'active' : ''}`}
              onClick={() => executeCommand(cmd)}
            >
              <Icon name={cmd.glyph} /> {cmd.label}
            </button>
          ))
        ) : (
          <p className="empty-state">No matching commands.</p>
        )}
      </div>
      <p className="small muted">↑ ↓ to navigate · Enter to select · Esc to close</p>
    </>
  );
}

function MenuDialog({ onClose, onEditProfile, onSwitchBackground, onOpenHelp, onSignOut }) {
  return (
    <>
      <DialogHeader title="More Options" onClose={onClose} />
      <div className="stack modal-body">
        <button
          type="button"
          className="command-option"
          onClick={() => { onClose(); onEditProfile(); }}
        >
          <Icon name="settings" /> Profile & Settings
        </button>
        <button
          type="button"
          className="command-option"
          onClick={() => { onClose(); onSwitchBackground(); }}
        >
          <Icon name="sparkle" /> Switch Background
        </button>
        <button
          type="button"
          className="command-option"
          onClick={() => { onClose(); onOpenHelp(); }}
        >
          <Icon name="help" /> Help & Documentation
        </button>
        <button
          type="button"
          className="command-option"
          onClick={() => { onClose(); onSignOut(); }}
        >
          <Icon name="logout" /> Sign Out
        </button>
      </div>
    </>
  );
}

function ProfileEditDialog({ profile, onClose, onSubmit }) {
  const [draft, setDraft] = useState({ ...profile });

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'username') {
      value = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    }
    setDraft(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(draft);
    onClose();
  };

  return (
    <>
      <DialogHeader title="Edit Profile" onClose={onClose} />
      <form onSubmit={handleSubmit} id="profile-form" className="modal-body">
        <div className="identity-preview row">
          <Avatar user={draft} className="large" />
          <div>
            <strong id="preview-name">{draft.name}</strong>
            <p className="accent" id="preview-handle">@{draft.username}</p>
            <small id="preview-bio">{draft.bio}</small>
          </div>
        </div>

        <p className="field-label">Select Avatar</p>
        <div className="avatar-options">
          {avatars.map((src, index) => (
            <button
              key={index}
              type="button"
              className={`avatar-option ${draft.avatar === src ? 'selected' : ''}`}
              aria-pressed={draft.avatar === src}
              onClick={() => setDraft(prev => ({ ...prev, avatar: src }))}
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
            value={draft.name}
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
            value={draft.username}
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
          value={draft.bio}
          onChange={handleChange}
        />

        <button className="auth-btn-continue" type="submit">
          Save changes
        </button>
      </form>
    </>
  );
}

function CommentItem({ comment, currentUser, parentId = '', onReply, onLike, onDelete }) {
  const isOwner = comment.author.id === currentUser.id;

  return (
    <article className={`comment ${parentId ? 'reply' : ''}`}>
      <div className="author-row">
        <Avatar user={comment.author} />
        <div>
          <strong>{comment.author.name}</strong>
          <small>@{comment.author.handle} • {comment.timestamp}</small>
        </div>
      </div>
      <p>{comment.content}</p>
      <div className="row small">
        {!parentId && (
          <>
            <button
              type="button"
              className={`text-button ${comment.liked ? 'liked' : ''}`}
              aria-pressed={!!comment.liked}
              onClick={() => onLike(comment.id)}
            >
              ♡ {comment.likes || 0}
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => onReply(comment)}
            >
              Reply
            </button>
          </>
        )}
        {isOwner && (
          <button
            type="button"
            className="text-button"
            onClick={() => onDelete(comment.id, parentId)}
          >
            Delete
          </button>
        )}
      </div>

      {(comment.replies || []).map(reply => (
        <CommentItem
          key={reply.id}
          comment={reply}
          currentUser={currentUser}
          parentId={comment.id}
          onReply={onReply}
          onLike={onLike}
          onDelete={onDelete}
        />
      ))}
    </article>
  );
}

function CommentsDialog({
  post,
  comments = [],
  currentUser,
  onClose,
  onCommentSubmit,
  onLikeComment,
  onDeleteComment
}) {
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const listRef = useRef(null);

  const emojis = ['❤️', '🔥', '👏', '🚀', '💡', '✨', '🙌'];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onCommentSubmit(post.id, commentText, replyingTo?.id);
    setCommentText('');
    setReplyingTo(null);

    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 50);
  };

  return (
    <>
      <DialogHeader title="Discussion" onClose={onClose} />
      <div className="discussion-summary">
        <strong>{post.author.name}</strong>
        <p>{post.content}</p>
      </div>

      <div id="comments-list" className="comments-list" ref={listRef}>
        {comments.length > 0 ? (
          comments.map(comment => (
            <CommentItem
              key={comment.id}
              comment={comment}
              currentUser={currentUser}
              onReply={(c) => setReplyingTo(c)}
              onLike={(cid) => onLikeComment(post.id, cid)}
              onDelete={(cid, pid) => onDeleteComment(post.id, cid, pid)}
            />
          ))
        ) : (
          <p className="empty-state">
            No comments yet. Be the first to share your perspective!
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} id="comment-form" className="comment-form">
        {replyingTo && (
          <div id="reply-banner" className="row between">
            <span>Replying to @{replyingTo.author.handle}</span>
            <button
              type="button"
              className="text-button"
              aria-label="Cancel reply"
              onClick={() => setReplyingTo(null)}
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        )}

        <div className="row quick-emojis">
          {emojis.map(em => (
            <button
              key={em}
              type="button"
              className="text-button"
              aria-label={`Insert ${em}`}
              onClick={() => setCommentText(prev => (prev + em).slice(0, 2000))}
            >
              {em}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="comment-input">Write a comment</label>
        <textarea
          id="comment-input"
          className="auth-input"
          name="content"
          placeholder="Share your perspective…"
          maxLength={2000}
          required
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
        />
        <button className="auth-btn-continue" type="submit">
          Post comment <Icon name="send" size={14} />
        </button>
      </form>
    </>
  );
}
