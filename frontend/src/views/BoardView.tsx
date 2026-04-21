import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Share2, MessageCircle, X, Send } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

interface Post {
  id: number;
  title: string;
  content: string;
  likes: number;
  author_id: string | null;
  author_name: string;
  author_avatar: string;
  created_at: string;
}

interface Comment {
  id: number;
  post_id: number;
  content: string;
  mentions: string | null;
  author_id: string | null;
  author_name: string;
  author_avatar: string;
  created_at: string;
}

export default function BoardView({ user }: { user?: User | null }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [isWriting, setIsWriting] = useState(false);
  const [commentsByPost, setCommentsByPost] = useState<Record<number, Comment[]>>({});
  
  // Track posts that the current user has liked to color the heart
  const [myLikedPostIds, setMyLikedPostIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    const fetchData = async () => {
      const [postsRes, commentsRes] = await Promise.all([
        supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('comments').select('*').order('created_at', { ascending: true })
      ]);

      if (postsRes.data) setPosts(postsRes.data as Post[]);
      if (commentsRes.data) {
        const grouped: Record<number, Comment[]> = {};
        (commentsRes.data as Comment[]).forEach(c => {
          if (!grouped[c.post_id]) grouped[c.post_id] = [];
          grouped[c.post_id].push(c);
        });
        setCommentsByPost(grouped);
      }

      if (user) {
        const { data: likes } = await supabase.from('post_likes').select('post_id').eq('user_id', user.id);
        if (likes) setMyLikedPostIds(new Set(likes.map(l => l.post_id)));
      }

      setLoading(false);
    };

    fetchData();

    const postSub = supabase.channel('public:posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, payload => {
        if (payload.eventType === 'INSERT') {
          setPosts(prev => [payload.new as Post, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setPosts(prev => prev.map(p => p.id === payload.new.id ? payload.new as Post : p));
          setActivePost(prev => prev?.id === payload.new.id ? payload.new as Post : prev);
        } else if (payload.eventType === 'DELETE') {
          setPosts(prev => prev.filter(p => p.id !== payload.old.id));
        }
      }).subscribe();

    const commentSub = supabase.channel('public:comments')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, payload => {
        const newC = payload.new as Comment;
        setCommentsByPost(prev => ({
          ...prev,
          [newC.post_id]: [...(prev[newC.post_id] || []), newC]
        }));
      }).subscribe();

    return () => {
      supabase.removeChannel(postSub);
      supabase.removeChannel(commentSub);
    };
  }, [user]);

  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');

  const getMyAuthorName = () => user?.user_metadata?.nickname || user?.user_metadata?.full_name || '새 유저';
  const getMyAuthorAvatar = () => user?.user_metadata?.avatar_url || user?.user_metadata?.picture || `https://api.dicebear.com/7.x/avataaars/svg?seed=user`;

  const submitPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("로그인이 필요합니다.");
    if (!draftTitle.trim() || !draftContent.trim()) return;

    const newPost = {
      title: draftTitle,
      content: draftContent
    };

    setIsWriting(false);
    setDraftTitle('');
    setDraftContent('');

    await supabase.from('posts').insert([newPost]);
  };

  // notifyUser removed; handled securely by backend triggers

  const handleLike = async (post: Post) => {
    if (!user) return alert("로그인이 필요합니다.");

    const isLiked = myLikedPostIds.has(post.id);
    const newCount = isLiked ? post.likes - 1 : post.likes + 1;

    // Optimistic UI for likes
    setMyLikedPostIds(prev => {
      const next = new Set(prev);
      if (isLiked) next.delete(post.id);
      else next.add(post.id);
      return next;
    });

    if (isLiked) {
      await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id);
    } else {
      await supabase.from('post_likes').insert([{ post_id: post.id, user_id: user.id }]);
    }
    // Update count is efficiently handled by backend trigger now.
  };

  const handleShareToChat = async (post: Post) => {
    if (!user) return alert("로그인이 필요합니다.");
    const summary = `📢 [게시판 공유] ${post.title}\n"${post.content.slice(0, 30)}..." - by ${post.author_name}`;
    const { error } = await supabase.from('chat_messages').insert([{
      text: summary
    }]);

    if (!error) {
      alert('실시간 채팅에 공유되었습니다!');
    }
  };

  const [commentInput, setCommentInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<Comment | null>(null);

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("로그인이 필요합니다.");
    if (!commentInput.trim() || !activePost) return;

    let finalContent = commentInput;
    let mentionsText = null;
    let mentionedUserId = null;
    
    // Auto Mention check
    if (replyTarget && commentInput.startsWith(`@${replyTarget.author_name}`)) {
      mentionsText = replyTarget.author_name;
      mentionedUserId = replyTarget.author_id;
      finalContent = commentInput.replace(`@${replyTarget.author_name}`, '').trim();
    }

    const newComment = {
      post_id: activePost.id,
      content: finalContent,
      mentions: mentionsText
    };

    setCommentInput('');
    setReplyTarget(null);

    await supabase.from('comments').insert([newComment]);
    // Notification logic safely handled via backend trigger
  };

  const initReply = (c: Comment) => {
    setReplyTarget(c);
    setCommentInput(`@${c.author_name} `);
  };

  const closeDrawer = () => {
    setActivePost(null);
    setIsWriting(false);
  };

  const parseTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '방금 전';
    }
  };

  return (
    <div className="relative h-full overflow-hidden flex">
      {/* Left: Main Board List */}
      <div className={`flex-1 overflow-y-auto pr-2 custom-scrollbar transition-all duration-500 ease-in-out ${activePost || isWriting ? 'w-1/2 opacity-40 scale-95 pointer-events-none md:scale-100 md:opacity-100 md:pointer-events-auto' : 'w-full'}`}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6 pb-24">
          <div className="flex justify-between items-end mb-8 pt-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">자유게시판</h1>
              <p className="mt-2 text-white/60">다양한 주제로 소통해보세요.</p>
            </div>
            <button 
              onClick={() => { setIsWriting(true); setActivePost(null); }}
              className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 transition-colors rounded-full font-semibold text-sm shadow-lg shadow-indigo-500/20"
            >
              글쓰기
            </button>
          </div>

          <section className="space-y-4">
            <AnimatePresence>
              {loading ? (
                <motion.div className="flex justify-center py-10" exit={{ opacity: 0 }}>
                  <div className="w-8 h-8 rounded-full border-2 border-indigo-400 border-t-transparent animate-spin" />
                </motion.div>
              ) : posts.length === 0 ? (
                <div className="text-center py-20 text-white/40 border border-white/5 rounded-3xl border-dashed">
                  아직 작성된 글이 없습니다. 첫 글을 남겨보세요!
                </div>
              ) : (
                posts.map((post, i) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.3 }}
                  >
                    <div 
                      onClick={() => { setActivePost(post); setIsWriting(false); }}
                      className={`glass-dark p-5 rounded-3xl cursor-pointer hover:bg-white/[0.12] transition-all border group shadow-md flex flex-col ${activePost?.id === post.id ? 'border-indigo-400/50 bg-white/[0.08]' : 'border-white/10'}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <img src={post.author_avatar} alt="avatar" className="w-8 h-8 rounded-full border border-white/20 object-cover bg-white/5" />
                        <span className="text-sm font-semibold text-white/80">{post.author_name}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="flex-1 pr-4">
                          <h2 className="text-lg font-medium mb-1 group-hover:text-indigo-300 transition-colors">{post.title}</h2>
                          <p className="text-white/60 leading-relaxed text-sm line-clamp-2">
                            {post.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className={`flex items-center gap-1 text-xs font-semibold ${myLikedPostIds.has(post.id) ? 'text-pink-400' : 'text-pink-400/50'}`}>
                            <Heart size={14} className={myLikedPostIds.has(post.id) ? 'fill-pink-400' : 'fill-pink-400/20'} /> {post.likes}
                          </div>
                          <div className="flex items-center gap-1 text-white/40 text-xs font-semibold">
                            <MessageCircle size={14} /> {(commentsByPost[post.id] || []).length}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </section>
        </motion.div>
      </div>

      {/* Right: Drawer Panel (Detail or Write) */}
      <AnimatePresence>
        {(activePost || isWriting) && (
          <motion.div
            initial={{ x: '100%', opacity: 0, boxShadow: '-20px 0 50px rgba(0,0,0,0)' }}
            animate={{ x: 0, opacity: 1, boxShadow: '-20px 0 50px rgba(0,0,0,0.5)' }}
            exit={{ x: '100%', opacity: 0, boxShadow: '-20px 0 50px rgba(0,0,0,0)' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute top-0 right-0 w-full md:w-[60%] h-full glass-dark border-l border-white/10 rounded-l-3xl shadow-2xl flex flex-col z-20 backdrop-blur-2xl bg-gray-900/80"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-white/5 flex-shrink-0">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {isWriting ? '새 글 작성' : '게시글 상세'}
              </h2>
              <button onClick={closeDrawer} className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Write Panel Content */}
            {isWriting && (
              <form onSubmit={submitPost} className="p-6 flex flex-col h-full gap-4">
                <input 
                  type="text" 
                  value={draftTitle} 
                  onChange={e => setDraftTitle(e.target.value)} 
                  placeholder="제목을 입력하세요..." 
                  className="w-full bg-transparent border-b border-white/10 px-2 py-4 text-2xl font-bold text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-white/20"
                />
                <textarea 
                  value={draftContent} 
                  onChange={e => setDraftContent(e.target.value)} 
                  placeholder="당신의 생각을 자유롭게 적어주세요." 
                  className="w-full flex-1 bg-transparent border-none p-2 text-white/80 outline-none resize-none placeholder:text-white/20 custom-scrollbar leading-relaxed"
                />
                <div className="flex justify-end pt-4 border-t border-white/5 mt-auto">
                  <button type="submit" disabled={!draftTitle.trim() || !draftContent.trim()} className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg transition-all">
                    등록 완료 (Realtime 반영)
                  </button>
                </div>
              </form>
            )}

            {/* Detail Panel Content */}
            {activePost && !isWriting && (
              <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
                  {/* Post Body */}
                  <div>
                    <h1 className="text-2xl font-bold mb-4">{activePost.title}</h1>
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <img src={activePost.author_avatar} alt="avatar" className="w-10 h-10 rounded-full border border-white/20 object-cover bg-white/5" />
                        <div>
                          <div className="text-sm font-semibold text-white/90">{activePost.author_name}</div>
                          <div className="text-xs text-white/40">{parseTime(activePost.created_at)}</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleShareToChat(activePost)} className="p-2 rounded-xl bg-white/5 hover:bg-indigo-500/20 text-white/60 hover:text-indigo-300 transition-colors group" title="채팅방으로 보내기">
                          <Share2 size={18} className="group-active:scale-95" />
                        </button>
                        <motion.button 
                          whileTap={{ scale: 0.9 }} 
                          onClick={() => handleLike(activePost)} 
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-pink-500/20 text-white/60 hover:text-pink-400 transition-colors relative"
                        >
                          <AnimatePresence>
                            {/* Bounce animation only when liking */}
                            {myLikedPostIds.has(activePost.id) && (
                              <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ y: -30, opacity: 0, scale: 1.5 }} transition={{ duration: 0.6 }} className="absolute text-pink-400 pointer-events-none pb-2">
                                <Heart size={20} className="fill-pink-400" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                          <Heart size={18} className={myLikedPostIds.has(activePost.id) ? "fill-pink-400 text-pink-400" : ""} /> 
                          <span className="text-sm font-semibold">{activePost.likes}</span>
                        </motion.button>
                      </div>
                    </div>
                    <div className="text-white/80 leading-relaxed whitespace-pre-wrap text-base border-b border-white/10 pb-8">
                      {activePost.content}
                    </div>
                  </div>

                  {/* Comments Section */}
                  <div className="pt-2">
                    <h3 className="text-sm font-bold text-white/50 mb-4 flex items-center gap-2">
                      <MessageCircle size={16} /> 댓글 {(commentsByPost[activePost.id] || []).length}개
                    </h3>
                    <div className="space-y-4">
                      {(commentsByPost[activePost.id] || []).map(comment => (
                        <div key={comment.id} className="flex gap-3 animate-fade-in-up">
                          <img src={comment.author_avatar} alt="avatar" className="w-8 h-8 rounded-full border border-white/10 mt-1 object-cover bg-white/5" />
                          <div className="flex-1 bg-white/5 rounded-2xl rounded-tl-sm p-4 relative group">
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-sm font-bold text-white/90">{comment.author_name}</span>
                              <span className="text-[10px] text-white/30">{parseTime(comment.created_at)}</span>
                            </div>
                            <p className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
                              {comment.mentions && <span className="text-indigo-400 font-semibold mr-1">@{comment.mentions}</span>}
                              {comment.content}
                            </p>
                            <button onClick={() => initReply(comment)} className="absolute top-4 right-4 text-[10px] uppercase font-bold text-indigo-400/0 group-hover:text-indigo-400/80 transition-colors">
                              답글
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Comment Input */}
                <div className="p-4 border-t border-white/5 bg-gray-900/50 backdrop-blur-md flex-shrink-0">
                  <form onSubmit={submitComment} className="flex gap-2">
                    <input 
                      type="text" 
                      value={commentInput} 
                      onChange={e => setCommentInput(e.target.value)} 
                      placeholder={user ? "댓글을 입력하세요..." : "로그인 후 댓글을 남겨보세요"} 
                      disabled={!user}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-sans disabled:opacity-50"
                    />
                    <button type="submit" disabled={!user || !commentInput.trim()} className="p-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 rounded-xl transition-colors flex items-center justify-center">
                      <Send size={18} />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
