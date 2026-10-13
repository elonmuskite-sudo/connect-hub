import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { UserIcon } from '@heroicons/react/24/solid';
import { getFeeds } from '../../data/mockFeeds';

export default function FeedsBar() {
  const [feeds, setFeeds] = useState(getFeeds());
  const navigate = useNavigate();

  useEffect(() => {
    setFeeds(getFeeds());
  }, []);

  return (
    <div className="border-b border-border p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">Feeds</h3>
        <button 
          onClick={() => navigate('/app/feeds')} 
          className="text-primary text-sm hover:underline"
        >
          View All
        </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {/* Recent Feeds Previews */}
        {feeds.slice(0, 5).map(feed => (
          <button 
            key={feed.id} 
            onClick={() => navigate('/app/feeds')} 
            className="flex flex-col items-center gap-1 hover:opacity-80 transition"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-primary" />
              </div>
              {feed.isAdminPost && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                  <span className="text-primary-foreground text-[10px] font-bold">A</span>
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground text-center w-16 truncate">
              {feed.userName}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

