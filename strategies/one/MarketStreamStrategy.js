const log = require('../../log');
const merge = require('deepmerge');

class MarketStreamStrategy {
  constructor(username, stream, market) {
    this.username = username;
    this.stream = stream;
    this.market = market;
    this.subscriptionConfig = {
      op: 'marketSubscription',
      marketFilter: {
        marketIds: [market.id],
        bspMarket: true,
        bettingTypes: ['ODDS'],
        eventTypeIds: ['7'],
        turnInPlayEnabled: true,
        marketTypes: ['WIN'],
        countryCodes: ['GBR']
      },
      marketDataFilter: {
        fields: ['EX_BEST_OFFERS_DISP'],
        ladderLevels: 1
      }
    }
  }

  analyse(data) {
    //first image
    if (data.ct === 'SUB_IMAGE' || data.ct === 'RESUB_DELTA') {
      log.info('read', { data, username: this.username, stream: this.stream });
      return;
    }

    log.debug('marketStream data', { data, username: this.username, stream: this.stream });

    // //changes
    // if (data.op === 'mcm' && data.mc && data.mc.length) {
    //   const marketChanges = data.mc.filter(market => market.marketDefinition.inPlay);
    //   return marketChanges.length ? marketChanges : false;
    // }
  }

}

module.exports = MarketStreamStrategy;
