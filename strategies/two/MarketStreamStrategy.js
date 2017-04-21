const log = require('../../log');
const MarketStrategyBase = require('../MarketStrategyBase');
const BetfairClient = require('../../BetfairClient');

//adding back and lay specific timers and changing time to 3 secs

//runners with bsp below BSP_THRESHOLD will need a price more than or equal
//to LAY_PRICE_MIN and less than or equal to LAY_PRICE_MAX to trigger lay.

//runners with bsp equal or above BSP_THRESHOLD will need to increase in price by
//PRICE_CHANGED_THRESHOLD and be less than or equal to LAY_PRICE_MAX to trigger lay

//runners with open lay bets and price equal to or below
//RED_OUT_THRESHOLD will trigger back to red out
const BSP_THRESHOLD = 20;
const LAY_PRICE_MIN = 20;
const LAY_PRICE_MAX = 30;
const PRICE_CHANGED_THRESHOLD = 1.1;
const RED_OUT_THRESHOLD = 18;
const BACK_PRICE_CHANGE_TIMER = 3000;
const LAY_PRICE_CHANGE_TIMER = 2000;

/**
 * @extends MarketStrategyBase
 */
class MarketStreamStrategy extends MarketStrategyBase {
  /**
   * @param username
   * @param streamName
   * @param market
   * @param strategyName
   */
  constructor(username, streamName, market, strategyName) {
    super(username, streamName, market, strategyName);
    this.stake = 2.5;
    this.logData = {
      username: this.username,
      stream: this.stream,
      marketId: this.market.id,
      strategy: this.strategyName
    };
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
    //remove first and second favourite
    // for (let i = 0; i < 2; i++) {
    //   this.runners[Object.keys(this.runners)[i]] = null;
    //   delete this.runners[Object.keys(this.runners)[i]];
    // }

  }

  /**
   * @param cachedRunner
   * @param cachedRunnerBackPrice
   * @private
   */
  _placeBackOrder(cachedRunner, cachedRunnerBackPrice) {
    for (let order of Object.keys(cachedRunner.orders)) {
      if (cachedRunner.orders[order].side === 'L' && !cachedRunner.orders[order].redout) {
        const redOutLoss = (cachedRunner.orders[order].avp / cachedRunnerBackPrice) * cachedRunner.orders[order].s;
        cachedRunner.orders[order].redout = true;
        const orderParams = {
          selectionId: cachedRunner.id,
          side: 'BACK',
          size: Math.round(redOutLoss * 1e2) / 1e2,
          price: cachedRunnerBackPrice
        };

        if (this.debug) {
          this.bank -= cachedRunner.lay.stake;
          this.bank += redOutLoss;
          log.debug('bank', Object.assign({}, this.logData, {bank: this.bank}));
          return;
        }

        BetfairClient.placeOrder(this.market.id, orderParams, this.logData)
          .then(res => {
            if (res.status === 'SUCCESS') {
              cachedRunner.betOpen = false;
            } else {
              cachedRunner.orders[order].redout = false;
            }
          })
          .catch(err => log.error('BetfairClient.placeBackOrder', Object.assign({}, err, this.logData)));
      }
    }
  }


  /**
   * @param cachedRunner
   * @param cachedRunnerLayPrice
   * @private
   */
  _placeLayOrder(cachedRunner, cachedRunnerLayPrice) {
    const win = (this.stake / (cachedRunnerLayPrice - 1));
    const orderParams = {
      selectionId: cachedRunner.id,
      side: 'LAY',
      size: Math.round(win * 1e2) / 1e2,
      price: cachedRunnerLayPrice
    };

    if (this.debug) {
      this.bank += win;
      log.debug('bank', Object.assign({}, this.logData, {bank: this.bank}));
      return;
    }

    BetfairClient.placeOrder(this.market.id, orderParams, this.logData)
      .then(res => {
        if (res.status === 'SUCCESS') {
          cachedRunner.betOpen = true;
        }
      })
      .catch(err => log.error('BetfairClient.placeLayOrder', Object.assign({}, err, this.logData)));
  }

  /**
   * @param {Object} cachedRunner The cached Runner Object
   * @param {number} cachedRunnerPrice The cached Runner's lay/back price
   * @param {('back'|'lay')} orderType The type of operation
   * @description Places an order within a timeout and saves to the cached Runner.
   * @private
   */
  _setTimer(cachedRunner, cachedRunnerPrice, orderType) {
    let operation, timer;

    if (cachedRunner.pendingOrder) return;

    if (orderType === 'lay') {
      operation = this._placeLayOrder;
      timer = LAY_PRICE_CHANGE_TIMER;
    } else {
      operation = this._placeBackOrder;
      timer = BACK_PRICE_CHANGE_TIMER;
    }
    cachedRunner.pendingOrder = setTimeout(operation.bind(this), timer, cachedRunner, cachedRunnerPrice);
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
   * @private
   * @override
   */
  _applyBackLayLogic(cachedRunner) {
    if (cachedRunner.betOpen) {
      this._backLogic(cachedRunner);
    }
    else {
      this._layLogic(cachedRunner);
    }
  }

  /**
   * @param {Object} cachedRunner The cached Runner Object
   * @private
   * @override
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
   * @private
   * @override
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


}

module.exports = MarketStreamStrategy;
