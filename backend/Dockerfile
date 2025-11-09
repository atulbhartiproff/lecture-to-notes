FROM node:20-alpine

WORKDIR /usr/src/app

# Copy and install deps
COPY package.json ./
RUN npm install --only=production && npm cache clean --force

# Copy source
COPY . .

# Internal network ports
ENV PORT=5000
# ECS containers talk to each other on localhost
ENV AI_SERVICE_URL=http://ai_service:8000
# Your NGINX frontend will proxy through /api
ENV FRONTEND_ORIGIN=http://localhost

EXPOSE 5000

CMD ["npm", "start"]
