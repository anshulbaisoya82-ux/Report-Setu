# Stage 1: build the React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY scripts/ ./scripts/
# postinstall copies the on-device OCR engine into public/ocr
RUN npm ci
COPY . .
# API address the browser will call (the backend container is published on port 5000)
ARG VITE_API_BASE_URL=http://localhost:5000/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# Stage 2: serve the static files with nginx
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
