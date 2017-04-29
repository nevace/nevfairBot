FROM node:7.6.0

#RUN addgroup -S nevace && adduser -S -g nevace nevace
RUN useradd -ms /bin/bash nevace

ENV HOME=/home/nevace

COPY package.json $HOME/nevfairBot/

RUN chown -R nevace:nevace $HOME/*

USER nevace

WORKDIR $HOME/nevfairBot/

RUN npm cache clean && \
    npm install

ADD . $HOME/nevfairBot/

#CMD ["sleep", "10"]
#CMD ["npm", "start"]