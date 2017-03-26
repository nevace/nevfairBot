const MarketStream = require('./MarketStream');
const OrderStream = require('./OrderStream');
const MasterStream = require('./MasterStream');

class StreamFactory {

  /**
   * @param appKey
   * @param sessionToken
   * @param strategies
   * @param username
   */
  init(appKey, sessionToken, strategies, username) {
    for (let strategy of strategies) {
      this.createStream(appKey, sessionToken, 'master', strategy, username);
    }
  }

  /**
   * @param appKey
   * @param sessionToken
   * @param type
   * @param strategy
   * @param username
   * @param config
   * @returns {(MasterStream|MarketStream|OrderStream)}
   */
  createStream(appKey, sessionToken, type, strategy, username, config) {
    switch (type) {
        case 'master':
          return new MasterStream(appKey, sessionToken, strategy, username);
        case 'market':
          return new MarketStream(appKey, sessionToken, strategy, username, config);
        case 'order':
          return new OrderStream(appKey, sessionToken, strategy, username, config);
    }
  }

}

module.exports = new StreamFactory();
