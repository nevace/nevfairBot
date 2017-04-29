FROM node:7.6.0

RUN npm install pm2 -g

#RUN addgroup -S nevace && adduser -S -g nevace nevace
RUN useradd -ms /bin/bash nevace

ENV HOME=/home/nevace

COPY package.json $HOME/nevfairBot/

RUN chown -R nevace:nevace $HOME/*

USER nevace

RUN mkdir -p "$HOME/.ssh" && echo -e $PRIVATE_SSH_KEY >> $HOME/.ssh/id_rsa

WORKDIR $HOME/nevfairBot/

RUN npm cache clean && \
    npm install

ADD . $HOME/nevfairBot/

CMD ["npm", "start"]