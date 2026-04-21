import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../supabaseClient';

interface ChatMessage {
  id: number;
  text: string;
  is_system: boolean;
  author_id: string | null;
  author_name: string;
  author_avatar: string;
  created_at: string;
}

export default function ChatView({ user }: { user?: User | null }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight);
    }
  }, [messages]);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Error fetching chat messages:', error);
      } else if (data) {
        setMessages(data as ChatMessage[]);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel('public:chat_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    if (!user) {
      alert("채팅에 참여하려면 디스코드 로그인이 필요합니다!");
      return;
    }

    setInput('');
    const { error } = await supabase.from('chat_messages').insert([{ text: input }]);
    if (error) {
      console.error('Send error:', error);
      alert('메시지 전송에 실패했습니다.');
    }
  };

  const myId = user?.id;

  const parseTime = (timestamp: string) => {
    try {
      return new Date(timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '방금 전';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="h-full flex flex-col pt-4 pb-2"
    >
      <div className="mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold tracking-tight">실시간 채팅</h1>
        <p className="text-white/60 text-sm mt-1">접속 중인 유저들과 자유롭게 대화하세요.</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-6 mb-4 flex flex-col">
        <AnimatePresence>
          {messages.map((msg) => {
            const isMe = msg.author_id === myId;
            return (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={`flex max-w-[80%] gap-3 ${isMe ? 'self-end flex-row-reverse' : 'self-start'}`}
            >
              <img 
                src={msg.author_avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.author_name}`} 
                alt="profile" 
                className="w-10 h-10 rounded-full border border-white/20 shadow-md object-cover flex-shrink-0 mt-1 bg-white/5"
              />
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <span className="text-xs text-white/60 mb-1 ml-1 mr-1">{msg.author_name}</span>
                <div 
                  className={`p-3 rounded-2xl shadow-sm break-words max-w-full whitespace-pre-wrap ${
                    isMe 
                      ? 'bg-indigo-500 text-white rounded-tr-sm' 
                      : msg.is_system ? 'bg-indigo-900/50 border border-indigo-400/30 text-indigo-100 rounded-lg text-sm' : 'glass-dark border border-white/10 text-white rounded-tl-sm'
                  }`}
                >
                  {msg.text}
                </div>
                <span className="text-[10px] text-white/40 mt-1 px-1">{parseTime(msg.created_at)}</span>
              </div>
            </motion.div>
          )})}
        </AnimatePresence>
      </div>

      <form onSubmit={handleSend} className="mt-auto pt-2">
        <div className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={user ? "메시지를 입력하세요..." : "로그인 후 채팅을 이용해보세요!"}
            disabled={!user}
            className="w-full glass-dark bg-white/5 border border-white/10 rounded-full py-3 pl-5 pr-12 text-sm text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-sans disabled:opacity-50 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.1)] focus:shadow-[0_0_20px_rgba(99,102,241,0.3)]"
          />
          <button 
            type="submit"
            disabled={!input.trim() || !user}
            className="absolute right-2 p-2 rounded-full bg-indigo-500 text-white disabled:bg-white/10 disabled:text-white/30 hover:bg-indigo-400 transition-colors"
          >
            <Send className="w-4 h-4 ml-[-2px] mt-[1px]" />
          </button>
        </div>
      </form>
    </motion.div>
  );
}
