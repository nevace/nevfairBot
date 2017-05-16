const StreamBase = require('./StreamBase');
const event = require('./../event');

class OrderStream extends StreamBase {

  constructor(appKey, session, strategy, username) {
    super(appKey, session, strategy, username);
    this.subscriptionConfig = {
      op: 'orderSubscription'
    };
  }

  _processData(data) {
    event.emit(`${this.username}:${this.strategy.strategy}:orderData`, data);
  }

}

module.exports = OrderStream;
