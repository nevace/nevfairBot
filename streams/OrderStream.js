const StreamBase = require('./StreamBase');
const event = require('./../event');

class OrderStream extends StreamBase {

  constructor(appKey, session, strategy, username) {
    super(appKey, session, strategy, username);
    this.subscriptionConfig = {
      op: 'orderSubscription'
    };
    console.log('dddd', appKey, session, strategy, username);
  }

  _processData(data) {
    event.emit(`${this.username}:orderData`, data);
  }

}

module.exports = OrderStream;
