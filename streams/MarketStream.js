const StreamBase = require('./StreamBase');

/**
 * @extends StreamBase
 */
class MarketStream extends StreamBase {
  constructor(appKey, session, strategy, username, market) {
    super(appKey, session, strategy, username);
    this.market = market;
    this.strategyIns = new (require(`../strategies/${this.strategy.strategy}/MarketStreamStrategy`))(username, this.constructor.name, market, this.strategy.strategy);
  }

  _handleErr(err) {
    super._handleErr(err, {marketId: this.market.id});
  }

  _handleData(rawData) {
    super._handleData(rawData, {marketId: this.market.id});
  }

  _handleSocketEnd() {
    super._handleSocketEnd({marketId: this.market.id});
  }

  _handleSocketClose(hasErr) {
    super._handleSocketClose(hasErr, {marketId: this.market.id});
  }

  _sendData(data) {
    super._sendData(data, {marketId: this.market.id});
  }

  _processData(data) {
    this.strategyIns.analyse(data);
  }
}

module.exports = MarketStream;
