# ---- Build Stage ----
FROM oven/bun:1.3.1 AS build

WORKDIR /frontend

ARG VITE_API_URL=http://backend:5000
ENV VITE_API_URL=$VITE_API_URL

COPY package*.json ./
RUN bun install --ignore-scripts
COPY . .
RUN bun run build

# ---- Serve Stage ----
FROM nginx:alpine

# Copy frontend build output
COPY --from=build /frontend/dist /usr/share/nginx/html

# Replace default nginx config with SPA + API proxy
RUN rm /etc/nginx/conf.d/default.conf
RUN printf "server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Proxy API requests to backend inside ECS task\n\
    location /api/ {\n\
        proxy_pass http://localhost:5000/;\n\
        proxy_set_header Host \$host;\n\
        proxy_set_header X-Real-IP \$remote_addr;\n\
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;\n\
        proxy_set_header X-Forwarded-Proto \$scheme;\n\
    }\n\
\n\
    # React/Vite SPA routes\n\
    location / {\n\
        try_files \$uri /index.html;\n\
    }\n\
}\n" > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
