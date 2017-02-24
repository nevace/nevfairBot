const MarketStream = require('./MarketStream');
const OrderStream = require('./OrderStream');
const MarketInPlayStream = require('./MarketInPlayStream');

class StreamFactory {

  init(appKey, sessionToken, strategies, username) {
    for (let strategy of strategies) {
      this.createStream(appKey, sessionToken, 'marketInPlay', strategy, username);
      // this.createStream(appKey, sessionToken, 'market', strategy, username);
      // this.createStream(appKey, sessionToken, 'order', strategy, username);
    }
    // return {
    //   market: [this.createStream(appKey, sessionToken, 'market', strategy, username)],
    //   // order: [this.createStream(appKey, sessionToken, 'order', strategy, username)]
    // }
  }

  createStream(appKey, sessionToken, type, strategy, username) {
    switch (type) {
      case 'marketInPlay':
        return new MarketInPlayStream(appKey, sessionToken, strategy, username);
        break;
      case 'market':
        return new MarketStream(appKey, sessionToken, strategy, username);
        break;
      case 'order':
        return new OrderStream(appKey, sessionToken, strategy, username);
        break;
    }
  }

}

module.exports = new StreamFactory();
