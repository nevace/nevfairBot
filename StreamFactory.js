const MarketStream = require('./MarketStream');
const OrderStream = require('./OrderStream');

class StreamFactory {

  init(appKey, sessionToken, config) {
    const { strategy } = config;
    return {
      market: [this.createStream(appKey, sessionToken, 'market', strategy)],
      order: [this.createStream(appKey, sessionToken, 'order', strategy)]
    }
  }

  createStream(appKey, sessionToken, type, strategy) {
    return type === 'market' ? new MarketStream(appKey, sessionToken, strategy) : new OrderStream(appKey, sessionToken, strategy);
  }

}

module.exports = new StreamFactory();
