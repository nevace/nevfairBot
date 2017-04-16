const log = require('../../log');
const MasterStrategyBase = require('../MasterStrategyBase');

/**
 * @extends MasterStrategyBase
 */
class MasterStreamStrategy extends MasterStrategyBase {
  constructor(username, stream, strategyName) {
    super(username, stream, strategyName);
    this.subscriptionConfig = {
      op: 'marketSubscription',
      marketFilter: {
        bspMarket: true,
        bettingTypes: ['ODDS'],
        eventTypeIds: ['7'],
        turnInPlayEnabled: true,
        marketTypes: ['WIN'],
        // countryCodes: ['GB', 'IE']
      },
      marketDataFilter: {
        fields: ['EX_MARKET_DEF'],
      }
    };
  }

  /**
   * @param data
   * @description Returns object when a market has gone in play or has closed.
   * @override
   */
  analyse(data) {
    //first image
    if (data.ct === 'SUB_IMAGE' || data.ct === 'RESUB_DELTA') {
      log.info('read', {data, username: this.username, stream: this.stream, strategy: this.strategyName});
      return;
    }

    //changes
    if (data.op === 'mcm' && data.mc && data.mc.length) {
      // log.debug('masterStream data', {data, username: this.username, stream: this.stream});
      const marketsOpeningOrClosing = data.mc.filter(market => {
        return (market.marketDefinition.inPlay && market.marketDefinition.status === 'OPEN') ||
          (market.marketDefinition.inPlay && market.marketDefinition.status === 'CLOSED');
      });

      if (!marketsOpeningOrClosing.length) return;

      return marketsOpeningOrClosing.map(market => {
        return {
          inPlay: (market.marketDefinition.status === 'OPEN'),
          market
        };
      });
    }
  }

}

module.exports = MasterStreamStrategy;
