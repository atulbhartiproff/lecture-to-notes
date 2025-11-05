FROM node:20-alpine

WORKDIR /usr/src/app

COPY package.json ./
RUN npm install --only=production && npm cache clean --force

COPY . .

ENV PORT=5000
EXPOSE 5000

CMD ["npm", "start"]
