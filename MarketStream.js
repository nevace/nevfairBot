const StreamBase = require('./StreamBase');

class MarketStream extends StreamBase {
  // constructor() {

  // }
  _subscribe() {
    this._sendData({
      op: 'marketSubscription',
      marketFilter: {
        marketIds: ['1.129915791'],
        // bspMarket: true,
        bettingTypes: ['ODDS'],
        eventTypeIds: ['7'],
        // turnInPlayEnabled: true,
        inPlayOnly: true,
        marketTypes: ['WIN'],
        // countryCodes: ['GBR']
      },
      marketDataFilter: { fields: ['EX_BEST_OFFERS_DISP'], ladderLevels: 1 }
    })
  }
}


module.exports = MarketStream;
