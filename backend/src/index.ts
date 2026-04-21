import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { createClient } from "@supabase/supabase-js";

// 환경변수나 하드코딩된 값 (테스트용)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';

// Supabase client instance (if URL and Key are provided)
const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Mock data fallback
const mockPosts = [
  { id: 1, title: '첫 번째 글래스모피즘 앱', content: 'Bun과 Elysia를 사용하여 엄청난 속도를 경험하세요.' },
  { id: 2, title: '아름다운 UI', content: 'Tailwind CSS V4와 Framer Motion으로 생동감을 불어넣었습니다.' },
  { id: 3, title: 'Supabase 연동 완료', content: '데이터베이스와 인증을 손쉽게 연결하고 관리할 수 있습니다.' },
];

const app = new Elysia()
  .use(cors())
  .get("/", () => "Hello from Fullstack Glassmorphism App API")
  .get("/api/posts", async () => {
    if (supabase) {
      const { data, error } = await supabase.from('posts').select('*').order('id', { ascending: false });
      if (error) {
        console.error('Supabase fetch error:', error);
        return mockPosts; // fallback
      }
      return data;
    }
    return mockPosts;
  })
  .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
