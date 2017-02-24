const BetfairClient = require('./BetfairClient');
const StreamFactory = require('./StreamFactory');
const log = require('./log');

class NevfairBot {
  constructor(credentials, config) {
    this.credentials = credentials;
    this.config = config;
    this.streams;
    this.session;
    this._init();
  }

  _init() {
    BetfairClient.login(this.credentials)
      .then(session => {
        log.debug(session)
        this.session = session
        return StreamFactory.init(this.credentials.appKey, this.session.token, this.config, this.credentials.username);
      })
      .then(streams => this.streams = streams)
      .catch(err => log.error(err))
  }
}

module.exports = NevfairBot;
