const BetfairClient = require('./BetfairClient');
const StreamFactory = require('./streams/StreamFactory');
const log = require('./log');

class NevfairBot {
  constructor(credentials, strategies) {
    this.credentials = credentials;
    this.strategies = strategies;
    this.session = null;
    this._init();
  }

  _init() {
    BetfairClient.login(this.credentials)
      .then(session => {
        log.debug(session);
        this.session = session;
        StreamFactory.init(this.credentials.appKey, this.session.token, this.strategies, this.credentials.username);
      })
      .catch(err => log.error('betfair api error', err.data || err.message));
  }
}

module.exports = NevfairBot;
