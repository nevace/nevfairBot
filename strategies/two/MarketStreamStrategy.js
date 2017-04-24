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
const LAY_PRICE_MAX = 50;
const PRICE_CHANGED_THRESHOLD = 1.1;
const BACK_PRICE_CHANGE_TIMER = 1000;
const LAY_PRICE_CHANGE_TIMER = 1;

const RED_OUT_THRESHOLD = 0.5;
const LAY_PRICE_BOUNDARY1_START = 20;
const LAY_PRICE_BOUNDARY1_END = 29;
const LAY_PRICE_BOUNDARY1_THRESHOLD = 1.2;
const LAY_PRICE_BOUNDARY2_START = 30;
const LAY_PRICE_BOUNDARY2_END = 39;
const LAY_PRICE_BOUNDARY2_THRESHOLD = 1.14;
const LAY_PRICE_BOUNDARY3_START = 40;
const LAY_PRICE_BOUNDARY3_END = 45;
const LAY_PRICE_BOUNDARY3_THRESHOLD = 1.1;

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

    //sort by bsp and remove 1st - 3rd fav and any with bsp less than 20
    this.market.marketDefinition.runners = this.market.marketDefinition.runners.sort((a, b) => a.bsp - b.bsp);
    this.market.marketDefinition.runners.splice(0, 3);

    for (let i = this.market.marketDefinition.runners.length - 1; i >= 0; i--) {
      if (this.market.marketDefinition.runners[i].bsp < 20 || !this.market.marketDefinition.runners[i].bsp) {
        this.market.marketDefinition.runners.splice(i, 1);
      }
    }
    console.log('runners', this.market.marketDefinition.runners);
    //build runner cache
    for (let runner of this.market.marketDefinition.runners) {
      this.runners[runner.id] = runner;
      this.runners[runner.id].ladder = {
        lay: {
          previous: {
            price: null,
            size: null
          },
          current: {
            price: null,
            size: null
          }
        },
        back: {
          previous: {
            price: null,
            size: null
          },
          current: {
            price: null,
            size: null
          }
        }
      };
      this.runners[runner.id].orders = {};
    }


  }

  /**
   * @param cachedRunner
   * @param cachedRunnerBackPrice
   * @private
   */
  _placeBackOrder(cachedRunner, order, cachedRunnerBackPrice) {
    const redOutLoss = (cachedRunner.orders[order].avp / cachedRunnerBackPrice) * cachedRunner.orders[order].s;
    const roundedLoss = Math.round(redOutLoss * 1e2) / 1e2;
    console.log('back size', redOutLoss, roundedLoss);
    cachedRunner.orders[order].redout = true;
    const orderParams = {
      selectionId: cachedRunner.id,
      side: 'BACK',
      size: roundedLoss,
      price: 1.01
    };

    if (this.debug) {
      this.bank -= cachedRunner.lay.stake;
      this.bank += roundedLoss;
      log.debug('bank', Object.assign({}, this.logData, {bank: this.bank}));
      return;
    }

    BetfairClient.placeOrder(this.market.id, orderParams, this.logData)
      .then(res => {
        if (res.status === 'SUCCESS') {
          cachedRunner.betOpen = false;
        } else {
          cachedRunner.orders[order].redout = false;
          // cachedRunner.pendingOrder = null;
        }
      })
      .catch(err => log.error('BetfairClient.placeBackOrder', Object.assign({}, err, this.logData)));

  }


  /**
   * @param cachedRunner
   * @param cachedRunnerLayPrice
   * @private
   */
  _placeLayOrder(cachedRunner, cachedRunnerLayPrice) {
    const win = (this.stake / (cachedRunnerLayPrice - 1));
    const roundedWin = Math.round(win * 1e2) / 1e2;
    const orderParams = {
      selectionId: cachedRunner.id,
      side: 'LAY',
      size: roundedWin,
      price: cachedRunnerLayPrice
    };
    console.log('lay size', win, roundedWin);
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
    const cachedRunnerCurLayPrice = cachedRunner.ladder.lay.current.price;
    const cachedRunnerCurBackPrice = cachedRunner.ladder.back.current.price;
    const averagePriceLayed = cachedRunner;

    for (let order of Object.keys(cachedRunner.orders)) {

      if (cachedRunner.orders[order].side === 'L' && !cachedRunner.orders[order].redout) {

        if ((cachedRunnerCurLayPrice / cachedRunner.orders[order].avp) <= RED_OUT_THRESHOLD &&
          cachedRunnerCurBackPrice < cachedRunnerCurLayPrice) {
          this._placeBackOrder(cachedRunner, order, cachedRunnerCurLayPrice);
          // this._setTimer(cachedRunner, cachedRunnerBackPrice, 'back');
          return;
        }

      }
      // this._clearTimer(cachedRunner);
    }
  }

  /**
   * @param {Object} cachedRunner The cached Runner Object
   * @private
   * @override
   */
  _layLogic(cachedRunner) {
    const cachedRunnerPrevLayPrice = cachedRunner.ladder.lay.previous.price;
    const cachedRunnerCurLayPrice = cachedRunner.ladder.lay.current.price;

    if (cachedRunnerCurLayPrice <= LAY_PRICE_MAX && cachedRunnerCurLayPrice >= LAY_PRICE_MIN) {
      //Lay when they drift 20% between 20's and 29
      if (cachedRunnerPrevLayPrice >= LAY_PRICE_BOUNDARY1_START &&
        cachedRunnerPrevLayPrice <= LAY_PRICE_BOUNDARY1_END &&
        (cachedRunnerCurLayPrice / cachedRunnerPrevLayPrice) >= LAY_PRICE_BOUNDARY1_THRESHOLD) {
        console.log('layLogic', cachedRunnerPrevLayPrice, cachedRunnerCurLayPrice);

        this._placeLayOrder(cachedRunner, cachedRunnerCurLayPrice);
        // this._setTimer(cachedRunner, cachedRunnerCurLayPrice, 'lay');
        return;
      }
      //Lay when they drift 14% between 30's and 39
      if (cachedRunnerPrevLayPrice >= LAY_PRICE_BOUNDARY2_START &&
        cachedRunnerPrevLayPrice <= LAY_PRICE_BOUNDARY2_END &&
        (cachedRunnerCurLayPrice / cachedRunnerPrevLayPrice) >= LAY_PRICE_BOUNDARY2_THRESHOLD) {
        console.log('layLogic', cachedRunnerPrevLayPrice, cachedRunnerCurLayPrice);

        this._placeLayOrder(cachedRunner, cachedRunnerCurLayPrice);
        // this._setTimer(cachedRunner, cachedRunnerCurLayPrice, 'lay');
        return;
      }
      //Lay when they drift 10% between 40 - 45's
      if (cachedRunnerPrevLayPrice >= LAY_PRICE_BOUNDARY3_START &&
        cachedRunnerPrevLayPrice <= LAY_PRICE_BOUNDARY3_END &&
        (cachedRunnerCurLayPrice / cachedRunnerPrevLayPrice) >= LAY_PRICE_BOUNDARY3_THRESHOLD) {
        console.log('layLogic', cachedRunnerPrevLayPrice, cachedRunnerCurLayPrice);

        this._placeLayOrder(cachedRunner, cachedRunnerCurLayPrice);
        // this._setTimer(cachedRunner, cachedRunnerCurLayPrice, 'lay');
        //return;
      }
    }
    //if runner falls out of range of criteria, clear timer for placing order, if set.
    // this._clearTimer(cachedRunner);
  }


}

module
  .exports = MarketStreamStrategy;
