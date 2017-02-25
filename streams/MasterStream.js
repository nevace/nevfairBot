const StreamBase = require('./StreamBase');
const StreamFactory = require('./StreamFactory');
const log = require('../log');

class MasterStream extends StreamBase {
  constructor(appKey, session, strategy, username) {
    super(appKey, session, strategy, username)
    this.strategyIns = new(require(`../strategies/${this.strategy.strategy}/MasterStreamStrategy`))(username, this.constructor.name);
    this.streams = {};
    this.StreamFactory = require('./StreamFactory');
  }

  _subscribe() {
    this._sendData(this.strategyIns.subscriptionConfig);
  }

  _passToStrategy(data) {
    const marketChanges = this.strategyIns.analyse(data);

    if (marketChanges) {
      for (let market of marketChanges) {
        if (market.inPlay) {
          this.streams[market.market.id] = {};
          this.streams[market.market.id].market = this.StreamFactory.createStream(this.appKey, this.session, 'market', this.strategy, this.username, market);
          log.debug('masterStream cache', { data: this.streams, username: this.username, stream: this.constructor.name });
        } else {
          delete this.streams[market.id];
          log.debug('masterStream cache', { data: this.streams, username: this.username, stream: this.constructor.name });
        }
      }
    }
  }

}


module.exports = MasterStream;
