import { useState, useCallback, useRef } from 'react';
import { readStored, makeId } from '../utils/ui';
import { toast } from '../utils/toast';
import {
  initialMessages,
  seedComments,
  seedEvents,
  seedNotifications,
  seedPosts
} from '../data';

export function useSocialPlatform(session, sendSocket) {
  const [state, setState] = useState(() => {
    const user = session?.user;
    const saved = user ? readStored(`scp_data_${user.id}`, {}) : {};
    return {
      tab: 'feed',
      partnerId: 's1',
      searchQuery: '',
      chatDrafts: {},
      posts: saved.posts || structuredClone(seedPosts),
      events: saved.events || structuredClone(seedEvents),
      comments: saved.comments || structuredClone(seedComments),
      following: saved.following || [],
      messages: saved.messages || initialMessages(user?.id),
      notifications: saved.notifications || structuredClone(seedNotifications),
      activity: saved.activity || {}
    };
  });

  const stateRef = useRef(state);
  stateRef.current = state;
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const saveState = useCallback((currentState) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;
    const { posts, events, comments, following, messages, notifications, activity } = currentState;
    try {
      localStorage.setItem(
        `scp_data_${currentSession.user.id}`,
        JSON.stringify({ posts, events, comments, following, messages, notifications, activity })
      );
    } catch {
      toast('Browser storage is full. This change is available for the current visit.', 'error');
    }
  }, []);

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
    setState(prev => {
      const updatedPosts = prev.posts.map(p => {
        if (p.id === postId) {
          const liked = !p.liked;
          const likes = Math.max(0, p.likes + (liked ? 1 : -1));
          sendSocket?.('post:like', { postId, action: liked ? 'like' : 'unlike' });
          if (liked) recordActivity();
          return { ...p, liked, likes };
        }
        return p;
      });
      const updated = { ...prev, posts: updatedPosts };
      saveState(updated);
      return updated;
    });
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

    sendSocket?.('message:send', {
      toUserId: partner,
      text: message.text,
      audio,
      tempId: message.id
    });

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
  }, [recordActivity, saveState]);

  const resetStateForUser = useCallback((user) => {
    const saved = user ? readStored(`scp_data_${user.id}`, {}) : {};
    const freshlyInit = {
      tab: 'feed',
      partnerId: 's1',
      searchQuery: '',
      chatDrafts: {},
      posts: saved.posts || structuredClone(seedPosts),
      events: saved.events || structuredClone(seedEvents),
      comments: saved.comments || structuredClone(seedComments),
      following: saved.following || [],
      messages: saved.messages || initialMessages(user?.id),
      notifications: saved.notifications || structuredClone(seedNotifications),
      activity: saved.activity || {}
    };
    setState(freshlyInit);
    return freshlyInit;
  }, []);

  return {
    state,
    setState,
    stateRef,
    saveState,
    recordActivity,
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
  };
}
