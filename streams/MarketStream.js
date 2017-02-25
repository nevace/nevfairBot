const StreamBase = require('./StreamBase');

class MarketStream extends StreamBase {
  constructor(appKey, session, strategy, username, config) {
    super(appKey, session, strategy, username)
    this.strategyIns = new(require(`../strategies/${this.strategy.strategy}/MarketStreamStrategy`))(username, this.constructor.name, config);
  }

  _subscribe() {
    this._sendData(this.strategyIns.subscriptionConfig);
  }

  _passToStrategy(data) {
    this.strategyIns.analyse(data);

    // if (marketChanges) {
    //   for (let market of marketChanges) {
    //     this.streams[market.id] = this.streams[market.id] || {};
    //     this.streams[market.id].market = StreamFactory.createStream(this.appKey, this.session, 'market', this.strategy.strategy, this.username, market);
    //   }
    // }
  }
}


module.exports = MarketStream;
