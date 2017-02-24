const log = require('../../log');

class MarketInPlayStrategy {
  // constructor() {
  //  // code
  // }
  analyse(data) {
    if (data.ct === 'SUB_IMAGE' || data.ct === 'RESUB_DELTA') {
      log.info('read', { data, username: this.username, stream: this.constructor.name });
      return;
    }

    if (data.op === 'mcm') {
      log.debug('data here', data)
    }
  }

}

module.exports = MarketInPlayStrategy;
