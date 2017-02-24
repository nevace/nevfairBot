const StreamBase = require('./StreamBase');
const log = require('./log');

class MarketInPlayStream extends StreamBase {
  constructor(appKey, session, strategy, username) {
    super(appKey, session, strategy, username)
    this.strategyIns = new(require(`./strategies/${this.strategy.strategy}/MarketInPlayStrategy`))()
  }
  _subscribe() {
    this._sendData({
      op: 'marketSubscription',
      marketFilter: {
        marketIds: ['1.129937337'],
        // bspMarket: true,
        bettingTypes: ['ODDS'],
        eventTypeIds: ['7'],
        // turnInPlayEnabled: true,
        inPlayOnly: true,
        marketTypes: ['WIN'],
        // countryCodes: ['GBR']
      },
      marketDataFilter: {
        fields: ['EX_BEST_OFFERS_DISP'],
        ladderLevels: 1
      }
    })
  }

  _passToStrategy(data) {
    this.strategyIns.analyse(data);
  }

}


module.exports = MarketInPlayStream;
