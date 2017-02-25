const BetfairClient = require('./BetfairClient');
const StreamFactory = require('./streams/StreamFactory');
const log = require('./log');
// console.log(StreamFactory.createStream)
class NevfairBot {
  constructor(credentials, strategies) {
    this.credentials = credentials;
    this.strategies = strategies;
    this.session;
    this._init();
  }

  _init() {
    BetfairClient.login(this.credentials)
      .then(session => {
        log.debug(session)
        this.session = session
        StreamFactory.init(this.credentials.appKey, this.session.token, this.strategies, this.credentials.username);
      })
      .catch(err => log.error(err))
  }
}

module.exports = NevfairBot;
