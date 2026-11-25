import { useState, useCallback, useRef, useEffect } from 'react';
import { readStored, makeId } from '../utils/ui';
import { toast } from '../utils/toast';
import { apiService } from '../services/apiService';
import {
  initialMessages,
  seedComments,
  seedEvents,
  seedNotifications,
  seedPosts,
  stories as seedStories
} from '../data';

function mergeSeedPosts(savedPosts) {
  if (!savedPosts) return structuredClone(seedPosts);
  const known = new Set(savedPosts.map(p => p.id));
  const missing = seedPosts.filter(p => !known.has(p.id));
  return missing.length ? [...savedPosts, ...structuredClone(missing)] : savedPosts;
}

function buildInitialState(user) {
  const saved = user ? readStored(`scp_data_${user.id}`, {}) : {};
  return {
    tab: 'feed',
    partnerId: 's1',
    searchQuery: '',
    chatDrafts: {},
    posts: mergeSeedPosts(saved.posts),
    events: saved.events || structuredClone(seedEvents),
    comments: saved.comments || structuredClone(seedComments),
    following: saved.following || [],
    saved: saved.saved || [],
    messages: saved.messages || initialMessages(user?.id),
    notifications: saved.notifications || structuredClone(seedNotifications),
    activity: saved.activity || {},
    stories: saved.stories || structuredClone(seedStories),
    seenStories: saved.seenStories || readStored('scp_seen_stories', []),
    recommendations: saved.recommendations || []
  };
}

export function useSocialPlatform(session, sendSocket) {
  const [state, setState] = useState(() => buildInitialState(session?.user));

  const stateRef = useRef(state);
  stateRef.current = state;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const saveState = useCallback((currentState) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    const {
      posts, events, comments, following, saved, messages,
      notifications, activity, stories, seenStories, recommendations
    } = currentState;
    try {
      localStorage.setItem(
        `scp_data_${currentSession.user.id}`,
        JSON.stringify({
          posts, events, comments, following, saved, messages,
          notifications, activity, stories, seenStories, recommendations
        })
      );
    } catch {
      toast('Browser storage is full. This change is available for the current visit.', 'error');
    }
  }, []);

  // Hydrate social state from the Python FastAPI backend when available.
  useEffect(() => {
    const userId = session?.user?.id;
    const token = session?.jwt?.accessToken;
    if (!userId || !token) return;
    let cancelled = false;
    apiService.getState(token)
      .then((remote) => {
        if (cancelled || !remote) return;
        setState(prev => {
          const updated = {
            ...prev,
            posts: Array.isArray(remote.posts) ? remote.posts : prev.posts,
            events: Array.isArray(remote.events) ? remote.events : prev.events,
            comments: remote.comments || prev.comments,
            following: Array.isArray(remote.following) ? remote.following : prev.following,
            saved: Array.isArray(remote.saved) ? remote.saved : prev.saved,
            messages: Array.isArray(remote.messages) ? remote.messages : prev.messages,
            notifications: Array.isArray(remote.notifications) ? remote.notifications : prev.notifications,
            activity: remote.activity || prev.activity,
            stories: Array.isArray(remote.stories) && remote.stories.length ? remote.stories : prev.stories,
            seenStories: Array.isArray(remote.seenStories) ? remote.seenStories : prev.seenStories,
            recommendations: Array.isArray(remote.recommendations) ? remote.recommendations : prev.recommendations
          };
          saveState(updated);
          return updated;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, session?.jwt?.accessToken, saveState]);

  const recordActivity = useCallback(() => {
    const day = new Date().toLocaleDateString('en-CA');
    setState(prev => {
      const updated = {
        ...prev,
        activity: {
          ...prev.activity,
          [day]: (prev.activity[day] || 0) + 1
        }
      };
      saveState(updated);
      return updated;
    });
  }, [saveState]);

  const likePost = useCallback((postId) => {
    let sentViaWs = false;
    setState(prev => {
      const updatedPosts = prev.posts.map(p => {
        if (p.id === postId) {
          const liked = !p.liked;
          const likes = Math.max(0, p.likes + (liked ? 1 : -1));
          sentViaWs = Boolean(sendSocket?.('post:like', { postId, action: liked ? 'like' : 'unlike' }));
          if (liked) recordActivity();
          return { ...p, liked, likes };
        }
        return p;
      });
      const updated = { ...prev, posts: updatedPosts };
      saveState(updated);
      return updated;
    });
    const token = sessionRef.current?.jwt?.accessToken;
    if (!sentViaWs && token) {
      apiService.toggleLike(postId, token).catch(() => {});
    }
  }, [sendSocket, recordActivity, saveState]);

  const toggleFollow = useCallback((id) => {
    setState(prev => {
      const isFollowing = prev.following.includes(id);
      const following = isFollowing
        ? prev.following.filter(fid => fid !== id)
        : [...prev.following, id];
      if (!isFollowing) recordActivity();
      const updated = { ...prev, following };
      saveState(updated);
      return updated;
    });
    const token = sessionRef.current?.jwt?.accessToken;
    if (token) {
      apiService.toggleFollow(id, token).catch(() => {});
    }
  }, [recordActivity, saveState]);

  const createPost = useCallback((content, image, isSocketConnected) => {
    const user = sessionRef.current?.user;
    if (!user) return;
    const post = {
      id: makeId('post'),
      author: {
        id: user.id,
        name: user.name,
        handle: user.username || 'user',
        avatar: user.avatar,
        role: user.role
      },
      content,
      image,
      likes: 0,
      comments: 0,
      liked: false,
      timestamp: 'Just now',
      tags: user.interests || [],
      createdAt: Date.now()
    };

    setState(prev => {
      const updated = { ...prev, posts: [post, ...prev.posts] };
      saveState(updated);
      return updated;
    });

    const token = sessionRef.current?.jwt?.accessToken;
    if (token) {
      (async () => {
        let finalImage = image;
        if (image && image.startsWith('data:')) {
          try {
            const uploaded = await apiService.uploadMedia(image, token);
            if (uploaded?.url) finalImage = uploaded.url;
          } catch { /* fallback to inline data URL */ }
        }
        await apiService.createPost(
          { id: post.id, content, image: finalImage, tags: post.tags, createdAt: post.createdAt },
          token
        );
      })().catch(() => {});
    }
    sendSocket?.('post:new', { post });
    recordActivity();
    toast(isSocketConnected ? 'Post published to the live feed!' : 'Post saved to your local feed.', 'success');
  }, [sendSocket, recordActivity, saveState]);

  const submitComment = useCallback((postId, content, replyingToId) => {
    const user = sessionRef.current?.user;
    if (!user) return;
    const comment = {
      id: makeId('comment'),
      author: {
        id: user.id,
        name: user.name,
        handle: user.username || 'user',
        avatar: user.avatar
      },
      content,
      timestamp: 'Just now',
      likes: 0,
      liked: false,
      replies: []
    };

    let updatedPostObj = null;
    let updatedCommentsList = null;

    setState(prev => {
      const postComments = structuredClone(prev.comments[postId] || []);
      if (replyingToId) {
        const parent = postComments.find(c => c.id === replyingToId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(comment);
        } else {
          postComments.push(comment);
        }
      } else {
        postComments.push(comment);
      }

      const updatedPosts = prev.posts.map(p => {
        if (p.id === postId) {
          return { ...p, comments: p.comments + 1 };
        }
        return p;
      });

      const updatedComments = { ...prev.comments, [postId]: postComments };
      const updated = { ...prev, posts: updatedPosts, comments: updatedComments };
      saveState(updated);

      updatedPostObj = updatedPosts.find(p => p.id === postId);
      updatedCommentsList = postComments;

      return updated;
    });

    recordActivity();
    const token = sessionRef.current?.jwt?.accessToken;
    if (token) {
      apiService.addComment(postId, { id: comment.id, content, replyingToId }, token).catch(() => {});
    }
    return { updatedPost: updatedPostObj, updatedComments: updatedCommentsList };
  }, [recordActivity, saveState]);

  const likeComment = useCallback((postId, commentId) => {
    let updatedPostObj = null;
    let updatedCommentsList = null;

    setState(prev => {
      const postComments = structuredClone(prev.comments[postId] || []);
      const comment = postComments.find(c => c.id === commentId);
      if (comment) {
        comment.liked = !comment.liked;
        comment.likes = (comment.likes || 0) + (comment.liked ? 1 : -1);
      }
      const updatedComments = { ...prev.comments, [postId]: postComments };
      const updated = { ...prev, comments: updatedComments };
      saveState(updated);

      updatedPostObj = prev.posts.find(p => p.id === postId);
      updatedCommentsList = postComments;
      return updated;
    });

    const token = sessionRef.current?.jwt?.accessToken;
    if (token) {
      apiService.toggleCommentLike(commentId, token).catch(() => {});
    }
    return { updatedPost: updatedPostObj, updatedComments: updatedCommentsList };
  }, [saveState]);

  const deleteComment = useCallback((postId, commentId, parentId) => {
    let updatedPostObj = null;
    let updatedCommentsList = null;

    setState(prev => {
      const postComments = structuredClone(prev.comments[postId] || []);
      let deletedCount = 1;

      if (parentId) {
        const parent = postComments.find(c => c.id === parentId);
        if (parent && parent.replies) {
          parent.replies = parent.replies.filter(r => r.id !== commentId);
        }
      } else {
        const idx = postComments.findIndex(c => c.id === commentId && c.author.id === sessionRef.current?.user?.id);
        if (idx !== -1) {
          const [removed] = postComments.splice(idx, 1);
          deletedCount = 1 + (removed.replies?.length || 0);
        }
      }

      const updatedPosts = prev.posts.map(p => {
        if (p.id === postId) {
          return { ...p, comments: Math.max(0, p.comments - deletedCount) };
        }
        return p;
      });

      const updatedComments = { ...prev.comments, [postId]: postComments };
      const updated = { ...prev, posts: updatedPosts, comments: updatedComments };
      saveState(updated);

      updatedPostObj = updatedPosts.find(p => p.id === postId);
      updatedCommentsList = postComments;
      return updated;
    });

    const token = sessionRef.current?.jwt?.accessToken;
    if (token) {
      apiService.deleteComment(commentId, token).catch(() => {});
    }
    return { updatedPost: updatedPostObj, updatedComments: updatedCommentsList };
  }, [saveState]);

  const sendMessage = useCallback((text, audio = '', targetPartnerId, isSocketConnected) => {
    const user = sessionRef.current?.user;
    if (!user || (!text.trim() && !audio)) return;
    const partner = targetPartnerId || stateRef.current.partnerId;

    const message = {
      id: makeId('msg'),
      fromUserId: user.id,
      toUserId: partner,
      senderName: user.name,
      text: text.trim(),
      audio,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      status: isSocketConnected ? 'SENDING' : 'LOCAL'
    };

    setState(prev => {
      const updated = { ...prev, messages: [...prev.messages, message] };
      saveState(updated);
      return updated;
    });

    const sentViaWs = Boolean(sendSocket?.('message:send', {
      toUserId: partner,
      text: message.text,
      audio,
      tempId: message.id
    }));

    const token = sessionRef.current?.jwt?.accessToken;
    if (!sentViaWs && token) {
      (async () => {
        let finalAudio = audio;
        if (audio && audio.startsWith('data:')) {
          try {
            const uploaded = await apiService.uploadMedia(audio, token);
            if (uploaded?.url) finalAudio = uploaded.url;
          } catch { /* fallback to inline audio data URL */ }
        }
        await apiService.sendMessage(
          { id: message.id, toUserId: partner, text: message.text, audio: finalAudio },
          token
        );
      })().catch(() => {});
    }

    recordActivity();
    if (!isSocketConnected) {
      toast('Saved locally. Start the gateway to send live messages.');
    }
  }, [sendSocket, recordActivity, saveState]);

  const markMessagesAsRead = useCallback((partnerId) => {
    setState(prev => {
      let hasChange = false;
      const updatedMessages = prev.messages.map(m => {
        if (m.fromUserId === partnerId && m.status !== 'READ') {
          hasChange = true;
          return { ...m, status: 'READ' };
        }
        return m;
      });
      if (hasChange) {
        sendSocket?.('message:read', { toUserId: partnerId });
        const token = sessionRef.current?.jwt?.accessToken;
        if (token) {
          apiService.markMessagesRead(partnerId, token).catch(() => {});
        }
        const updated = { ...prev, messages: updatedMessages };
        saveState(updated);
        return updated;
      }
      return prev;
    });
  }, [sendSocket, saveState]);

  const rsvpEvent = useCallback((eventId) => {
    setState(prev => {
      let rsvpdState = false;
      let eventTitle = '';
      const updatedEvents = prev.events.map(ev => {
        if (ev.id === eventId) {
          const rsvpd = !ev.rsvpd;
          rsvpdState = rsvpd;
          eventTitle = ev.title;
          const attendees = ev.attendees + (rsvpd ? 1 : -1);
          return { ...ev, rsvpd, attendees };
        }
        return ev;
      });
      if (rsvpdState) recordActivity();
      const updated = { ...prev, events: updatedEvents };
      saveState(updated);
      toast(rsvpdState ? `RSVP confirmed for ${eventTitle}` : 'RSVP cancelled.');
      return updated;
    });
    const token = sessionRef.current?.jwt?.accessToken;
    if (token) {
      apiService.toggleRsvp(eventId, token).catch(() => {});
    }
  }, [recordActivity, saveState]);

  const resetStateForUser = useCallback((user) => {
    const freshlyInit = buildInitialState(user);
    setState(freshlyInit);
    return freshlyInit;
  }, []);

  const toggleSave = useCallback((postId) => {
    const isSaved = stateRef.current.saved.includes(postId);
    setState(prev => {
      const saved = prev.saved.includes(postId)
        ? prev.saved.filter(id => id !== postId)
        : [...prev.saved, postId];
      const updated = { ...prev, saved };
      saveState(updated);
      return updated;
    });
    const token = sessionRef.current?.jwt?.accessToken;
    if (token) {
      apiService.toggleSave(postId, token).catch(() => {});
    }
    toast(isSaved ? 'Removed from saved posts.' : 'Saved to your collection.', isSaved ? undefined : 'success');
  }, [saveState]);

  const markStorySeen = useCallback((storyId) => {
    setState(prev => {
      if (prev.seenStories.includes(storyId)) return prev;
      const seenStories = [...prev.seenStories, storyId];
      try { localStorage.setItem('scp_seen_stories', JSON.stringify(seenStories)); } catch { /* ignore */ }
      const updated = { ...prev, seenStories };
      saveState(updated);
      return updated;
    });
    const token = sessionRef.current?.jwt?.accessToken;
    if (token) {
      apiService.markStoryViewed(storyId, token).catch(() => {});
    }
  }, [saveState]);

  const createStory = useCallback(async (image, caption = '') => {
    const user = sessionRef.current?.user;
    if (!user || !image) return;
    const token = sessionRef.current?.jwt?.accessToken;
    let storedImage = image;
    if (token && image.startsWith('data:')) {
      try {
        const uploaded = await apiService.uploadMedia(image, token);
        if (uploaded?.url) storedImage = uploaded.url;
      } catch { /* fallback to inline data URL */ }
    }

    if (token) {
      try {
        const res = await apiService.createStory({ image: storedImage, caption }, token);
        if (Array.isArray(res?.stories)) {
          setState(prev => {
            const updated = {
              ...prev,
              stories: res.stories,
              seenStories: Array.isArray(res.seenStories) ? res.seenStories : prev.seenStories
            };
            saveState(updated);
            return updated;
          });
          recordActivity();
          toast('Your story is live for 24 hours!', 'success');
          return;
        }
      } catch { /* offline fallback below */ }
    }

    const groupId = `st_${user.id}`;
    const newSlide = { image: storedImage, caption, time: 'Just now' };
    setState(prev => {
      const existing = prev.stories.find(s => s.id === groupId);
      const stories = existing
        ? prev.stories.map(s => (s.id === groupId ? { ...s, slides: [...s.slides, newSlide] } : s))
        : [{ id: groupId, user: { id: user.id, name: user.name, handle: user.username || 'user', avatar: user.avatar }, slides: [newSlide] }, ...prev.stories];
      const updated = { ...prev, stories };
      saveState(updated);
      return updated;
    });
    recordActivity();
    toast('Story added locally.', 'success');
  }, [recordActivity, saveState]);

  const markNotificationsRead = useCallback(() => {
    setState(prev => {
      if (!prev.notifications.some(n => !n.read)) return prev;
      const notifications = prev.notifications.map(n => ({ ...n, read: true }));
      const updated = { ...prev, notifications };
      saveState(updated);
      return updated;
    });
    const token = sessionRef.current?.jwt?.accessToken;
    if (token) {
      apiService.markNotificationsRead(token).catch(() => {});
    }
  }, [saveState]);

  return {
    state,
    setState,
    stateRef,
    saveState,
    recordActivity,
    likePost,
    toggleFollow,
    toggleSave,
    createPost,
    submitComment,
    likeComment,
    deleteComment,
    sendMessage,
    markMessagesAsRead,
    rsvpEvent,
    markStorySeen,
    createStory,
    markNotificationsRead,
    resetStateForUser
  };
}
