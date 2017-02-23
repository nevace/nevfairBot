const MarketStream = require('./MarketStream');
const OrderStream = require('./OrderStream');

class StreamFactory {

  init(appKey, sessionToken, config, username) {
    const { strategy } = config;
    return {
      market: [this.createStream(appKey, sessionToken, 'market', strategy, username)],
      // order: [this.createStream(appKey, sessionToken, 'order', strategy, username)]
    }
  }

  createStream(appKey, sessionToken, type, strategy, username) {
    return type === 'market' ? new MarketStream(appKey, sessionToken, strategy, username) : new OrderStream(appKey, sessionToken, strategy, username);
  }

}

module.exports = new StreamFactory();
