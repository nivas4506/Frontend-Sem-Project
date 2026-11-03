import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';

const PORT = process.env.PORT || 4001;

// In-memory data stores for real-time interaction
const connectedClients = new Map(); // userId -> Set<WebSocket>
const socketUserMap = new Map();    // WebSocket -> { userId, name, avatar, role }
const activeUsers = new Map();      // userId -> { userId, name, avatar, role, lastSeen, isOnline }

// Seed platform system users
const seedProfiles = [
  {
    userId: 's1',
    name: 'Dr. Sophia Vance',
    handle: 'sophia_ai',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150',
    role: 'AI Researcher',
    isOnline: true
  },
  {
    userId: 's2',
    name: 'Mateo Rossi',
    handle: 'mateorossi',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150',
    role: 'Systems Architect',
    isOnline: true
  },
  {
    userId: 'elena_r',
    name: 'Elena Rostova',
    handle: 'elena_r',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
    role: 'Verified Creator',
    isOnline: true
  }
];

seedProfiles.forEach(p => {
  activeUsers.set(p.userId, { ...p, lastSeen: Date.now() });
});

// Messages repository: conversationKey -> Array<Message>
// conversationKey format: sorted [userA, userB].join(':')
const conversations = new Map();

// Post likes counter store: postId -> { count, likedUsers: Set<userId> }
const postLikes = new Map([
  ['p1', { count: 42, likedUsers: new Set(['elena_r']) }],
  ['p2', { count: 89, likedUsers: new Set(['s1', 's2']) }]
]);

function getConversationKey(userA, userB) {
  return [userA, userB].sort().join('::');
}

// Pre-seed some chat history for s1
const defaultKeyS1 = getConversationKey('s1', 'me');
conversations.set(defaultKeyS1, [
  {
    id: 'm_init_1',
    conversationId: defaultKeyS1,
    fromUserId: 's1',
    toUserId: 'me',
    senderName: 'Dr. Sophia Vance',
    text: 'Hey! I reviewed your architecture proposal for the fanout feed.',
    time: '10:14 AM',
    timestamp: Date.now() - 1000 * 60 * 30,
    status: 'READ'
  },
  {
    id: 'm_init_2',
    conversationId: defaultKeyS1,
    fromUserId: 'me',
    toUserId: 's1',
    senderName: 'You',
    text: 'Thanks Sophia! We are adopting the WebSocket Gateway with Fanout-on-Write.',
    time: '10:18 AM',
    timestamp: Date.now() - 1000 * 60 * 25,
    status: 'READ'
  }
]);

// Helper: Decode simulated/standard JWT without external heavy packages
function decodeJwtPayload(token) {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.warn('[JWT] Error decoding token payload:', err.message);
    return null;
  }
}

// HTTP Server for healthcheck & REST introspection
const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'healthy',
      service: 'Real-Time Interaction Gateway',
      uptime: process.uptime(),
      connectedSockets: socketUserMap.size,
      activeUserCount: connectedClients.size,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (url.pathname === '/api/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      usersOnline: Array.from(activeUsers.values()).filter(u => u.isOnline),
      posts: Array.from(postLikes.entries()).map(([postId, data]) => ({
        postId,
        likesCount: data.count
      }))
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

// WebSocket Server attached to HTTP Server
const wss = new WebSocketServer({ server });

function broadcast(payload, filterFn = null) {
  const messageStr = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      if (!filterFn || filterFn(client)) {
        client.send(messageStr);
      }
    }
  }
}

function sendToUser(userId, payload) {
  const sockets = connectedClients.get(userId);
  if (!sockets) return false;
  const messageStr = JSON.stringify(payload);
  let delivered = false;
  for (const socket of sockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(messageStr);
      delivered = true;
    }
  }
  return delivered;
}

wss.on('connection', (ws, req) => {
  console.log('[WS] New incoming WebSocket connection established');

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      handleClientMessage(ws, data);
    } catch (err) {
      console.error('[WS] Failed to parse incoming message:', err);
    }
  });

  ws.on('close', () => {
    handleClientDisconnect(ws);
  });

  ws.on('error', (err) => {
    console.error('[WS] Socket error:', err.message);
  });
});

// Heartbeat interval to detect dead sockets
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

function handleClientMessage(ws, data) {
  const { type } = data;

  switch (type) {
    // 1. Authenticate WebSocket connection with JWT
    case 'auth': {
      const { token, user: fallbackUser } = data;
      const decoded = decodeJwtPayload(token);

      const userId = decoded?.sub || fallbackUser?.id || `anon_${Date.now()}`;
      const name = decoded?.name || fallbackUser?.name || 'Community Member';
      const avatar = decoded?.picture || fallbackUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
      const role = decoded?.role || fallbackUser?.role || 'standard_user';

      // Save socket association
      const userMeta = { userId, name, avatar, role };
      socketUserMap.set(ws, userMeta);

      if (!connectedClients.has(userId)) {
        connectedClients.set(userId, new Set());
      }
      connectedClients.get(userId).add(ws);

      // Mark user online
      activeUsers.set(userId, {
        userId,
        name,
        avatar,
        role,
        isOnline: true,
        lastSeen: Date.now()
      });

      console.log(`[WS] Authenticated user: ${name} (${userId})`);

      // Acknowledge auth to client
      ws.send(JSON.stringify({
        type: 'auth:success',
        userId,
        activeUsers: Array.from(activeUsers.values()),
        postLikes: Object.fromEntries(
          Array.from(postLikes.entries()).map(([k, v]) => [k, { likes: v.count, liked: v.likedUsers.has(userId) }])
        )
      }));

      // Broadcast presence update to everyone
      broadcast({
        type: 'presence:update',
        userId,
        isOnline: true,
        user: activeUsers.get(userId),
        activeUsers: Array.from(activeUsers.values())
      });
      break;
    }

    // 2. Direct Messaging: Send 1-on-1 Message
    case 'message:send': {
      const senderMeta = socketUserMap.get(ws);
      if (!senderMeta) {
        ws.send(JSON.stringify({ type: 'error', message: 'Unauthorized. Please authenticate first.' }));
        return;
      }

      const { toUserId, text, tempId } = data;
      const audio = typeof data.audio === 'string' && /^data:audio\/[\w.+-]+;base64,/i.test(data.audio) && data.audio.length < 3000000 ? data.audio : '';
      if (!toUserId || !text || !text.trim()) return;

      const convKey = getConversationKey(senderMeta.userId, toUserId);
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Check if recipient has open socket
      const recipientSockets = connectedClients.get(toUserId);
      const isRecipientConnected = !!recipientSockets && recipientSockets.size > 0;
      const initialStatus = isRecipientConnected ? 'DELIVERED' : 'SENT';

      const newMsg = {
        id: messageId,
        conversationId: convKey,
        fromUserId: senderMeta.userId,
        toUserId,
        senderName: senderMeta.name,
        senderAvatar: senderMeta.avatar,
        text: text.trim(),
        audio,
        time: timeStr,
        timestamp: Date.now(),
        status: initialStatus
      };

      // Save to conversations store
      if (!conversations.has(convKey)) {
        conversations.set(convKey, []);
      }
      conversations.get(convKey).push(newMsg);

      // Ack to sender with assigned ID and delivery status
      ws.send(JSON.stringify({
        type: 'message:sent',
        message: newMsg,
        tempId,
        status: initialStatus
      }));

      // Deliver to recipient sockets if connected
      if (isRecipientConnected) {
        sendToUser(toUserId, {
          type: 'message:new',
          message: newMsg
        });

        // Also push notification event
        sendToUser(toUserId, {
          type: 'notification:new',
          notification: {
            id: `notif_${Date.now()}`,
            name: senderMeta.name,
            avatar: senderMeta.avatar,
            action: `sent you a message: "${text.slice(0, 32)}${text.length > 32 ? '...' : ''}"`,
            time: 'Just now',
            type: 'message'
          }
        });
      }

      // If sending to one of our simulated mentors (s1 Sophia Vance, s2 Mateo Rossi, etc.)
      // simulate realistic smart typing and reply after short delay
      if (['s1', 's2', 'elena_r'].includes(toUserId)) {
        simulatePartnerResponse(ws, senderMeta.userId, toUserId, text.trim(), convKey);
      }

      break;
    }

    // 3. Mark conversation messages as Read
    case 'message:read': {
      const senderMeta = socketUserMap.get(ws);
      if (!senderMeta) return;

      const { toUserId } = data;
      const convKey = getConversationKey(senderMeta.userId, toUserId);
      const msgs = conversations.get(convKey);

      if (msgs && msgs.length > 0) {
        let updatedCount = 0;
        msgs.forEach(m => {
          if (m.toUserId === senderMeta.userId && m.status !== 'READ') {
            m.status = 'READ';
            updatedCount++;
          }
        });

        if (updatedCount > 0) {
          // Notify the other participant that messages were read
          sendToUser(toUserId, {
            type: 'message:read_receipt',
            conversationId: convKey,
            readByUserId: senderMeta.userId
          });
        }
      }
      break;
    }

    // 4. Typing indicators
    case 'typing:start':
    case 'typing:stop': {
      const senderMeta = socketUserMap.get(ws);
      if (!senderMeta) return;

      const { toUserId } = data;
      sendToUser(toUserId, {
        type: 'typing:indicator',
        fromUserId: senderMeta.userId,
        senderName: senderMeta.name,
        isTyping: type === 'typing:start'
      });
      break;
    }

    // 5. Live Likes counter streaming
    case 'post:like': {
      const senderMeta = socketUserMap.get(ws);
      const { postId, action } = data; // action: 'like' | 'unlike'
      if (!postId) return;

      const userId = senderMeta?.userId || 'anon';
      if (!postLikes.has(postId)) {
        postLikes.set(postId, { count: 0, likedUsers: new Set() });
      }

      const postData = postLikes.get(postId);
      if (action === 'like' || (!action && !postData.likedUsers.has(userId))) {
        postData.likedUsers.add(userId);
        postData.count += 1;
      } else {
        postData.likedUsers.delete(userId);
        postData.count = Math.max(0, postData.count - 1);
      }

      // Broadcast live like update to all connected clients
      broadcast({
        type: 'post:like_update',
        postId,
        likesCount: postData.count,
        byUserId: userId,
        action: postData.likedUsers.has(userId) ? 'liked' : 'unliked'
      });

      // Send live notification to author if author is online and someone else liked it
      if (senderMeta && action !== 'unlike') {
        broadcast({
          type: 'notification:new',
          notification: {
            id: `notif_like_${Date.now()}`,
            name: senderMeta.name,
            avatar: senderMeta.avatar,
            action: `liked your post`,
            time: 'Just now',
            type: 'like'
          }
        }, (client) => {
          const clientMeta = socketUserMap.get(client);
          return clientMeta && clientMeta.userId !== senderMeta.userId;
        });
      }
      break;
    }

    // 6. Live Feed Fanout for newly published posts
    case 'post:new': {
      const senderMeta = socketUserMap.get(ws);
      const { post } = data;
      if (!post) return;

      if (!postLikes.has(post.id)) {
        postLikes.set(post.id, { count: post.likes || 0, likedUsers: new Set() });
      }

      // Broadcast new post to all connected feeds
      broadcast({
        type: 'post:broadcast',
        post
      }, (client) => {
        // Exclude origin sender if requested, or include for sync
        return true;
      });
      break;
    }

    default:
      console.log(`[WS] Unhandled message type: ${type}`);
  }
}

function simulatePartnerResponse(senderWs, senderUserId, partnerId, userMsg, convKey) {
  const partner = activeUsers.get(partnerId);
  if (!partner) return;

  // 1. Send typing indicator after 500ms
  setTimeout(() => {
    if (senderWs.readyState === WebSocket.OPEN) {
      senderWs.send(JSON.stringify({
        type: 'typing:indicator',
        fromUserId: partnerId,
        senderName: partner.name,
        isTyping: true
      }));
    }
  }, 600);

  // 2. Generate contextual response after 2000ms
  setTimeout(() => {
    if (senderWs.readyState !== WebSocket.OPEN) return;

    // Stop typing
    senderWs.send(JSON.stringify({
      type: 'typing:indicator',
      fromUserId: partnerId,
      senderName: partner.name,
      isTyping: false
    }));

    let replyText = `Thanks for your message! Looking forward to diving deeper into this.`;
    const lower = userMsg.toLowerCase();
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      replyText = `Hello! Great to connect with you on the real-time social platform. How is your project going?`;
    } else if (lower.includes('feed') || lower.includes('architecture') || lower.includes('design')) {
      replyText = `The Fanout-on-Write pipeline with WebSocket push delivers sub-50ms latency across connected nodes!`;
    } else if (lower.includes('like') || lower.includes('socket') || lower.includes('realtime')) {
      replyText = `Notice how like counters and typing events update in real time across the distributed cluster!`;
    }

    const replyMsg = {
      id: `msg_reply_${Date.now()}`,
      conversationId: convKey,
      fromUserId: partnerId,
      toUserId: senderUserId,
      senderName: partner.name,
      senderAvatar: partner.avatar,
      text: replyText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      status: 'DELIVERED'
    };

    if (!conversations.has(convKey)) {
      conversations.set(convKey, []);
    }
    conversations.get(convKey).push(replyMsg);

    senderWs.send(JSON.stringify({
      type: 'message:new',
      message: replyMsg
    }));

    // Also trigger notification
    senderWs.send(JSON.stringify({
      type: 'notification:new',
      notification: {
        id: `notif_${Date.now()}`,
        name: partner.name,
        avatar: partner.avatar,
        action: `replied to your message: "${replyText.slice(0, 32)}..."`,
        time: 'Just now',
        type: 'message'
      }
    }));
  }, 2200);
}

function handleClientDisconnect(ws) {
  const userMeta = socketUserMap.get(ws);
  if (!userMeta) return;

  const { userId } = userMeta;
  socketUserMap.delete(ws);

  const userSockets = connectedClients.get(userId);
  if (userSockets) {
    userSockets.delete(ws);
    if (userSockets.size === 0) {
      connectedClients.delete(userId);
      const userObj = activeUsers.get(userId);
      if (userObj) {
        userObj.isOnline = false;
        userObj.lastSeen = Date.now();
      }

      console.log(`[WS] User went offline: ${userMeta.name} (${userId})`);
      broadcast({
        type: 'presence:update',
        userId,
        isOnline: false,
        lastSeen: Date.now(),
        activeUsers: Array.from(activeUsers.values())
      });
    }
  }
}

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Real-Time Interaction Gateway running on port ${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}`);
  console.log(`🩺 Healthcheck: http://localhost:${PORT}/health`);
  console.log(`====================================================`);
});
