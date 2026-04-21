import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { User } from '@supabase/supabase-js';

interface ProfileModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdated: () => void;
}

export default function ProfileModal({ user, isOpen, onClose, onProfileUpdated }: ProfileModalProps) {
  const [nickname, setNickname] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && isOpen) {
      // First try to get custom metadata, fallback to discord metadata, fallback to defaults
      const meta = user.user_metadata;
      setNickname(meta.nickname || meta.custom_claims?.global_name || meta.full_name || '새 유저');
      setAvatarUrl(meta.avatar_url || meta.picture || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + user.id);
    }
  }, [user, isOpen]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await supabase.auth.updateUser({
      data: {
        nickname: nickname,
        avatar_url: avatarUrl
      }
    });

    setLoading(false);
    
    if (error) {
      alert('프로필 업데이트에 실패했습니다: ' + error.message);
    } else {
      onProfileUpdated();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="glass-dark w-full max-w-md rounded-3xl p-6 border border-white/20 shadow-2xl relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-6">프로필 설정</h2>

        <form onSubmit={handleSave} className="space-y-5">
          <div className="flex flex-col items-center mb-6">
            <img 
              src={avatarUrl || 'https://via.placeholder.com/150'} 
              alt="Preview" 
              className="w-24 h-24 rounded-full object-cover border-2 border-indigo-400/50 mb-4 shadow-lg origin-center"
            />
            <p className="text-xs text-white/40">미리보기</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">닉네임</label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-white/20"
              placeholder="자유롭게 입력하세요"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-1">프로필 이미지 URL</label>
            <input
              type="text"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-white/20 text-sm"
              placeholder="https://..."
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 mt-4 bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/25 transition-all outline-none"
          >
            {loading ? '저장 중...' : '저장하기'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
