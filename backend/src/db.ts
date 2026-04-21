import { Database } from "bun:sqlite";
import { randomUUID } from "crypto";

export const db = new Database("sqlite.db", { create: true });

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    discord_id TEXT UNIQUE,
    nickname TEXT,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

export interface User {
  id: string;
  discord_id: string;
  nickname: string;
  avatar_url: string;
}

export function getUserByToken(token: string): User | null {
  const session = db.prepare("SELECT user_id FROM sessions WHERE token = ?").get(token) as { user_id: string } | undefined;
  if (!session) return null;
  return db.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id) as User | undefined || null;
}

export function createMockDiscordSession(): { token: string; user: User } {
  const mockDiscordId = "discord_" + Math.floor(Math.random() * 10000);
  const mockNickname = "DiscordUser" + Math.floor(Math.random() * 1000);
  const mockAvatar = "https://cdn.discordapp.com/embed/avatars/" + (Math.floor(Math.random() * 5)) + ".png";
  const userId = randomUUID();
  
  db.prepare("INSERT INTO users (id, discord_id, nickname, avatar_url) VALUES (?, ?, ?, ?)").run(userId, mockDiscordId, mockNickname, mockAvatar);
  
  const token = randomUUID();
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  
  return {
    token,
    user: { id: userId, discord_id: mockDiscordId, nickname: mockNickname, avatar_url: mockAvatar }
  };
}

export function updateUserProfile(id: string, nickname: string, avatar_url: string): User {
  db.prepare("UPDATE users SET nickname = ?, avatar_url = ? WHERE id = ?").run(nickname, avatar_url, id);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User;
}
