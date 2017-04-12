const StreamBase = require('./StreamBase');

class OrderStream extends StreamBase {

  constructor(appKey, session, strategy, username, market) {
    super(appKey, session, strategy, username);
    this.subscriptionConfig = {
      op: 'orderSubscription'
    };
  }

  _processData(data) {
    this.emit(`${this.username}:orderData`, data);
  }

}

module.exports = OrderStream;
