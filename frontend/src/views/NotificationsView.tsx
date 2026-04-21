import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Heart, MessageCircle, AtSign, Share2, CheckCircle2 } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

interface AppNotification {
  id: number;
  target_user_id: string;
  actor_name: string;
  actor_avatar: string;
  activity_type: 'like' | 'comment' | 'mention' | 'share';
  post_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsView({ user, onNavigateBoard }: { user?: User | null, onNavigateBoard: () => void }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('target_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setNotifications(data as AppNotification[]);
      }
      setLoading(false);
    };

    fetchNotifications();

    const sub = supabase.channel('notif_view')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `target_user_id=eq.${user.id}` }, payload => {
        setNotifications(prev => [payload.new as AppNotification, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `target_user_id=eq.${user.id}` }, payload => {
        setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new as AppNotification : n));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [user]);

  const markAsRead = async (id: number) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('target_user_id', user.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = (notif: AppNotification) => {
    if (!notif.is_read) {
      markAsRead(notif.id);
    }
    // Navigate to board (we rely on user to find the post for now, or we could pass post_id to global state)
    onNavigateBoard();
  };

  const parseTime = (timestamp: string) => {
    try {
      const diff = Date.now() - new Date(timestamp).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return '방금 전';
      if (minutes < 60) return `${minutes}분 전`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}시간 전`;
      return new Date(timestamp).toLocaleDateString('ko-KR');
    } catch {
      return '';
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart size={16} className="text-pink-400 fill-pink-400" />;
      case 'comment': return <MessageCircle size={16} className="text-indigo-400 fill-indigo-400/20" />;
      case 'mention': return <AtSign size={16} className="text-green-400" />;
      case 'share': return <Share2 size={16} className="text-amber-400" />;
      default: return <Bell size={16} />;
    }
  };

  const getMessageHeader = (notif: AppNotification) => {
    switch (notif.activity_type) {
      case 'like': return <><span className="text-pink-300 font-bold">{notif.actor_name}</span>님이 회원님의 게시글을 좋아합니다.</>;
      case 'comment': return <><span className="text-indigo-300 font-bold">{notif.actor_name}</span>님이 댓글을 남겼습니다.</>;
      case 'mention': return <><span className="text-green-300 font-bold">{notif.actor_name}</span>님이 회원님을 멘션했습니다.</>;
      case 'share': return <><span className="text-amber-300 font-bold">{notif.actor_name}</span>님이 게시글을 채팅에 공유했습니다.</>;
      default: return <>{notif.actor_name}님의 새 알림</>;
    }
  };

  return (
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-24">
        <div className="flex items-end justify-between mb-8 pt-4">
          <div className="flex items-end gap-3">
            <Bell size={32} className="text-indigo-400 mb-1" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">알림</h1>
              <p className="mt-2 text-white/60">새로운 소식을 확인하세요.</p>
            </div>
          </div>
          {notifications.some(n => !n.is_read) && (
            <button onClick={markAllAsRead} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full text-xs font-semibold text-white/60 transition-colors">
              <CheckCircle2 size={14} /> 모두 읽음 처리
            </button>
          )}
        </div>

        <section className="space-y-3">
          <AnimatePresence>
            {loading ? (
              <motion.div className="flex justify-center py-10" exit={{ opacity: 0 }}>
                <div className="w-8 h-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
              </motion.div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-20 text-white/40 border border-white/5 rounded-3xl border-dashed">
                도착한 알림이 없습니다.
              </div>
            ) : (
              notifications.map((notif, i) => (
                <motion.div key={notif.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.03, duration: 0.2 }}>
                  <div 
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 items-start ${notif.is_read ? 'bg-white/5 border-white/5 opacity-70 hover:opacity-100 hover:bg-white/10' : 'glass-dark border-indigo-400/30 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.15)] hover:bg-indigo-500/20'}`}
                  >
                    <div className="relative">
                      <img src={notif.actor_avatar} alt="avatar" className="w-12 h-12 rounded-full border border-white/20 object-cover bg-white/5" />
                      <div className="absolute -bottom-1 -right-1 bg-gray-900 rounded-full p-1 border border-white/10 shadow-lg">
                        {getIcon(notif.activity_type)}
                      </div>
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex justify-between items-start mb-1">
                        <div className="text-sm text-white/90">{getMessageHeader(notif)}</div>
                        <span className="text-[10px] text-white/40 flex-shrink-0 font-medium bg-black/20 px-2 py-0.5 rounded-full">{parseTime(notif.created_at)}</span>
                      </div>
                      {notif.message && (
                        <div className="text-sm text-white/60 line-clamp-2 mt-1 bg-black/20 p-2 rounded-lg border border-white/5">
                          {notif.message}
                        </div>
                      )}
                    </div>
                    {!notif.is_read && (
                      <div className="w-2 h-2 rounded-full bg-indigo-400 self-center animate-pulse flex-shrink-0" />
                    )}
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </section>
      </motion.div>
    </div>
  );
}
