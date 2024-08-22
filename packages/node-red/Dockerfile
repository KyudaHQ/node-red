FROM node:20-alpine

RUN apk add --no-cache build-base git openssh python3
RUN mkdir ~/.ssh
RUN ssh-keyscan bitbucket.org >> ~/.ssh/known_hosts

WORKDIR /node-red

COPY package.json package.json
RUN npm install --unsafe-perm --no-update-notifier --no-fund --only=production

COPY server.js .
COPY src ./src

ENTRYPOINT ["npm", "run", "start"]