import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeftIcon, 
  HeartIcon, 
  ChatBubbleOvalLeftEllipsisIcon, 
  ShareIcon,
  UserIcon,
  XMarkIcon,
  PaperAirplaneIcon,
  LinkIcon,
  CheckIcon
} from '@heroicons/react/24/solid';
import { HeartIcon as HeartIconOutline } from '@heroicons/react/24/outline';
import Avatar from '../components/chat/Avatar';
import { getFeeds, formatTimeAgo } from '../data/mockFeeds';
import { useAuth } from '../lib/AuthContext';
import { createChat, getChats, sendChatMessage, getContacts, searchUserByNexusId } from '../lib/persistence';
import UniversalEmojiPicker from '../components/chat/UniversalEmojiPicker';

export default function FeedsPage() {
  const [feeds, setFeeds] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('nexus-feeds-state');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          // Corrupt stored state: fall back to fresh feeds below.
        }
      }
    }
    return getFeeds();
  });
  const [contacts, setContacts] = useState([]);
  const [activeCommentFeedId, setActiveCommentFeedId] = useState(null);
  const [activeShareFeedId, setActiveShareFeedId] = useState(null);
  const [commentInputs, setCommentInputs] = useState({});
  const [copiedStatus, setCopiedStatus] = useState(false);
  const [sharedStatus, setSharedStatus] = useState({});
  const [shareError, setShareError] = useState('');
  const [activeReactCommentId, setActiveReactCommentId] = useState(null);
  const [pickerTarget, setPickerTarget] = useState(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  const [typingIndicators, setTypingIndicators] = useState({});

  const mockNames = ['Sarah Jenkins', 'Mike Brody', 'Alex Rivera', 'Jessica Alba', 'Ryan Gosling', 'Emma Watson', 'James Bond'];
  const simulatedComments = [
    "Wow, this is fantastic! Can't wait to try it.",
    "This UI looks gorgeous, I'm absolutely loving it!",
    "Exactly what I was looking for! Excellent work.",
    "Is this going to support cross-platform sync soon?",
    "Amazing project, keeping an eye on this 🚀",
    "Agreed, this security aspect is crucial."
  ];
  const simulatedReplies = [
    "Agreed! Completely support this.",
    "That is an excellent point.",
    "I had the exact same thought!",
    "Haha yes, indeed!",
    "Thanks for highlighting this.",
    "Spot on! 🎯"
  ];

  useEffect(() => {
    const loadContacts = async () => {
      const data = await getContacts();
      setContacts(data);
    };
    loadContacts();

    const handleUpdate = () => loadContacts();
    window.addEventListener('nexus-contacts:updated', handleUpdate);
    return () => window.removeEventListener('nexus-contacts:updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('nexus-feeds-state', JSON.stringify(feeds));
    }
  }, [feeds]);

  useEffect(() => {
    setSharedStatus({});
    setCopiedStatus(false);
  }, [activeShareFeedId]);

  const toggleLike = (feedId) => {
    if (!user) return; // Don't allow liking if user is not logged in
    setFeeds(prevFeeds => prevFeeds.map(feed => {
      if (feed.id === feedId) {
        const isLiked = feed.likedBy?.includes(user.id);
        return {
          ...feed,
          likedBy: isLiked 
            ? feed.likedBy.filter(id => id !== user.id) 
            : [...(feed.likedBy || []), user.id],
          likes: isLiked ? feed.likes - 1 : feed.likes + 1
        };
      }
      return feed;
    }));
  };

  const handleCommentInputChange = (feedId, value) => {
    setCommentInputs(prev => ({
      ...prev,
      [feedId]: value
    }));
  };

  const [activeReplyCommentId, setActiveReplyCommentId] = useState(null);
  const [replyInputs, setReplyInputs] = useState({});

  const handleLikeComment = (feedId, commentId) => {
    if (!user) return; // Don't allow liking if user is not logged in
    setFeeds(prevFeeds => prevFeeds.map(feed => {
      if (feed.id === feedId) {
        return {
          ...feed,
          comments: feed.comments.map(comment => {
            if (comment.id === commentId) {
              const isLiked = comment.likedBy?.includes(user.id);
              return {
                ...comment,
                likedBy: isLiked 
                  ? comment.likedBy.filter(id => id !== user.id) 
                  : [...(comment.likedBy || []), user.id],
                likes: isLiked ? (comment.likes || 0) - 1 : (comment.likes || 0) + 1
              };
            }
            return comment;
          })
        };
      }
      return feed;
    }));
  };

  const handleReactComment = (feedId, commentId, emoji) => {
    if (!user) return; // Don't allow reacting if user is not logged in
    setFeeds(prevFeeds => prevFeeds.map(feed => {
      if (feed.id === feedId) {
        return {
          ...feed,
          comments: feed.comments.map(comment => {
            if (comment.id === commentId) {
              const previousReaction = comment.reactedBy?.[user.id];
              const reactions = { ...(comment.reactions || {}) };
              const reactedBy = { ...(comment.reactedBy || {}) };

              // If user already reacted, remove the old reaction first
              if (previousReaction) {
                if (reactions[previousReaction] > 0) {
                  reactions[previousReaction]--;
                  if (reactions[previousReaction] === 0) {
                    delete reactions[previousReaction];
                  }
                }
              }

              // Add the new reaction
              if (previousReaction !== emoji) {
                reactions[emoji] = (reactions[emoji] || 0) + 1;
                reactedBy[user.id] = emoji;
              } else {
                // If same emoji, remove the reaction
                delete reactedBy[user.id];
              }

              return {
                ...comment,
                reactions,
                reactedBy
              };
            }
            return comment;
          })
        };
      }
      return feed;
    }));
  };

  const handleReplyInputChange = (commentId, value) => {
    setReplyInputs(prev => ({
      ...prev,
      [commentId]: value
    }));
  };

  const handleAddReply = (feedId, commentId) => {
    const text = replyInputs[commentId] || '';
    if (!text.trim()) return;

    setFeeds(prevFeeds => prevFeeds.map(feed => {
      if (feed.id === feedId) {
        return {
          ...feed,
          comments: feed.comments.map(comment => {
            if (comment.id === commentId) {
              return {
                ...comment,
                replies: [
                  ...(comment.replies || []),
                  {
                    id: Date.now().toString(),
                    userName: user?.fullName || user?.email?.split('@')[0] || 'You',
                    userAvatar: user?.avatarUrl || null,
                    content: text.trim(),
                    createdAt: new Date().toISOString()
                  }
                ]
              };
            }
            return comment;
          })
        };
      }
      return feed;
    }));

    setReplyInputs(prev => ({
      ...prev,
      [commentId]: ''
    }));

    // Simulated lively response for replies
    const randomDelayForTyping = 800 + Math.random() * 800;
    const responderName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const responderText = simulatedReplies[Math.floor(Math.random() * simulatedReplies.length)];

    setTimeout(() => {
      setTypingIndicators(prev => ({ ...prev, [commentId]: responderName }));

      setTimeout(() => {
        setFeeds(prevFeeds => prevFeeds.map(feed => {
          if (feed.id === feedId) {
            return {
              ...feed,
              comments: feed.comments.map(comment => {
                if (comment.id === commentId) {
                  return {
                    ...comment,
                    replies: [
                      ...(comment.replies || []),
                      {
                        id: (Date.now() + 1).toString(),
                        userName: responderName,
                        userAvatar: null,
                        content: responderText,
                        createdAt: new Date().toISOString()
                      }
                    ]
                  };
                }
                return comment;
              })
            };
          }
          return feed;
        }));
        setTypingIndicators(prev => {
          const copy = { ...prev };
          delete copy[commentId];
          return copy;
        });
      }, 1200 + Math.random() * 800);
    }, randomDelayForTyping);
  };

  const handleAddComment = (feedId) => {
    const commentText = commentInputs[feedId] || '';
    if (!commentText.trim()) return;

    setFeeds(prevFeeds => prevFeeds.map(feed => {
      if (feed.id === feedId) {
        return {
          ...feed,
          comments: [
            ...feed.comments,
            {
              id: Date.now().toString(),
              userName: user?.fullName || user?.email?.split('@')[0] || 'You',
              userAvatar: user?.avatarUrl || null,
              content: commentText.trim(),
              createdAt: new Date().toISOString(),
              likes: 0,
              likedBy: [], // Initialize likedBy for new comment
              reactions: {},
              reactedBy: {}, // Initialize reactedBy for new comment
              replies: []
            }
          ]
        };
      }
      return feed;
    }));

    setCommentInputs(prev => ({
      ...prev,
      [feedId]: ''
    }));

    // Simulated lively response for comments
    const randomDelayForTyping = 1000 + Math.random() * 1000;
    const responderName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const responderText = simulatedComments[Math.floor(Math.random() * simulatedComments.length)];

    setTimeout(() => {
      setTypingIndicators(prev => ({ ...prev, [feedId]: responderName }));

      setTimeout(() => {
        setFeeds(prevFeeds => prevFeeds.map(feed => {
          if (feed.id === feedId) {
            return {
              ...feed,
              comments: [
                ...feed.comments,
                {
                  id: (Date.now() + 1).toString(),
                  userName: responderName,
                  userAvatar: null,
                  content: responderText,
                  createdAt: new Date().toISOString(),
                  likes: 0,
                  likedBy: [], // Initialize likedBy for new comment
                  reactions: {},
                  reactedBy: {}, // Initialize reactedBy for new comment
                  replies: []
                }
              ]
            };
          }
          return feed;
        }));
        setTypingIndicators(prev => {
          const copy = { ...prev };
          delete copy[feedId];
          return copy;
        });
      }, 1500 + Math.random() * 1000);
    }, randomDelayForTyping);
  };

  return (
    <div className="flex-1 flex flex-col bg-background text-foreground h-full">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 p-4 border-b border-border flex items-center gap-4 bg-card shadow-sm">
        <button onClick={() => navigate('/app')} className="p-2 hover:bg-muted rounded-full transition">
          <ArrowLeftIcon className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Feeds</h1>
      </div>
      
      {/* Feed Posts */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 max-w-2xl mx-auto w-full">
        {feeds.map(feed => (
          <div 
            key={feed.id} 
            className="border border-border bg-card rounded-xl shadow-sm"
          >
            {/* Post Header */}
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                  <UserIcon className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{feed.userName}</span>
                    {feed.isAdminPost && (
                      <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatTimeAgo(feed.createdAt)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Post Content */}
            <div className="px-4 pb-3">
              <p className="text-foreground leading-relaxed">{feed.content}</p>
            </div>
            
            {/* Post Stats */}
            <div className="px-4 py-2 flex items-center justify-between text-muted-foreground text-sm border-b border-border">
              <div className="flex items-center gap-1">
                <HeartIcon className="w-4 h-4 text-red-500" />
                <span>{feed.likes}</span>
              </div>
              <div>{feed.comments.length} comments</div>
            </div>
            
            {/* Post Actions */}
            <div className="px-2 py-1 flex items-center justify-between">
              <button 
                onClick={() => toggleLike(feed.id)} 
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md hover:bg-muted transition"
              >
                {feed.likedBy?.includes(user?.id) ? (
                  <HeartIcon className="w-5 h-5 text-red-500" />
                ) : (
                  <HeartIconOutline className="w-5 h-5 text-muted-foreground" />
                )}
                <span className={feed.likedBy?.includes(user?.id) ? "text-red-500 font-medium" : "text-muted-foreground"}>
                  Like
                </span>
              </button>
              
              <button 
                onClick={() => setActiveCommentFeedId(feed.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md hover:bg-muted transition"
              >
                <ChatBubbleOvalLeftEllipsisIcon className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">Comment</span>
              </button>
              
              <button 
                onClick={() => setActiveShareFeedId(feed.id)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-md hover:bg-muted transition"
              >
                <ShareIcon className="w-5 h-5 text-muted-foreground" />
                <span className="text-muted-foreground">Share</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Comment Popup Modal */}
      {activeCommentFeedId && (() => {
        const activeCommentFeed = feeds.find(f => f.id === activeCommentFeedId);
        if (!activeCommentFeed) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div 
              className="absolute inset-0 cursor-default" 
              onClick={() => setActiveCommentFeedId(null)}
            />
            
            <div className="relative bg-card w-full max-w-lg rounded-2xl shadow-xl overflow-hidden border border-border flex flex-col max-h-[85vh] z-10 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-border flex items-center justify-between bg-card">
                <div>
                  <h3 className="font-bold text-foreground text-lg">Comments</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    On {activeCommentFeed.userName}&apos;s post
                  </p>
                </div>
                <button 
                  onClick={() => setActiveCommentFeedId(null)} 
                  className="p-1.5 hover:bg-muted rounded-full transition"
                >
                  <XMarkIcon className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeCommentFeed.comments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ChatBubbleOvalLeftEllipsisIcon className="w-12 h-12 text-muted-foreground/40 mb-2" />
                    <p className="text-sm font-medium text-foreground">No comments yet</p>
                    <p className="text-xs text-muted-foreground">Be the first to share your thoughts!</p>
                  </div>
                ) : (
                  activeCommentFeed.comments.map(comment => (
                    <div key={comment.id} className="flex items-start gap-3 border-b border-border/40 pb-4 last:border-0 last:pb-0">
                      <Avatar src={comment.userAvatar} alt={comment.userName} size="sm" />
                      <div className="flex-1">
                        <div className="bg-muted dark:bg-muted/40 px-4 py-2.5 rounded-2xl relative group">
                          <span className="text-sm font-bold text-foreground mr-1.5">{comment.userName}</span>
                          <span className="text-sm text-foreground break-words">{comment.content}</span>
                          
                          {/* Reactions display */}
                          {comment.reactions && Object.values(comment.reactions).some(count => count > 0) && (
                            <div className="absolute -bottom-2 right-3 flex items-center gap-1 bg-card border border-border px-1.5 py-0.5 rounded-full shadow-sm text-xs">
                              {Object.entries(comment.reactions)
                                .filter(([, count]) => count > 0)
                                .map(([emoji, count]) => (
                                  <span key={emoji} className="flex items-center gap-0.5 select-none">
                                    <span>{emoji}</span>
                                    <span className="text-[10px] text-muted-foreground font-medium">{count}</span>
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                        
                        {/* Action buttons row */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground ml-2 mt-1.5">
                          <span className="text-[10px]">{formatTimeAgo(comment.createdAt)}</span>
                          
                          <button 
                            onClick={() => handleLikeComment(activeCommentFeed.id, comment.id)}
                            className={`hover:underline font-semibold transition ${comment.likedBy?.includes(user?.id) ? 'text-red-500 font-bold' : ''}`}
                          >
                            {comment.likes > 0 ? `${comment.likes} Like` : 'Like'}
                          </button>

                          <div className="relative">
                            <button 
                              onClick={() => setActiveReactCommentId(activeReactCommentId === comment.id ? null : comment.id)}
                              className="hover:underline font-semibold flex items-center gap-0.5"
                            >
                              React
                            </button>
                            {activeReactCommentId === comment.id && (
                              <>
                                <div className="fixed inset-0 z-10" onClick={() => setActiveReactCommentId(null)} />
                                <div className="absolute bottom-full left-0 mb-1.5 flex items-center gap-1.5 bg-card border border-border px-2 py-1.5 rounded-full shadow-lg z-20 animate-in fade-in slide-in-from-bottom-2 duration-100">
                                  {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                    <button
                                      key={emoji}
                                      onClick={() => {
                                        handleReactComment(activeCommentFeed.id, comment.id, emoji);
                                        setActiveReactCommentId(null);
                                      }}
                                      className="text-base hover:scale-125 active:scale-95 transition"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                  <button
                                    onClick={() => {
                                      setPickerTarget({ feedId: activeCommentFeed.id, commentId: comment.id });
                                      setActiveReactCommentId(null);
                                    }}
                                    className="w-6 h-6 flex items-center justify-center bg-muted hover:bg-muted-foreground/20 text-muted-foreground font-bold rounded-full text-sm transition"
                                    title="Add reaction"
                                  >
                                    +
                                  </button>
                                </div>
                              </>
                            )}
                          </div>

                          <button 
                            onClick={() => setActiveReplyCommentId(activeReplyCommentId === comment.id ? null : comment.id)}
                            className="hover:underline font-semibold"
                          >
                            {comment.replies && comment.replies.length > 0 
                              ? `Reply (${comment.replies.length})` 
                              : 'Reply'}
                          </button>
                        </div>

                        {/* Replies List */}
                        {comment.replies && comment.replies.length > 0 && (
                          <div className="mt-3 ml-4 pl-4 border-l border-border/80 space-y-3">
                            {comment.replies.map(reply => (
                              <div key={reply.id} className="flex items-start gap-2.5">
                                <Avatar src={reply.userAvatar} alt={reply.userName} size="sm" className="w-6 h-6" />
                                <div className="flex-1">
                                  <div className="bg-muted/60 dark:bg-muted/30 px-3 py-2 rounded-xl">
                                    <span className="text-xs font-bold text-foreground mr-1.5">{reply.userName}</span>
                                    <span className="text-xs text-foreground break-words">{reply.content}</span>
                                  </div>
                                  <span className="text-[9px] text-muted-foreground ml-2 mt-0.5 block">
                                    {formatTimeAgo(reply.createdAt)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply Typing Indicator */}
                        {typingIndicators[comment.id] && (
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground italic ml-4 pl-4 border-l border-border/80 mt-2 animate-pulse">
                            <div className="flex gap-0.5">
                              <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                              <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                              <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                            </div>
                            <span>{typingIndicators[comment.id]} is typing...</span>
                          </div>
                        )}

                        {/* Reply Input Form */}
                        {activeReplyCommentId === comment.id && (
                          <div className="mt-2.5 ml-4 pl-4 border-l border-border/80 flex gap-2">
                            <input
                              type="text"
                              placeholder={`Reply to ${comment.userName}...`}
                              value={replyInputs[comment.id] || ''}
                              onChange={(e) => handleReplyInputChange(comment.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleAddReply(activeCommentFeed.id, comment.id);
                                }
                              }}
                              className="flex-1 bg-muted/60 dark:bg-muted/30 border border-border/60 rounded-full px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <button 
                              onClick={() => handleAddReply(activeCommentFeed.id, comment.id)}
                              className="bg-primary text-primary-foreground rounded-full p-1.5 hover:opacity-90 transition flex items-center justify-center"
                            >
                              <PaperAirplaneIcon className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {typingIndicators[activeCommentFeed.id] && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground italic px-2 py-1 animate-pulse">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span>{typingIndicators[activeCommentFeed.id]} is typing a comment...</span>
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-border bg-card">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Write a comment..."
                    value={commentInputs[activeCommentFeed.id] || ''}
                    onChange={(e) => handleCommentInputChange(activeCommentFeed.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleAddComment(activeCommentFeed.id);
                      }
                    }}
                    className="flex-1 bg-muted border border-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button 
                    onClick={() => handleAddComment(activeCommentFeed.id)}
                    className="bg-primary text-primary-foreground rounded-full p-2.5 hover:opacity-90 transition flex items-center justify-center"
                  >
                    <PaperAirplaneIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Share Popup Modal */}
      {activeShareFeedId && (() => {
        const activeShareFeed = feeds.find(f => f.id === activeShareFeedId);
        if (!activeShareFeed) return null;
        
        const handleCopyLink = () => {
          const link = `${window.location.origin}/app/feeds#post-${activeShareFeed.id}`;
          navigator.clipboard.writeText(link);
          setCopiedStatus(true);
          setTimeout(() => setCopiedStatus(false), 2000);
        };

        const handleSendToContact = async (contact) => {
          setShareError('')
          try {
            const recipient = await searchUserByNexusId(contact.nexusId)
            if (!recipient || !user?.id) throw new Error('Could not resolve this contact to a registered Nexus account.')
            const chats = await getChats(user.id)
            const participants = [String(user.id), String(recipient.id)].sort()
            let chat = chats.find((item) => {
              const ids = (item.participant_ids || []).map(String).sort()
              return ids.length === participants.length && ids.every((id, index) => id === participants[index])
            })
            if (!chat) {
              chat = await createChat({
                title: recipient.fullName || contact.name,
                type: 'private',
                avatar_url: recipient.avatarUrl || null,
                owner_id: user.id,
                participantIds: participants,
              })
            }

            const content = `📢 Shared post by ${activeShareFeed.userName}:\n\n"${activeShareFeed.content}"`
            await sendChatMessage(chat.id, {
              content,
              type: 'text',
              sender_id: String(user.id),
            })
            setSharedStatus(prev => ({ ...prev, [contact.id]: true }))
          } catch (error) {
            setShareError(error?.message || 'The post could not be delivered.')
          }
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div 
              className="absolute inset-0 cursor-default" 
              onClick={() => setActiveShareFeedId(null)}
            />
            
            <div className="relative bg-card w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border flex flex-col max-h-[85vh] z-10 animate-in fade-in zoom-in-95 duration-200">
              <div className="p-4 border-b border-border flex items-center justify-between bg-card">
                <div>
                  <h3 className="font-bold text-foreground text-lg">Share Post</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Share this post with others
                  </p>
                </div>
                <button 
                  onClick={() => setActiveShareFeedId(null)} 
                  className="p-1.5 hover:bg-muted rounded-full transition"
                >
                  <XMarkIcon className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {shareError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{shareError}</p>}
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Copy Link</h4>
                  <div className="flex items-center gap-2 bg-muted dark:bg-muted/50 p-2.5 rounded-xl border border-border">
                    <LinkIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-muted-foreground truncate flex-1 select-all">
                      {`${window.location.origin}/app/feeds#post-${activeShareFeed.id}`}
                    </span>
                    <button
                      onClick={handleCopyLink}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition duration-200 flex items-center gap-1 flex-shrink-0 ${
                        copiedStatus 
                          ? 'bg-green-500 text-white' 
                          : 'bg-primary text-primary-foreground hover:opacity-90'
                      }`}
                    >
                      {copiedStatus ? (
                        <>
                          <CheckIcon className="w-3.5 h-3.5" />
                          Copied
                        </>
                      ) : (
                        'Copy'
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Send to Nexus Contacts</h4>
                  {contacts.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No contacts found</p>
                  ) : (
                    <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                      {contacts.map(contact => {
                        const isSent = sharedStatus[contact.id];
                        return (
                          <div 
                            key={contact.id} 
                            className="flex items-center justify-between p-2 rounded-xl border border-border bg-card hover:bg-muted/10 transition"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar src={contact.avatarUrl} alt={contact.name} size="sm" />
                              <div>
                                <span className="text-sm font-bold text-foreground block leading-none">{contact.name}</span>
                                <span className="text-[10px] text-muted-foreground">ID: {contact.nexusId}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleSendToContact(contact)}
                              disabled={isSent}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition duration-200 flex items-center gap-1 ${
                                isSent 
                                  ? 'bg-green-500/10 text-green-500 border border-green-500/20 cursor-default' 
                                  : 'bg-secondary text-secondary-foreground hover:bg-muted'
                              }`}
                            >
                              {isSent ? (
                                <>
                                  <CheckIcon className="w-3.5 h-3.5" />
                                  Sent
                                </>
                              ) : (
                                'Send'
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Universal Emoji Picker Overlay */}
      {pickerTarget && (
        <UniversalEmojiPicker
          onSelect={(emoji) => {
            handleReactComment(pickerTarget.feedId, pickerTarget.commentId, emoji);
            setPickerTarget(null);
          }}
          onClose={() => setPickerTarget(null)}
        />
      )}
    </div>
  );
}
