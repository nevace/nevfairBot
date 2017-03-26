const log = require('../../log');

//runners with bsp below BSP_THRESHOLD will need a price more than or equal
//to LAY_PRICE_MIN and less than or equal to LAY_PRICE_MAX to trigger lay.

//runners with bsp equal or above BSP_THRESHOLD will need to increase in price by
//PRICE_CHANGED_THRESHOLD and be less than or equal to LAY_PRICE_MAX to trigger lay

//runners with open lay bets and price equal to or below
//RED_OUT_THRESHOLD will trigger back back to red out
const BSP_THRESHOLD = 20;
const LAY_PRICE_MIN = 20;
const LAY_PRICE_MAX = 30;
const PRICE_CHANGED_THRESHOLD = 1.1;
const RED_OUT_THRESHOLD = 18;
const PRICE_CHANGE_TIMER = 2000;

class MarketStreamStrategy {
  /**
   * @param username
   * @param streamName
   * @param market
   */
  constructor(username, streamName, market) {
    this.username = username;
    this.stream = streamName;
    this.market = market;
    this.subscriptionConfig = {
      op: 'marketSubscription',
      marketFilter: {
        marketIds: [market.id],
      },
      marketDataFilter: {
        fields: ['EX_BEST_OFFERS_DISP'],
        ladderLevels: 1
      }
    };
    this.runners = {};
    this.debug = true;
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

  /**
   * @param cachedRunner
   * @param cachedRunnerBackPrice
   * @private
   */
  _placeBackOrder(cachedRunner, cachedRunnerBackPrice) {
    cachedRunner.betOpen = false;
    cachedRunner.back = {
      stake: (cachedRunner.lay.price / cachedRunnerBackPrice) * cachedRunner.lay.stake,
      price: cachedRunnerBackPrice
    };

    let redOutLoss = (cachedRunner.back.stake * (cachedRunner.back.price - 1)) - this.stake;

    log.debug('place back bet', {
      redOutLoss,
      cachedRunner,
      username: this.username,
      stream: this.stream,
      marketId: this.market.id,
      strategy: 'one'
    });

    if (this.debug) {
      this.bank -= cachedRunner.lay.stake;
      this.bank += redOutLoss;

      log.debug('bank', {
        bank: this.bank,
        username: this.username,
        stream: this.stream,
        marketId: this.market.id,
        strategy: 'one'
      });
    }
  }

  /**
   * @param cachedRunner
   * @param cachedRunnerLayPrice
   * @private
   */
  _placeLayOrder(cachedRunner, cachedRunnerLayPrice) {
    const win = this.stake / (cachedRunnerLayPrice - 1);
    cachedRunner.betOpen = true;
    cachedRunner.lay = {stake: win, price: cachedRunnerLayPrice};

    log.debug('place lay bet', {
      win,
      cachedRunner,
      username: this.username,
      stream: this.stream,
      marketId: this.market.id,
      strategy: 'one'
    });

    if (this.debug) {
      this.bank += win;

      log.debug('bank', {
        bank: this.bank,
        username: this.username,
        stream: this.stream,
        marketId: this.market.id,
        strategy: 'one'
      });
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
    //   strategy: 'one'
    // });
  }

  /**
   * @param {Object} cachedRunner The cached Runner Object
   * @param {number} cachedRunnerPrice The cached Runner's lay/back price
   * @param {('back'|'lay')} orderType The type of operation
   * @description Places an order within a timeout and saves to the cached Runner.
   * @private
   */
  _setTimer(cachedRunner, cachedRunnerPrice, orderType) {
    if (cachedRunner.pendingOrder) return;
    const operation = (orderType === 'lay') ? this._placeLayOrder : this._placeBackOrder;

    cachedRunner.pendingOrder = setTimeout(operation.bind(this), PRICE_CHANGE_TIMER, cachedRunner, cachedRunnerPrice);
  }

  /**
   * @param {Object} cachedRunner The cached Runner Object
   * @description Clears the timeout and cancels the pending order to be placed.
   * @private
   */
  _clearTimer(cachedRunner) {
    if (!cachedRunner.pendingOrder) return;
    // log.debug('timeout cancelled', cachedRunner);
    clearTimeout(cachedRunner.pendingOrder);
    cachedRunner.pendingOrder = null;
  }

  /**
   * @param {Object} cachedRunner The cached Runner Object
   * @description The logic to determine whether to place a back order.
   * @private
   */
  _backLogic(cachedRunner) {
    const cachedRunnerLayPrice = cachedRunner.ladder.lay[0].price;
    const cachedRunnerBackPrice = cachedRunner.ladder.back[0].price;

    //if SP is >= 20
    if (cachedRunnerLayPrice <= RED_OUT_THRESHOLD && cachedRunnerBackPrice < cachedRunnerLayPrice) {
      this._setTimer(cachedRunner, cachedRunnerBackPrice, 'back');
      return;
    }
    this._clearTimer(cachedRunner);
  }

  /**
   * @param {Object} cachedRunner The cached Runner Object
   * @description The logic to determine whether to place a lay order.
   * @private
   */
  _layLogic(cachedRunner) {
    const cachedRunnerLayPrice = cachedRunner.ladder.lay[0].price;
    //the SP is >= 20 and the lay price is >= 10% above SP but <=30
    if (cachedRunner.bsp >= BSP_THRESHOLD) {
      if (cachedRunnerLayPrice <= LAY_PRICE_MAX && ((cachedRunnerLayPrice / cachedRunner.bsp) >= PRICE_CHANGED_THRESHOLD)) {
        this._setTimer(cachedRunner, cachedRunnerLayPrice, 'lay');
        return;
      }
    } else {
      //the SP is < 20 and the lay price is >= 20 but <= 30
      if (cachedRunnerLayPrice >= LAY_PRICE_MIN && cachedRunnerLayPrice <= LAY_PRICE_MAX) {
        this._setTimer(cachedRunner, cachedRunnerLayPrice, 'lay');
        return;
      }
    }
    //if runner falls out of range of criteria, clear timer for placing order, if set.
    this._clearTimer(cachedRunner);
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
        strategy: 'one'
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
      //log.debug('runner changes', { data: this.runners, username: this.username, stream: this.stream, strategy: 'one' });
    }
  }

}

module.exports = MarketStreamStrategy;
