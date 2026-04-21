# 1. Build Stage
FROM node:20-alpine AS build

WORKDIR /app

# 패키지 정보 복사 및 의존성 설치
COPY package*.json ./
RUN npm install

# 소스 코드 복사
COPY . .

# Vite는 빌드 시점(Build-time)에 환경변수가 필요하므로 ARG를 통해 받습니다.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# 배포용 정적 파일 생성 (dist 폴더에 생성됨)
RUN npm run build

# 2. Production Stage (Nginx)
FROM nginx:alpine

# 빌드된 결과물을 Nginx 서빙 폴더로 복사
COPY --from=build /app/dist /usr/share/nginx/html

# SPA(React Router 등) 라우팅을 위한 Nginx 커스텀 설정 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
