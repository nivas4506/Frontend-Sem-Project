import React, { useState, useEffect, useRef, useCallback } from 'react';
import { startBackground } from './background';
import { readStored } from './utils/ui';
import { toast } from './utils/toast';
import { contacts } from './data';

import { useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { useSocialPlatform } from './hooks/useSocialPlatform';

import { AuthView } from './components/AuthView';
import { OnboardingView } from './components/OnboardingView';
import { Shell } from './components/Shell';
import { FeedView } from './components/FeedView';
import { ExploreView } from './components/ExploreView';
import { MessagesView } from './components/MessagesView';
import { EventsView } from './components/EventsView';
import { ProfileView } from './components/ProfileView';
import { NotificationsView } from './components/NotificationsView';
import { AdminView } from './components/AdminView';
import { DEMO_ADMIN_ID } from './services/authService';
import { DialogModal } from './components/DialogModal';

export default function App() {
  const {
    session,
    authMode,
    setAuthMode,
    onboardingStep,
    setOnboardingStep,
    profileDraft,
    setProfileDraft,
    makeProfileDraft,
    signIn,
    signUp,
    completeOAuth,
    createOAuthRequest,
    requestPasswordReset,
    updateProfile,
    signOut
  } = useAuth();

  const [partnerIsTyping, setPartnerIsTyping] = useState(false);
  const [background, setBackgroundMode] = useState(() => readStored('scp_background', 'fibers'));
  const [dialogType, setDialogType] = useState('');
  const [dialogData, setDialogData] = useState({});

  const backgroundSetterRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Background WebGL canvas setup
  useEffect(() => {
    const canvas = document.getElementById('fibers-canvas');
    if (canvas) {
      const setBackgroundMode = startBackground(canvas);
      backgroundSetterRef.current = setBackgroundMode;
      setBackgroundMode(background);
      return () => {
        setBackgroundMode.destroy?.();
        if (backgroundSetterRef.current === setBackgroundMode) {
          backgroundSetterRef.current = null;
        }
      };
    }
  }, []);

  const handleToggleBackground = useCallback(() => {
    setBackgroundMode(prev => {
      const next = prev === 'fibers' ? 'silk' : 'fibers';
      if (backgroundSetterRef.current) {
        backgroundSetterRef.current(next);
      }
      try {
        localStorage.setItem('scp_background', JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Socket communication handler
  const handleSocketEvent = useCallback((data) => {
    if (!session) return;

    switch (data.type) {
      case 'auth:success': {
        if (data.postLikes) {
          setState(prev => {
            const updatedPosts = prev.posts.map(p => {
              if (data.postLikes[p.id]) {
                return { ...p, ...data.postLikes[p.id] };
              }
              return p;
            });
            const updated = { ...prev, posts: updatedPosts };
            saveState(updated);
            return updated;
          });
        }
        break;
      }
      case 'message:sent': {
        setState(prev => {
          const updatedMessages = prev.messages.map(m => {
            if (m.id === data.tempId) {
              return { ...m, ...data.message, status: data.status || m.status };
            }
            return m;
          });
          const updated = { ...prev, messages: updatedMessages };
          saveState(updated);
          return updated;
        });
        break;
      }
      case 'message:new': {
        const msg = data.message;
        if (!msg) break;
        setState(prev => {
          if (prev.messages.some(m => m.id === msg.id)) return prev;
          const updatedMessages = [...prev.messages, msg];
          let updated = { ...prev, messages: updatedMessages };
          if (prev.tab === 'messages' && msg.fromUserId === prev.partnerId) {
            msg.status = 'READ';
            sendSocket('message:read', { toUserId: prev.partnerId });
          }
          saveState(updated);
          return updated;
        });
        break;
      }
      case 'message:read_receipt': {
        setState(prev => {
          const updatedMessages = prev.messages.map(m => {
            if (m.toUserId === data.readByUserId) {
              return { ...m, status: 'READ' };
            }
            return m;
          });
          const updated = { ...prev, messages: updatedMessages };
          saveState(updated);
          return updated;
        });
        break;
      }
      case 'typing:indicator': {
        if (data.fromUserId === stateRef.current.partnerId) {
          setPartnerIsTyping(Boolean(data.isTyping));
        }
        break;
      }
      case 'post:like_update': {
        setState(prev => {
          const updatedPosts = prev.posts.map(p => {
            if (p.id === data.postId) {
              const liked = data.byUserId === session.user.id
                ? data.action === 'liked'
                : p.liked;
              return { ...p, likes: data.likesCount, liked };
            }
            return p;
          });
          const updated = { ...prev, posts: updatedPosts };
          saveState(updated);
          return updated;
        });
        break;
      }
      case 'post:broadcast': {
        const post = data.post;
        if (!post) break;
        setState(prev => {
          if (prev.posts.some(p => p.id === post.id)) return prev;
          const updated = { ...prev, posts: [post, ...prev.posts] };
          saveState(updated);
          return updated;
        });
        break;
      }
      case 'notification:new': {
        if (!data.notification) break;
        setState(prev => {
          if (prev.notifications.some(n => n.id === data.notification.id)) return prev;
          const updated = { ...prev, notifications: [data.notification, ...prev.notifications] };
          saveState(updated);
          return updated;
        });
        toast(`${data.notification.name} ${data.notification.action}`);
        break;
      }
      case 'error': {
        toast(data.message || 'The gateway could not complete that action.', 'error');
        break;
      }
      default:
        break;
    }
  }, [session]);

  const { socketConnected, activeUsers, send: sendSocket, socket } = useSocket({
    session,
    onEvent: handleSocketEvent
  });

  const {
    state,
    setState,
    stateRef,
    saveState,
    likePost,
    toggleFollow,
    createPost,
    submitComment,
    likeComment,
    deleteComment,
    sendMessage,
    markMessagesAsRead,
    rsvpEvent,
    resetStateForUser
  } = useSocialPlatform(session, sendSocket);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && session?.user?.onboardingCompleted) {
        e.preventDefault();
        setDialogType(prev => (prev === 'commands' ? '' : 'commands'));
        setDialogData({ contacts, openDialog: (t) => setDialogType(t) });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session]);

  // Auth actions
  const handleAuthenticate = async (formData, mode, portalMode = 'user') => {
    let result;
    if (mode === 'signup') {
      result = await signUp({
        name: formData.name,
        email: formData.email,
        password: formData.password
      });
    } else {
      result = await signIn(formData.email, formData.password, portalMode);
    }
    resetStateForUser(result.user);
    toast(`Welcome, ${result.user.name}!`, 'success');
  };

  const handleOAuthSubmit = async (overrides, pending) => {
    const result = await completeOAuth(pending.provider, overrides, pending.isSignUp);
    setDialogType('');
    resetStateForUser(result.user);
    toast(`Welcome, ${result.user.name}!`, 'success');
  };

  const handleFinishOnboarding = () => {
    updateProfile({ ...profileDraft, onboardingCompleted: true });
    toast('Your profile is ready!', 'success');
  };

  const handleSignOut = () => {
    saveState(stateRef.current);
    signOut();
    resetStateForUser(null);
    setDialogType('');
    toast('You have been signed out.');
  };

  const handleSharePost = async (post) => {
    try {
      await navigator.clipboard.writeText(`${post.author.name}: ${post.content}`);
      toast('Post copied to clipboard.', 'success');
    } catch {
      toast('Could not access the clipboard. Select and copy the post text.', 'error');
    }
  };

  const handleOpenComments = (postId) => {
    const post = state.posts.find(p => p.id === postId);
    if (!post) return;
    setDialogType('comments');
    setDialogData({
      post,
      comments: state.comments[postId] || []
    });
  };

  const handleCommentSubmitWrapper = (postId, content, replyingToId) => {
    const result = submitComment(postId, content, replyingToId);
    if (result?.updatedPost) {
      setDialogData({ post: result.updatedPost, comments: result.updatedComments });
    }
  };

  const handleLikeCommentWrapper = (postId, commentId) => {
    const result = likeComment(postId, commentId);
    if (result?.updatedPost) {
      setDialogData({ post: result.updatedPost, comments: result.updatedComments });
    }
  };

  const handleDeleteCommentWrapper = (postId, commentId, parentId) => {
    const result = deleteComment(postId, commentId, parentId);
    if (result?.updatedPost) {
      setDialogData({ post: result.updatedPost, comments: result.updatedComments });
    }
  };

  const handleStartTyping = (partnerId) => {
    sendSocket('typing:start', { toUserId: partnerId });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      sendSocket('typing:stop', { toUserId: partnerId });
    }, 1400);
  };

  const handleStopTyping = (partnerId) => {
    clearTimeout(typingTimerRef.current);
    sendSocket('typing:stop', { toUserId: partnerId });
  };

  const handleNavigate = (tab) => {
    setDialogType('');
    setState(prev => ({ ...prev, tab }));
    if (tab === 'messages') {
      markMessagesAsRead(state.partnerId);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const unreadCount = state.messages.filter(
    m => m.toUserId === session?.user?.id && m.status !== 'READ'
  ).length;

  if (!session) {
    return (
      <AuthView
        authMode={authMode}
        setAuthMode={setAuthMode}
        background={background}
        onToggleBackground={handleToggleBackground}
        onOpenHelp={() => setDialogType('help')}
        onOpenOAuth={(provider) => {
          const pending = createOAuthRequest(provider, authMode === 'signup');
          setDialogType('oauth');
          setDialogData({ pendingOAuth: pending });
        }}
        onAuthenticate={handleAuthenticate}
      />
    );
  }

  if (session.user.role === 'admin' && session.user.id === DEMO_ADMIN_ID) {
    return <AdminView user={session.user} onSignOut={handleSignOut} />;
  }

  if (!session.user.onboardingCompleted) {
    const draft = profileDraft || makeProfileDraft(session.user);
    return (
      <OnboardingView
        profile={draft}
        setProfile={setProfileDraft}
        step={onboardingStep}
        setStep={setOnboardingStep}
        onFinish={handleFinishOnboarding}
      />
    );
  }

  return (
    <>
      <Shell
        user={session.user}
        tab={state.tab}
        onNavigate={handleNavigate}
        onOpenCreatePost={() => {
          handleNavigate('feed');
          setTimeout(() => {
            document.getElementById('post-composer-input')?.focus();
          }, 100);
        }}
        onOpenMenu={() => {
          setDialogType('menu');
          setDialogData({
            contacts,
            openDialog: (t) => {
              if (t === 'profile') {
                setDialogType('profile');
                setDialogData({ profileDraft: makeProfileDraft(session.user) });
              } else {
                setDialogType(t);
              }
            }
          });
        }}
        onOpenCommands={() => {
          setDialogType('commands');
          setDialogData({ contacts, openDialog: (t) => setDialogType(t) });
        }}
        onSignOut={handleSignOut}
        socketConnected={socketConnected}
        unreadCount={unreadCount}
      >
        {state.tab === 'feed' && (
          <FeedView
            posts={state.posts}
            user={session.user}
            following={state.following}
            onFollowToggle={toggleFollow}
            onLike={likePost}
            onComments={handleOpenComments}
            onShare={handleSharePost}
            onSearchTopic={(tag) => {
              setState(prev => ({ ...prev, searchQuery: tag, tab: 'search' }));
            }}
            onCreatePost={(c, img) => createPost(c, img, socketConnected)}
            contacts={contacts}
          />
        )}

        {(state.tab === 'explore' || state.tab === 'search') && (
          <ExploreView
            tab={state.tab}
            searchQuery={state.searchQuery}
            setSearchQuery={(q) => setState(prev => ({ ...prev, searchQuery: q }))}
            posts={state.posts}
            following={state.following}
            onFollowToggle={toggleFollow}
            onLike={likePost}
            onComments={handleOpenComments}
            onShare={handleSharePost}
            contacts={contacts}
          />
        )}

        {state.tab === 'messages' && (
          <MessagesView
            partnerId={state.partnerId}
            setPartnerId={(pid) => {
              setState(prev => ({ ...prev, partnerId: pid }));
              markMessagesAsRead(pid);
            }}
            messages={state.messages}
            user={session.user}
            socket={{ connected: socketConnected, activeUsers }}
            chatDrafts={state.chatDrafts}
            setChatDrafts={(updater) => {
              setState(prev => ({
                ...prev,
                chatDrafts: typeof updater === 'function' ? updater(prev.chatDrafts) : updater
              }));
            }}
            onSendMessage={(t, audio, pid) => sendMessage(t, audio, pid, socketConnected)}
            onStartTyping={handleStartTyping}
            onStopTyping={handleStopTyping}
            partnerIsTyping={partnerIsTyping}
            contacts={contacts}
          />
        )}

        {state.tab === 'events' && (
          <EventsView
            events={state.events}
            onRsvp={rsvpEvent}
          />
        )}

        {state.tab === 'profile' && (
          <ProfileView
            user={session.user}
            posts={state.posts}
            following={state.following}
            activity={state.activity}
            onEditProfile={() => {
              setDialogType('profile');
              setDialogData({ profileDraft: makeProfileDraft(session.user) });
            }}
            onLike={likePost}
            onComments={handleOpenComments}
            onShare={handleSharePost}
          />
        )}

        {state.tab === 'notifications' && (
          <NotificationsView
            notifications={state.notifications}
          />
        )}
      </Shell>

      <DialogModal
        dialogType={dialogType}
        dialogData={dialogData}
        onClose={() => setDialogType('')}
        currentUser={session.user}
        onOAuthSubmit={handleOAuthSubmit}
        onResetSubmit={(email) => requestPasswordReset(email)}
        onProfileSubmit={updateProfile}
        onCommentSubmit={handleCommentSubmitWrapper}
        onLikeComment={handleLikeCommentWrapper}
        onDeleteComment={handleDeleteCommentWrapper}
        onNavigate={handleNavigate}
        onPartnerSelect={(partnerId) => {
          setState(prev => ({ ...prev, partnerId, tab: 'messages' }));
          markMessagesAsRead(partnerId);
        }}
        onCreatePost={() => {
          handleNavigate('feed');
          setTimeout(() => {
            document.getElementById('post-composer-input')?.focus();
          }, 100);
        }}
        onSwitchBackground={handleToggleBackground}
        onSignOut={handleSignOut}
      />
    </>
  );
}
