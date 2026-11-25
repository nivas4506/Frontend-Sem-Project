const photo = id => `https://images.unsplash.com/${id}?w=150&auto=format&fit=crop&q=80`;

export const contacts = [
  { id: 's1', name: 'Dr. Sophia Vance', handle: 'sophia_ai', avatar: photo('photo-1573496359142-b8d87734a5a2'), role: 'AI Researcher', mutuals: 4 },
  { id: 's2', name: 'Mateo Rossi', handle: 'mateorossi', avatar: photo('photo-1500648767791-00dcc994a43e'), role: 'Systems Architect', mutuals: 2 },
  { id: 'elena_r', name: 'Elena Rostova', handle: 'elena_r', avatar: photo('photo-1534528741775-53994a69daeb'), role: 'Verified Creator' }
];

export const avatars = [contacts[2].avatar, photo('photo-1507003211169-0a1dd7228f2d'), photo('photo-1494790108377-be9c29b29330'), photo('photo-1535713875002-d1d0cf377fde'), photo('photo-1570295999919-56ceb5ecca61'), photo('photo-1580489944761-15a19d654956')];

const shot = id => `https://images.unsplash.com/${id}?w=900&auto=format&fit=crop&q=80`;

// Creators shown in suggestions, stories and explore (not messaging contacts).
export const creators = [
  { id: 'kaito', name: 'Kaito Tanaka', handle: 'kaito_dev', avatar: avatars[1], role: 'Photographer', mutuals: 3 },
  { id: 'amara', name: 'Amara Okafor', handle: 'amara.designs', avatar: avatars[2], role: 'Product Designer', mutuals: 5 },
  { id: 'liam', name: 'Liam Carter', handle: 'liamcodes', avatar: avatars[3], role: 'Indie Game Dev', mutuals: 1 },
  { id: 'noah', name: 'Noah Kim', handle: 'noah.travels', avatar: avatars[4], role: 'Travel Creator', mutuals: 2 },
  { id: 'zara', name: 'Zara Malik', handle: 'zara.sound', avatar: avatars[5], role: 'Music Producer', mutuals: 6 }
];

export const stories = [
  { id: 'st_elena', user: contacts[2], slides: [
    { image: shot('photo-1618005182384-a83a8bd57fbe'), caption: 'Neural canvas beta is live 🚀', time: '1h' },
    { image: shot('photo-1488590528505-98d2b5aba04b'), caption: 'Late night shader tuning', time: '45m' }
  ] },
  { id: 'st_kaito', user: creators[0], slides: [
    { image: shot('photo-1503899036084-c55cdd92da26'), caption: 'Kyoto mornings 🌫️', time: '2h' }
  ] },
  { id: 'st_noah', user: creators[3], slides: [
    { image: shot('photo-1507525428034-b723cf961d3e'), caption: 'Found paradise in the Azores', time: '3h' },
    { image: shot('photo-1501785888041-af3ef285b470'), caption: 'Next stop: the lakes', time: '2h' }
  ] },
  { id: 'st_zara', user: creators[4], slides: [
    { image: shot('photo-1470225620780-dba8ba36b745'), caption: 'Studio session — new track Friday 🎧', time: '4h' }
  ] },
  { id: 'st_liam', user: creators[2], slides: [
    { image: shot('photo-1542751371-adc38448a05e'), caption: 'Playtest night 🎮', time: '5h' }
  ] },
  { id: 'st_sophia', user: contacts[0], slides: [
    { image: shot('photo-1517694712202-14dd9538aa97'), caption: 'Paper draft #3 done ✍️', time: '6h' }
  ] },
  { id: 'st_amara', user: creators[1], slides: [
    { image: shot('photo-1506905925346-21bda4d32df4'), caption: 'Weekend reset ⛰️', time: '8h' }
  ] }
];

export const trending = [
  { tag: 'WebGL', category: 'Trending in Tech', posts: '12.4K posts' },
  { tag: 'design', category: 'Design · Trending', posts: '8,912 posts' },
  { tag: 'indiedev', category: 'Gaming · Trending', posts: '5,301 posts' },
  { tag: 'travel', category: 'Trending worldwide', posts: '21.7K posts' },
  { tag: 'AI', category: 'Technology · Trending', posts: '48.2K posts' }
];

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
  ['feed', 'home', 'Home'], ['explore', 'compass', 'Explore'], ['search', 'search', 'Search'],
  ['messages', 'send', 'Messages'], ['notifications', 'bell', 'Notifications'],
  ['events', 'calendar', 'Events'], ['profile', 'user', 'Profile']
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
  },
  {
    id: 'p3', author: { ...creators[3], role: 'verified_user' },
    content: 'Found a hidden beach in the Azores after a 2 hour hike. Totally worth every step 🌊 #travel #azores',
    image: shot('photo-1507525428034-b723cf961d3e'),
    likes: 1204, comments: 86, liked: false, timestamp: '3h ago', tags: ['Travel & Expeditions']
  },
  {
    id: 'p4', author: { ...contacts[0], role: 'verified_user' },
    content: 'Hot take: the best AI products of 2026 will feel invisible. No chat box, no prompt — just software that quietly gets out of your way. #AI',
    image: '',
    likes: 318, comments: 52, liked: false, timestamp: '4h ago', tags: ['AI & Machine Learning']
  },
  {
    id: 'p5', author: { ...creators[2], role: 'standard_user' },
    content: 'Our indie roguelike just crossed 10,000 wishlists! 🎮 Thank you all — demo drops next month. #indiedev #gamedev',
    image: shot('photo-1542751371-adc38448a05e'),
    likes: 642, comments: 41, liked: false, timestamp: '6h ago', tags: ['Gaming & Interactive']
  },
  {
    id: 'p6', author: { ...creators[1], role: 'standard_user' },
    content: 'Spent the weekend rebuilding our design system from scratch. 48 components, one source of truth, zero regrets ✨ #design #uiux',
    image: '',
    likes: 276, comments: 19, liked: false, timestamp: '8h ago', tags: ['Design & UI/UX']
  },
  {
    id: 'p7', author: { ...creators[4], role: 'verified_user' },
    content: 'New track drops Friday. Recorded the whole thing on analog gear in one night 🎧 #music #producer',
    image: shot('photo-1470225620780-dba8ba36b745'),
    likes: 935, comments: 64, liked: false, timestamp: '10h ago', tags: ['Music & Audio']
  },
  {
    id: 'p8', author: { ...creators[0], role: 'standard_user' },
    content: 'Sunrise above the clouds. Some mornings make the 4am alarm completely worth it ⛰️ #photography',
    image: shot('photo-1506905925346-21bda4d32df4'),
    likes: 2310, comments: 128, liked: false, timestamp: '1d ago', tags: ['Photography & Film']
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
  { ...contacts[2], id: 'n1', userId: contacts[2].id, action: 'liked your post about WebGL Shaders', time: '12m ago' },
  { ...contacts[0], id: 'n2', userId: contacts[0].id, action: 'started following you', time: '1h ago' },
  { ...creators[1], id: 'n3', userId: creators[1].id, action: 'commented on your post: "This is so clean! 🔥"', time: '3h ago' },
  { ...creators[3], id: 'n4', userId: creators[3].id, action: 'started following you', time: '5h ago' },
  { ...creators[4], id: 'n5', userId: creators[4].id, action: 'liked your profile update', time: '1d ago' }
];

export function initialMessages(userId) {
  return [
    { id: 'm_init_1', fromUserId: 's1', toUserId: userId, text: 'Hey! I reviewed your architecture proposal for the fanout feed.', time: '10:14 AM', status: 'READ' },
    { id: 'm_init_2', fromUserId: userId, toUserId: 's1', text: 'Thanks Sophia! We are adopting the WebSocket Gateway with Fanout-on-Write.', time: '10:18 AM', status: 'READ' }
  ];
}
