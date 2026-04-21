import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, MessageSquare, List, LogIn, LogOut, Settings, Heart, Bell } from 'lucide-react';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';

import HomeView from './views/HomeView';
import BoardView from './views/BoardView';
import ChatView from './views/ChatView';
import LikedView from './views/LikedView';
import NotificationsView from './views/NotificationsView';
import ProfileModal from './components/ProfileModal';

export type TabType = 'home' | 'board' | 'chat' | 'liked' | 'notifications';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [session, setSession] = useState<Session | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (!sessionStorage.getItem('visited')) {
      supabase.rpc('increment_visit').then(() => {
        sessionStorage.setItem('visited', 'true');
      });
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Notifications Badge Logic
  useEffect(() => {
    if (!session?.user) {
      setUnreadNotifications(0);
      return;
    }

    const fetchUnread = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('target_user_id', session.user.id)
        .eq('is_read', false);
      if (count !== null) setUnreadNotifications(count);
    };

    fetchUnread();

    const sub = supabase.channel('header_notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `target_user_id=eq.${session.user.id}` }, payload => {
        if (payload.eventType === 'INSERT' && !payload.new.is_read) {
          setUnreadNotifications(prev => prev + 1);
        } else if (payload.eventType === 'UPDATE') {
           // This handles marking as read
           fetchUnread();
        }
      }).subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [session?.user]);

  const handleDiscordLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'discord' });
    if (error) alert("디스코드 로그인 에러: " + error.message);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home': return <HomeView />;
      case 'board': return <BoardView user={session?.user} />;
      case 'chat': return <ChatView user={session?.user} />;
      case 'liked': return <LikedView user={session?.user} />;
      case 'notifications': return <NotificationsView user={session?.user} onNavigateBoard={() => setActiveTab('board')} />;
      default: return <HomeView />;
    }
  };

  const userMetadata = session?.user?.user_metadata || {};
  const displayName = userMetadata.nickname || userMetadata.custom_claims?.global_name || userMetadata.full_name || '새 연결 유저';
  const avatarUrl = userMetadata.avatar_url || userMetadata.picture || 'https://api.dicebear.com/7.x/avataaars/svg?seed=user';

  return (
    <div className="relative min-h-screen font-sans overflow-hidden bg-gray-950 text-white selection:bg-white/30 hidden md:flex">
      {/* Animated Gradient Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }} className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-indigo-600/30 blur-[120px]" />
        <motion.div animate={{ scale: [1, 1.5, 1], rotate: [0, -90, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }} className="absolute top-[40%] -right-[20%] w-[60vw] h-[60vw] rounded-full bg-fuchsia-600/20 blur-[100px]" />
      </div>

      <div className="z-10 flex w-full h-screen p-6 gap-6">
        {/* Left Sidebar Layout */}
        <aside className="w-64 flex-shrink-0 flex flex-col">
          <div className="glass-dark flex-1 rounded-3xl border border-white/10 flex flex-col items-center py-10 shadow-2xl overflow-hidden">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent mb-12">
              Commu.
            </h2>
            
            <nav className="flex flex-col w-full px-4 space-y-2">
              <button onClick={() => setActiveTab('home')} className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'home' ? 'bg-white/10 text-white shadow-inner border border-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
                <Home size={20} className={activeTab === 'home' ? 'text-indigo-400' : ''} />
                <span className="font-medium">홈</span>
              </button>
              
              <button onClick={() => setActiveTab('board')} className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'board' ? 'bg-white/10 text-white shadow-inner border border-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
                <List size={20} className={activeTab === 'board' ? 'text-indigo-400' : ''} />
                <span className="font-medium">자유게시판</span>
              </button>

              <button onClick={() => setActiveTab('chat')} className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'chat' ? 'bg-white/10 text-white shadow-inner border border-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
                <MessageSquare size={20} className={activeTab === 'chat' ? 'text-indigo-400' : ''} />
                <span className="font-medium">실시간 채팅</span>
              </button>

              {session && (
                <>
                  <div className="my-2 border-t border-white/5 w-full"></div>
                  
                  <button onClick={() => setActiveTab('liked')} className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${activeTab === 'liked' ? 'bg-white/10 text-white shadow-inner border border-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
                    <Heart size={20} className={activeTab === 'liked' ? 'text-pink-400 fill-pink-400/20' : ''} />
                    <span className="font-medium">좋아요한 글</span>
                  </button>

                  <button onClick={() => setActiveTab('notifications')} className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all relative ${activeTab === 'notifications' ? 'bg-white/10 text-white shadow-inner border border-white/5' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
                    <div className="relative">
                      <Bell size={20} className={activeTab === 'notifications' ? 'text-indigo-400' : ''} />
                      {unreadNotifications > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border border-black text-[8px] items-center justify-center font-bold text-white"></span>
                        </span>
                      )}
                    </div>
                    <span className="font-medium flex items-center justify-between flex-1">
                      알림
                      {unreadNotifications > 0 && (
                        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full font-bold ml-2">
                          {unreadNotifications}
                        </span>
                      )}
                    </span>
                  </button>
                </>
              )}
            </nav>

            <div className="mt-auto px-4 w-full">
              {session ? (
                <div className="flex flex-col items-center bg-white/5 p-4 rounded-2xl border border-white/5 shadow-inner">
                  <div className="relative group w-16 h-16 mb-3 cursor-pointer" onClick={() => setIsProfileModalOpen(true)}>
                    <img src={avatarUrl} alt="Profile" className="w-16 h-16 rounded-full object-cover border-2 border-indigo-400/50 shadow-lg transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"><Settings size={20} /></div>
                  </div>
                  <p className="text-sm font-medium w-full text-center truncate px-2" title={displayName}>{displayName}</p>
                  <p className="text-xs text-indigo-300 mt-1 mb-4 flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse"></span> 접속 중</p>
                  <button onClick={handleLogout} className="flex w-full items-center justify-center gap-2 text-xs text-white/50 hover:text-white/80 transition-colors py-2 bg-white/5 rounded-lg hover:bg-white/10">
                    <LogOut size={14} /> 로그아웃
                  </button>
                </div>
              ) : (
                <button onClick={handleDiscordLogin} className="w-full py-4 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-2xl font-bold shadow-lg shadow-[#5865F2]/30 transition-all flex items-center justify-center gap-2 box-border border border-white/10">
                  <LogIn size={18} /> 디스코드 시작하기
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* Right Main Content Area */}
        <main className="flex-1 relative">
          <div className="glass-dark h-full w-full rounded-3xl border border-white/10 p-8 shadow-2xl relative overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.3 }} className="h-full w-full">
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {session && session.user && (
        <ProfileModal 
          user={session.user} 
          isOpen={isProfileModalOpen} 
          onClose={() => setIsProfileModalOpen(false)}
          onProfileUpdated={() => {
            supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
          }}
        />
      )}
    </div>
  );
}
