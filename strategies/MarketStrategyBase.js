const log = require('./../log');
const event = require('../event');

class MarketStrategyBase {
  /**
   * @param username
   * @param streamName
   * @param market
   * @param strategyName
   */
  constructor(username, streamName, market, strategyName) {
    this.username = username;
    this.stream = streamName;
    this.strategyName = strategyName;
    this.market = market;
    this.runners = {};
    this.debug = false;
    this.bank = 0;
    event.on(`${this.username}:orderData`, this._handleOrderData.bind(this));

    for (let runner of market.marketDefinition.runners) {
      this.runners[runner.id] = runner;
      this.runners[runner.id].ladder = {
        lay: [{price: null, size: null}],
        back: [{price: null, size: null}]
      };
      this.runners[runner.id].orders = {};
    }
  }

  _handleOrderData(data) {
    if (data.op === 'ocm' && data.oc && data.oc.length) {
      for (let market of data.oc) {
        if (market.id === this.market.id) {
          for (let orderChanges of market.orc) {
            this.runners[orderChanges.id].orders = orderChanges;
            log.debug('runnerCache change', Object.assign(this.logData, this.runners[orderChanges.id]));
          }
          break;
        }
      }
    }
  }

  /**
   * @param runner
   * @param cachedRunner
   * @param type
   * @private
   */
  _updateCache(runner, cachedRunner, type) {
    const ladderData = (type === 'lay') ? runner.bdatl : runner.bdatb;
    cachedRunner.ladder[type][0] = {
      price: ladderData[0][1],
      size: ladderData[0][2]
    };

    // log.debug('update cache', {
    //   cachedRunner,
    //   username: this.username,
    //   stream: this.stream,
    //   strategy: this.strategyName
    // });
  }

  /**
   * @param {Object} cachedRunner The cached Runner Object
   * @description The logic to determine whether to place a back order.
   * @private
   * @abstract
   */
  _backLogic(cachedRunner) {
  }

  /**
   * @param {Object} cachedRunner The cached Runner Object
   * @description The logic to determine whether to place a lay order.
   * @private
   * @abstract
   */
  _layLogic(cachedRunner) {
  }

  /**
   * @param {Object} cachedRunner The cached Runner Object
   * @description When to apply the Back and Lay Logic methods.
   * @private
   * @abstract
   */
  _applyBackLayLogic(cachedRunner) {

  }

  /**
   * @param data
   */
  analyse(data) {
    //first image
    if (data.ct === 'SUB_IMAGE' || data.ct === 'RESUB_DELTA') {
      log.info('read', {
        data,
        username: this.username,
        stream: this.stream,
        marketId: this.market.id,
        strategy: this.strategyName
      });
      return;
    }

    //changes - bot logic
    if (data.op === 'mcm' && data.mc && data.mc.length) {
      const runnerChanges = data.mc[0].rc;

      for (let runner of runnerChanges) {
        let cachedRunner = this.runners[runner.id];

        // update ladder lay cache if changed
        if (runner.bdatl && runner.bdatl.length) {
          this._updateCache(runner, cachedRunner, 'lay');
        }

        // update ladder back cache if changed
        if (runner.bdatb && runner.bdatb.length) {
          this._updateCache(runner, cachedRunner, 'back');
        }

        this._applyBackLayLogic(cachedRunner);
      }
    }
  }

}

module.exports = MarketStrategyBase;
