import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

interface Post {
  id: number;
  title: string;
  content: string;
  likes: number;
  author_name: string;
  author_avatar: string;
  created_at: string;
}

export default function LikedView({ user }: { user?: User | null }) {
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchLikedPosts = async () => {
      // Fetch post_ids liked by user
      const { data: likesData, error: likesError } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id);

      if (likesError) {
        console.error(likesError);
        setLoading(false);
        return;
      }

      if (!likesData || likesData.length === 0) {
        setLikedPosts([]);
        setLoading(false);
        return;
      }

      const postIds = likesData.map(l => l.post_id);

      // Fetch the actual posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .in('id', postIds)
        .order('created_at', { ascending: false });

      if (!postsError && postsData) {
        setLikedPosts(postsData as Post[]);
      }
      setLoading(false);
    };

    fetchLikedPosts();
  }, [user]);

  const parseTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <div className="h-full overflow-y-auto pr-2 custom-scrollbar">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 pb-24">
        <div className="flex items-end mb-8 pt-4 gap-3">
          <Heart size={32} className="text-pink-400 fill-pink-400/20 mb-1" />
          <div>
            <h1 className="text-3xl font-bold tracking-tight">좋아요한 글</h1>
            <p className="mt-2 text-white/60">내가 하트를 누른 글들을 모아봅니다.</p>
          </div>
        </div>

        <section className="space-y-4">
          <AnimatePresence>
            {loading ? (
              <motion.div className="flex justify-center py-10" exit={{ opacity: 0 }}>
                <div className="w-8 h-8 rounded-full border-2 border-pink-400 border-t-transparent animate-spin" />
              </motion.div>
            ) : likedPosts.length === 0 ? (
              <div className="text-center py-20 text-white/40 border border-white/5 rounded-3xl border-dashed">
                아직 하트를 누른 글이 없습니다.<br/>자유게시판에서 마음에 드는 글을 찾아보세요!
              </div>
            ) : (
              likedPosts.map((post, i) => (
                <motion.div key={post.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05, duration: 0.3 }}>
                  <div className="glass-dark p-6 rounded-3xl border border-white/10 group shadow-md flex flex-col relative overflow-hidden">
                    <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Heart size={120} className="fill-pink-500 text-pink-500" />
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                      <img src={post.author_avatar} alt="avatar" className="w-8 h-8 rounded-full border border-white/20 object-cover bg-white/5" />
                      <span className="text-sm font-semibold text-white/80">{post.author_name}</span>
                      <span className="text-xs text-white/40 ml-auto">{parseTime(post.created_at)}</span>
                    </div>
                    <h2 className="text-xl font-bold mb-2 group-hover:text-pink-300 transition-colors">{post.title}</h2>
                    <p className="text-white/60 leading-relaxed text-sm line-clamp-3">
                      {post.content}
                    </p>
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
