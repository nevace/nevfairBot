const MarketStream = require('./MarketStream');
const OrderStream = require('./OrderStream');
const MasterStream = require('./MasterStream');

class StreamFactory {

  init(appKey, sessionToken, strategies, username) {
    for (let strategy of strategies) {
      this.createStream(appKey, sessionToken, 'master', strategy, username);
    }
  }

  createStream(appKey, sessionToken, type, strategy, username, config) {
    switch (type) {
      case 'master':
        return new MasterStream(appKey, sessionToken, strategy, username);
        break;
      case 'market':
        return new MarketStream(appKey, sessionToken, strategy, username, config);
        break;
      case 'order':
        return new OrderStream(appKey, sessionToken, strategy, username, config);
        break;
    }
  }

}

module.exports = new StreamFactory();
