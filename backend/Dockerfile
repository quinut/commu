FROM oven/bun:latest
WORKDIR /app

# 패키지 매니저 파일들을 먼저 복사 (의존성 캐싱)
COPY package.json bun.lock* ./
RUN bun install

# 나머지 백엔드 코드 복사
COPY . .

# 컨테이너 외부로 노출할 포트 (Elysia 디폴트 3000)
EXPOSE 3000

# 프로젝트 실행 (watch 없이 구동)
CMD ["bun", "run", "src/index.ts"]
