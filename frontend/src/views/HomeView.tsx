import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../supabaseClient';

export default function HomeView() {
  const [visitorsCount, setVisitorsCount] = useState<number>(0);
  const [postsCount, setPostsCount] = useState<number>(0);

  useEffect(() => {
    const fetchStats = async () => {
      // 1. Fetch today's visitors
      const today = new Date();
      // YYYY-MM-DD
      const dateString = today.toLocaleDateString('en-CA');
      const { data: visitData } = await supabase
        .from('daily_visits')
        .select('visits')
        .eq('date', dateString)
        .single();
      
      if (visitData) {
        setVisitorsCount(visitData.visits);
      }

      // 2. Fetch today's new posts
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const { count } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfToday.toISOString());
      
      if (count !== null) {
        setPostsCount(count);
      }
    };

    fetchStats();

    // 3. Subscription to visitors increment
    const visitSub = supabase.channel('home_visit')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_visits' }, payload => {
        // Just refetch or manually update when any visit date changes (mostly today)
        fetchStats();
      })
      .subscribe();

    // 4. Subscription to new posts
    const postSub = supabase.channel('home_post')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
        setPostsCount(prev => prev + 1);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, payload => {
        setPostsCount(prev => Math.max(0, prev - 1));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(visitSub);
      supabase.removeChannel(postSub);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="h-full flex flex-col items-center justify-center space-y-6"
    >
      <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-br from-indigo-300 to-fuchsia-300 bg-clip-text text-transparent">
        환영합니다.
      </h1>
      <p className="text-white/60 text-lg md:text-xl font-medium text-center">
        새로운 형태의 커뮤니티 공간에서 <br />자유롭게 대화하고 아이디어를 나누세요.
      </p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl mt-8">
        <div className="glass-dark p-6 rounded-3xl border border-white/10 hover:bg-white/[0.12] transition-all cursor-default group relative overflow-hidden text-center">
          <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3 className="text-xl font-semibold mb-3 text-indigo-300 relative z-10 flex items-center justify-center gap-2">
            오늘의 방문자
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block animate-pulse mb-0.5 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
          </h3>
          <p className="text-5xl font-bold relative z-10 tabular-nums tracking-tighter">
            <motion.span 
              key={visitorsCount} 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="inline-block"
            >
              {visitorsCount.toLocaleString()}
            </motion.span>
          </p>
        </div>
        
        <div className="glass-dark p-6 rounded-3xl border border-white/10 hover:bg-white/[0.12] transition-all cursor-default group relative overflow-hidden text-center">
          <div className="absolute inset-0 bg-fuchsia-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3 className="text-xl font-semibold mb-3 text-fuchsia-300 relative z-10 flex items-center justify-center gap-2">
            오늘 등록된 새 글
            <span className="w-2 h-2 rounded-full bg-orange-400 inline-block animate-pulse mb-0.5 shadow-[0_0_8px_rgba(251,146,60,0.8)]"></span>
          </h3>
          <p className="text-5xl font-bold relative z-10 tabular-nums tracking-tighter">
            <motion.span 
              key={postsCount} 
              initial={{ opacity: 0, y: -10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="inline-block"
            >
              {postsCount.toLocaleString()}
            </motion.span>
          </p>
        </div>
      </div>
      <p className="text-white/20 text-xs mt-6">이 수치들은 Supabase 클라우드 데이터베이스와 100% 실시간(Realtime)으로 동기화됩니다.</p>
    </motion.div>
  );
}
