const photo = id => `https://images.unsplash.com/${id}?w=150&auto=format&fit=crop&q=80`;

export const contacts = [
  { id: 's1', name: 'Dr. Sophia Vance', handle: 'sophia_ai', avatar: photo('photo-1573496359142-b8d87734a5a2'), role: 'AI Researcher', mutuals: 4 },
  { id: 's2', name: 'Mateo Rossi', handle: 'mateorossi', avatar: photo('photo-1500648767791-00dcc994a43e'), role: 'Systems Architect', mutuals: 2 },
  { id: 'elena_r', name: 'Elena Rostova', handle: 'elena_r', avatar: photo('photo-1534528741775-53994a69daeb'), role: 'Verified Creator' }
];

export const avatars = [contacts[2].avatar, photo('photo-1507003211169-0a1dd7228f2d'), photo('photo-1494790108377-be9c29b29330'), photo('photo-1535713875002-d1d0cf377fde'), photo('photo-1570295999919-56ceb5ecca61'), photo('photo-1580489944761-15a19d654956')];

export const topics = [
  { id: 'ai', label: 'AI & Machine Learning', emoji: '⚡', description: 'LLMs, neural nets & agentic systems' },
  { id: 'design', label: 'Design & UI/UX', emoji: '🎨', description: 'Design systems, 3D & typography' },
  { id: 'photo', label: 'Photography & Film', emoji: '📸', description: 'Visual storytelling & cinematography' },
  { id: 'gaming', label: 'Gaming & Interactive', emoji: '🎮', description: 'Game development & indie titles' },
  { id: 'code', label: 'Engineering & Code', emoji: '💻', description: 'Distributed systems & full-stack' },
  { id: 'music', label: 'Music & Audio', emoji: '🎵', description: 'Electronic, vinyl & audio engineering' },
  { id: 'crypto', label: 'Web3 & Cryptography', emoji: '🌐', description: 'Zero-knowledge, DeFi & protocols' },
  { id: 'travel', label: 'Travel & Expeditions', emoji: '✈️', description: 'Global exploration & remote life' },
  { id: 'fitness', label: 'Health & Longevity', emoji: '🏃', description: 'Training, mobility & sports' }
];

export const topicLabel = id => topics.find(topic => topic.id === id)?.label || id;
export const navigation = [
  ['feed', 'home', 'Home'], ['explore', 'compass', 'Explore'], ['messages', 'send', 'Messages'],
  ['search', 'search', 'Search'], ['notifications', 'heart', 'Notifications'],
  ['events', 'calendar', 'Events'], ['profile', 'user', 'My Profile']
];

export const seedPosts = [
  {
    id: 'p1', author: { ...contacts[2], role: 'verified_user' },
    content: 'Just launched the beta of our neural design canvas! 🚀 Built with WebGL shaders and real-time collaborative websockets. Feedback is welcome!',
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
    likes: 42, comments: 7, liked: false, timestamp: '25m ago', tags: ['AI & Machine Learning', 'Design & UI/UX']
  },
  {
    id: 'p2', author: { id: 'kaito', name: 'Kaito Tanaka', handle: 'kaito_dev', avatar: avatars[1], role: 'standard_user' },
    content: 'Morning photography walk in Kyoto. The atmospheric fog through the bamboo forest is unbelievable today.',
    image: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800&auto=format&fit=crop&q=80',
    likes: 89, comments: 14, liked: false, timestamp: '2h ago', tags: ['Photography & Film', 'Travel & Expeditions']
  }
];

export const seedEvents = [
  { id: 'e1', title: 'Global Social Architecture Summit 2026', date: 'Sept 24, 2026 • 6:00 PM UTC', location: 'Virtual Auditorium & London Studio', attendees: 342, rsvpd: false, tag: 'Engineering' },
  { id: 'e2', title: 'Interactive UI & Creative Coding Showcase', date: 'Oct 02, 2026 • 7:30 PM UTC', location: 'San Francisco, CA & Stream', attendees: 512, rsvpd: true, tag: 'Design' }
];

export const seedComments = {
  p1: [
    { id: 'c1', author: contacts[0], content: 'The fluid wave mathematics in this canvas are exceptional. Are you doing the raymarching pass entirely in fragment shaders?', timestamp: '18m ago', likes: 6, liked: true, replies: [
      { id: 'c1_r1', author: contacts[2], content: 'Thank you Sophia! It runs on WebGL2 fragment shaders to keep the experience fluid on mobile GPUs.', timestamp: '12m ago' }
    ] },
    { id: 'c2', author: contacts[1], content: 'Tested the collaborative cursor sync on our local cluster. Sub-30ms round-trip latency over the WebSocket gateway. Huge milestone! 🚀', timestamp: '8m ago', likes: 4, liked: false, replies: [] }
  ],
  p2: [{ id: 'c3', author: contacts[2], content: 'The depth of field and misty atmospheric gradient is stunning Kaito. Which focal length did you shoot this with?', timestamp: '1h ago', likes: 8, liked: true, replies: [
    { id: 'c3_r1', author: seedPosts[1].author, content: '35mm f/1.4 wide open with a diffusion filter to soften the bamboo forest highlights!', timestamp: '45m ago' }
  ] }]
};

export const seedNotifications = [
  { id: 'n1', ...contacts[2], action: 'liked your post about WebGL Shaders', time: '12m ago' },
  { id: 'n2', ...contacts[0], action: 'started following you', time: '1h ago' }
];

export function initialMessages(userId) {
  return [
    { id: 'm_init_1', fromUserId: 's1', toUserId: userId, text: 'Hey! I reviewed your architecture proposal for the fanout feed.', time: '10:14 AM', status: 'READ' },
    { id: 'm_init_2', fromUserId: userId, toUserId: 's1', text: 'Thanks Sophia! We are adopting the WebSocket Gateway with Fanout-on-Write.', time: '10:18 AM', status: 'READ' }
  ];
}
