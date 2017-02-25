const log = require('../../log');

class MasterStreamStrategy {
  constructor(username, stream) {
    this.username = username;
    this.stream = stream;
    this.subscriptionConfig = {
      op: 'marketSubscription',
      marketFilter: {
        marketIds: ['1.129939444'],
        bspMarket: true,
        bettingTypes: ['ODDS'],
        eventTypeIds: ['7'],
        turnInPlayEnabled: true,
        marketTypes: ['WIN'],
        countryCodes: ['GB', 'IE']
      },
      marketDataFilter: {
        fields: ['EX_MARKET_DEF'],
      }
    }
  }

  analyse(data) {
    //first image
    if (data.ct === 'SUB_IMAGE' || data.ct === 'RESUB_DELTA') {
      log.info('read', { data, username: this.username, stream: this.stream, strategy: 'one' });
      return;
    }

    //changes
    if (data.op === 'mcm' && data.mc && data.mc.length) {
      log.debug('masterStream data', { data, username: this.username, stream: this.stream });
      const marketsOpeningOrClosing = data.mc.filter(market => {
        return (market.marketDefinition.inPlay && market.marketDefinition.status === 'OPEN') ||
          (market.marketDefinition.inPlay && market.marketDefinition.status === 'CLOSED');
      });

      if (!marketsOpeningOrClosing.length) return;

      return marketsOpeningOrClosing.map(market => {
        return {
          inPlay: (market.marketDefinition.status === 'OPEN'),
          market
        }
      });
    }
  }

}

module.exports = MasterStreamStrategy;
