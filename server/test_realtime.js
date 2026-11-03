import { WebSocket } from 'ws';

const WS_URL = 'ws://localhost:4001';

// Base64 URL encoder
function base64UrlEncode(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function makeToken(user) {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    picture: user.avatar,
    role: user.role,
    iat: now,
    exp: now + 900
  };
  return `${base64UrlEncode(header)}.${base64UrlEncode(payload)}.mock_sig`;
}

const userA = { id: 'user_alice_01', name: 'Alice Walker', email: 'alice@test.io', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', role: 'creator' };
const userB = { id: 'user_bob_02', name: 'Bob Sterling', email: 'bob@test.io', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', role: 'standard_user' };

function waitFor(condition, timeout = 2000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      if (condition()) {
        resolve();
        return;
      }
      if (Date.now() - startedAt >= timeout) {
        reject(new Error('Timed out waiting for realtime condition'));
        return;
      }
      setTimeout(check, 20);
    };
    check();
  });
}

async function runTest() {
  console.log('🧪 Starting Phase 1 Real-Time WebSocket Gateway Verification...\n');

  const results = [];
  function assert(condition, label) {
    if (condition) {
      console.log(`  ✅ PASS: ${label}`);
      results.push({ label, pass: true });
    } else {
      console.error(`  ❌ FAIL: ${label}`);
      results.push({ label, pass: false });
    }
  }

  // 1. Connect Client A
  const wsA = new WebSocket(WS_URL);
  await new Promise((resolve) => wsA.on('open', resolve));
  assert(wsA.readyState === WebSocket.OPEN, 'Client A connected to WebSocket Gateway');

  // 2. Connect Client B
  const wsB = new WebSocket(WS_URL);
  await new Promise((resolve) => wsB.on('open', resolve));
  assert(wsB.readyState === WebSocket.OPEN, 'Client B connected to WebSocket Gateway');

  // 3. Authenticate Client A
  let clientAAuthed = false;
  wsA.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'auth:success') {
      clientAAuthed = true;
    }
  });

  wsA.send(JSON.stringify({
    type: 'auth',
    token: makeToken(userA),
    user: userA
  }));

  await waitFor(() => clientAAuthed);
  assert(clientAAuthed, 'Client A authenticated via JWT');

  // 4. Authenticate Client B and verify Presence Broadcast on Client A
  let presenceReceivedOnA = false;
  wsA.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'presence:update' && msg.userId === userB.id && msg.isOnline) {
      presenceReceivedOnA = true;
    }
  });

  wsB.send(JSON.stringify({
    type: 'auth',
    token: makeToken(userB),
    user: userB
  }));

  await waitFor(() => presenceReceivedOnA);
  assert(presenceReceivedOnA, 'Client A received presence broadcast when Client B came online');

  // 5. Test 1-on-1 Direct Messaging from Client A to Client B
  let messageReceivedOnB = false;
  let deliveryStatusOnA = null;

  wsB.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'message:new' && msg.message.fromUserId === userA.id) {
      messageReceivedOnB = msg.message;
    }
  });

  wsA.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'message:sent') {
      deliveryStatusOnA = msg.status;
    }
  });

  const testText = 'Hello Bob! Real-time direct message via WebSocket.';
  wsA.send(JSON.stringify({
    type: 'message:send',
    toUserId: userB.id,
    text: testText,
    tempId: 'temp_123'
  }));

  await waitFor(() => deliveryStatusOnA === 'DELIVERED' && messageReceivedOnB !== false);
  assert(deliveryStatusOnA === 'DELIVERED', `Client A sent message and received delivery status: ${deliveryStatusOnA}`);
  assert(messageReceivedOnB && messageReceivedOnB.text === testText, 'Client B received message payload in real-time');

  // 6. Test Read Receipt: Client B marks conversation as read
  let readReceiptOnA = false;
  wsA.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'message:read_receipt' && msg.readByUserId === userB.id) {
      readReceiptOnA = true;
    }
  });

  wsB.send(JSON.stringify({
    type: 'message:read',
    toUserId: userA.id
  }));

  await waitFor(() => readReceiptOnA);
  assert(readReceiptOnA, 'Client A received read receipt (double cyan tick) from Client B');

  // 7. Test Typing Indicator: Client A sends typing start
  let typingOnB = null;
  wsB.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'typing:indicator' && msg.fromUserId === userA.id) {
      typingOnB = msg.isTyping;
    }
  });

  wsA.send(JSON.stringify({
    type: 'typing:start',
    toUserId: userB.id
  }));

  await waitFor(() => typingOnB === true);
  assert(typingOnB === true, 'Client B received live typing indicator (isTyping: true)');

  wsA.send(JSON.stringify({
    type: 'typing:stop',
    toUserId: userB.id
  }));

  await waitFor(() => typingOnB === false);
  assert(typingOnB === false, 'Client B received typing stop indicator (isTyping: false)');

  // 8. Test Live Post Like Fanout: Client A likes post 'p1'
  let likeUpdateReceivedOnB = null;
  wsB.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'post:like_update' && msg.postId === 'p1') {
      likeUpdateReceivedOnB = msg;
    }
  });

  wsA.send(JSON.stringify({
    type: 'post:like',
    postId: 'p1',
    action: 'like'
  }));

  await waitFor(() => likeUpdateReceivedOnB !== null);
  assert(likeUpdateReceivedOnB !== null && likeUpdateReceivedOnB.likesCount > 42, `Client B received live like update: ${likeUpdateReceivedOnB?.likesCount} likes`);

  // 9. Test Dynamic Feed Fanout: Client A publishes a new post
  let postBroadcastReceivedOnB = null;
  wsB.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'post:broadcast' && msg.post.id === 'post_fanout_99') {
      postBroadcastReceivedOnB = msg.post;
    }
  });

  wsA.send(JSON.stringify({
    type: 'post:new',
    post: {
      id: 'post_fanout_99',
      author: { name: userA.name, handle: 'alice_w' },
      content: 'Testing sub-50ms Fanout broadcast over WebSocket Gateway!',
      likes: 0
    }
  }));

  await waitFor(() => postBroadcastReceivedOnB !== null);
  assert(postBroadcastReceivedOnB !== null && postBroadcastReceivedOnB.content.includes('Fanout broadcast'), 'Client B received live post fanout stream in real-time');

  // 10. Test Gateway Latency / Ping Benchmark
  const t0 = performance.now();
  let pongReceived = false;
  let rtt = 0;
  wsA.once('pong', () => {
    pongReceived = true;
    rtt = Math.round(performance.now() - t0);
  });
  wsA.ping();
  await new Promise(r => setTimeout(r, 80));
  assert(pongReceived && rtt < 50, `WebSocket Heartbeat RTT latency verified: ${rtt}ms (< 50ms target)`);

  // 11. Disconnect Client A and verify Client B receives offline presence
  let offlinePresenceOnB = false;
  wsB.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'presence:update' && msg.userId === userA.id && !msg.isOnline) {
      offlinePresenceOnB = true;
    }
  });

  wsA.close();
  await waitFor(() => offlinePresenceOnB);
  assert(offlinePresenceOnB, 'Client B received offline presence update when Client A disconnected');

  // 12. Test Gateway Reconnection Resilience
  const wsAReconnected = new WebSocket(WS_URL);
  await new Promise((resolve) => wsAReconnected.on('open', resolve));
  let reconnectedAuth = false;
  wsAReconnected.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    if (msg.type === 'auth:success') reconnectedAuth = true;
  });
  wsAReconnected.send(JSON.stringify({
    type: 'auth',
    token: makeToken(userA),
    user: userA
  }));
  await waitFor(() => reconnectedAuth);
  assert(reconnectedAuth, 'Client A successfully reconnected and restored session state');

  wsAReconnected.close();
  wsB.close();

  const totalPassed = results.filter(r => r.pass).length;
  console.log(`\n====================================================`);
  console.log(`🏁 Verification Finished: ${totalPassed}/${results.length} checks passed!`);
  console.log(`====================================================\n`);

  process.exit(totalPassed === results.length ? 0 : 1);
}

runTest().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
