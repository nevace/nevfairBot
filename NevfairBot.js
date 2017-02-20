const BetfairClient = require('./BetfairClient');
const StreamFactory = require('./StreamFactory');

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
        console.log(session)
        this.session = session
        return StreamFactory.init(this.credentials.appKey, this.session.token, this.config);
      })
      .then(streams => this.streams = streams)
      .catch(err => console.log(err))
  }
}

module.exports = NevfairBot;
