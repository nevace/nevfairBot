const log = require('./../log');
const EventEmitter = require('events').EventEmitter;

class MarketStrategyBase extends EventEmitter {
  /**
   * @param username
   * @param streamName
   * @param market
   * @param strategyName
   */
  constructor(username, streamName, market, strategyName) {
    super();
    this.username = username;
    this.stream = streamName;
    this.strategyName = strategyName;
    this.market = market;
    this.runners = {};
    this.on(`${this.username}:orderData`, this._handleOrderData.bind(this));
    this.debug = false;
    this.stake = 250;
    this.bank = 0;

    for (let runner of market.marketDefinition.runners) {
      this.runners[runner.id] = runner;
      this.runners[runner.id].ladder = {
        lay: [{price: null, size: null}],
        back: [{price: null, size: null}]
      };
    }
  }

  _handleOrderData(data) {
    log.debug('handleOrderData', {
      data,
      username: this.username,
      stream: this.stream,
      strategy: this.strategyName
    });
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
        // let laySize = cachedRunner.ladder.lay[0].size;
        // let backSize = cachedRunner.ladder.back[0].size;

        // update ladder lay cache if changed
        if (runner.bdatl && runner.bdatl.length) {
          this._updateCache(runner, cachedRunner, 'lay');
        }

        // update ladder back cache if changed
        if (runner.bdatb && runner.bdatb.length) {
          this._updateCache(runner, cachedRunner, 'back');
        }

        if (cachedRunner.betOpen) {
          this._backLogic(cachedRunner);
        } else {
          this._layLogic(cachedRunner);
        }
      }
    }
  }

}

module.exports = MarketStrategyBase;
