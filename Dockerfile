FROM node:7.6.0-alpine

RUN addgroup -S nevace && adduser -S -g nevace nevace

ENV HOME=/home/nevace

COPY package.json $HOME/nevfairBot/

RUN chown -R nevace:nevace $HOME/*

USER nevace

WORKDIR $HOME/nevfairBot/

RUN npm cache clean && \
    npm install

ADD . $HOME/nevfairBot/

CMD ["npm", "start"]