export const mockFeeds = [
  {
    id: "1",
    userId: "admin-1",
    userName: "Nexus Admin",
    userAvatar: null,
    content: "Welcome to Nexus Chat! Our new encrypted messaging platform is now live. Start messaging your friends today!",
    type: "text",
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    isAdminPost: true,
    likes: 42,
    likedBy: [], // Array of user IDs who liked this post
    comments: [
      { 
        id: "1", 
        userName: "Sarah", 
        content: "This is awesome!", 
        createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        likes: 3,
        likedBy: [], // Array of user IDs who liked this comment
        reactions: { "👍": 1, "❤️": 2 },
        reactedBy: {}, // { [userId]: emoji } to track user reactions
        replies: [
          { id: "r1", userName: "Nexus Admin", content: "Glad you like it! Many more features are coming.", createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString() }
        ]
      },
      { 
        id: "2", 
        userName: "Mike", 
        content: "Great work team!", 
        createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        likes: 1,
        likedBy: [], // Array of user IDs who liked this comment
        reactions: { "👍": 1 },
        reactedBy: {}, // { [userId]: emoji } to track user reactions
        replies: []
      }
    ]
  },
  {
    id: "2",
    userId: "user-1",
    userName: "Alex Johnson",
    userAvatar: null,
    content: "Just started using Nexus Chat! The UI looks fantastic and the app is super smooth.",
    type: "text",
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    isAdminPost: false,
    likes: 12,
    likedBy: [], // Array of user IDs who liked this post
    comments: []
  },
  {
    id: "3",
    userId: "admin-1",
    userName: "Nexus Admin",
    userAvatar: null,
    content: "New Feature Alert! 🎉 Voice messages are coming next week! Stay tuned for more updates.",
    type: "text",
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(), // 8 hours ago
    isAdminPost: true,
    likes: 89,
    likedBy: [], // Array of user IDs who liked this post
    comments: [
      { 
        id: "1", 
        userName: "Chris", 
        content: "Can't wait!", 
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
        likes: 2,
        likedBy: [], // Array of user IDs who liked this comment
        reactions: { "❤️": 2 },
        reactedBy: {}, // { [userId]: emoji } to track user reactions
        replies: []
      }
    ]
  },
  {
    id: "4",
    userId: "user-2",
    userName: "Jessica Lee",
    userAvatar: null,
    content: "Loving the dark mode on Nexus Chat! So easy on the eyes 🌙",
    type: "text",
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(), // 12 hours ago
    isAdminPost: false,
    likes: 34,
    likedBy: [], // Array of user IDs who liked this post
    comments: [
      { 
        id: "1", 
        userName: "David", 
        content: "Agreed! Dark mode is a must-have!", 
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 11).toISOString(),
        likes: 4,
        likedBy: [], // Array of user IDs who liked this comment
        reactions: { "👍": 3 },
        reactedBy: {}, // { [userId]: emoji } to track user reactions
        replies: []
      }
    ]
  },
  {
    id: "5",
    userId: "user-3",
    userName: "Ryan Miller",
    userAvatar: null,
    content: "The group chat features are excellent! Perfect for planning events with friends.",
    type: "text",
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(), // 18 hours ago
    isAdminPost: false,
    likes: 21,
    likedBy: [], // Array of user IDs who liked this post
    comments: []
  },
  {
    id: "6",
    userId: "admin-1",
    userName: "Nexus Admin",
    userAvatar: null,
    content: "Reminder: All messages are end-to-end encrypted! Your privacy is our top priority 🔒",
    type: "text",
    status: "active",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    isAdminPost: true,
    likes: 156,
    likedBy: [], // Array of user IDs who liked this post
    comments: [
      { 
        id: "1", 
        userName: "Emma", 
        content: "Thank you for prioritizing privacy!", 
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
        likes: 5,
        likedBy: [], // Array of user IDs who liked this comment
        reactions: { "❤️": 4, "🙏": 1 },
        reactedBy: {}, // { [userId]: emoji } to track user reactions
        replies: []
      },
      { 
        id: "2", 
        userName: "James", 
        content: "This is why I switched to Nexus Chat!", 
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
        likes: 3,
        likedBy: [], // Array of user IDs who liked this comment
        reactions: { "👍": 2 },
        reactedBy: {}, // { [userId]: emoji } to track user reactions
        replies: []
      }
    ]
  }
];

function getLastFeedRefresh() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('nexus-feed-last-refresh');
    return stored ? new Date(stored) : null;
  } catch (e) {
    return null;
  }
}

function setLastFeedRefresh() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('nexus-feed-last-refresh', new Date().toISOString());
  } catch (e) { /* ignore */ }
}

function shouldRefreshFeeds() {
  const lastRefresh = getLastFeedRefresh();
  if (!lastRefresh) return true;

  const diffHours = (new Date() - lastRefresh) / (1000 * 60 * 60);
  return diffHours >= 24;
}

function refreshFeedsIfNeeded(feeds) {
  if (!shouldRefreshFeeds()) return feeds;
  
  // When refresh is needed, shuffle content and update timestamps
  const refreshedFeeds = feeds.map(feed => ({
    ...feed,
    createdAt: new Date(Date.now() - Math.random() * 1000 * 60 * 60 * 12).toISOString(), // Random time in last 12 hours
    likes: Math.floor(Math.random() * 100)
  }));
  
  setLastFeedRefresh();
  return refreshedFeeds;
}

export function getFeeds() {
  return refreshFeedsIfNeeded(mockFeeds);
}

export function getFeedById(feedId) {
  const feeds = getFeeds();
  return feeds.find(feed => feed.id === feedId) || null;
}

export function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  return `${days}d`;
}
