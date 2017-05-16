const log = require('../../log');
const MarketStrategyBase = require('../MarketStrategyBase');
const BetfairClient = require('../../BetfairClient');
const moment = require('moment');
const DB = require('../../DB');

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
const GREEN_OUT_THRESHOLD = 1.5; //25%
const LAY_PRICE_BOUNDARY1_START = 20;
const LAY_PRICE_BOUNDARY1_END = 29;
const LAY_PRICE_BOUNDARY1_THRESHOLD = 1.2;
const LAY_PRICE_BOUNDARY2_START = 30;
const LAY_PRICE_BOUNDARY2_END = 39;
const LAY_PRICE_BOUNDARY2_THRESHOLD = 1.14;
const LAY_PRICE_BOUNDARY3_START = 40;
const LAY_PRICE_BOUNDARY3_END = 45;
const LAY_PRICE_BOUNDARY3_THRESHOLD = 1.1;
const SECS_FROM_FINISH = 30;

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
    this.raceStartTimerActive = true;
    this.raceNearingEnd = true;
    this._filterRunners();
    this._buildRunnerCache();
  }

  _filterRunners() {
    //sort by bsp and remove 1st - 3rd fav and any with bsp less than 20
    this.market.marketDefinition.runners = this.market.marketDefinition.runners.sort((a, b) => a.bsp - b.bsp);
    this.market.marketDefinition.runners.splice(0, 3);
    for (let i = this.market.marketDefinition.runners.length - 1; i >= 0; i--) {
      if (this.market.marketDefinition.runners[i].bsp < 20 || !this.market.marketDefinition.runners[i].bsp) {
        this.market.marketDefinition.runners.splice(i, 1);
      }
    }
  }

  _getRaceTimeout(timeformData) {
    const query = {
      COURSE: timeformData.race.course.name,
      RACE_TYPE: timeformData.race.raceType.full,
      // JUMPS_FLAG: (timeformData.race.course.courseType === 'JUMP'),
      DISTANCE: timeformData.race.distance
    };
    let db;
    log.info('raceTimeout query', Object.assign({}, this.logData, query));
    return DB.then(res => {
      db = res;
      return db.collection('course_times').find(query).toArray();
    })
      .then(res => {
        if (res.length) {
          const data = res[0];
          const timeout = parseInt(data.AVG_WINNING_TIME, 10) - SECS_FROM_FINISH;
          log.info('found course data!', Object.assign({}, this.logData, {length: res.length, data}));
          log.debug(`stop opening orders in ${timeout} seconds`);
          this.raceNearingEnd = false;
          setTimeout(() => {
            log.debug('stop opening orders!');
            this.raceNearingEnd = true;
          }, timeout * 1000);
          return 'found data';
        } else {
          const update = {
            course: timeformData.race.course,
            raceType: timeformData.race.raceType,
            distance: timeformData.race.distance
          };
          return db.collection('missing_course_times').updateOne(update, update, {upsert: true})
        }
      });
  }

  _buildRunnerCache() {
    let timeformData;
    BetfairClient.getTimeFormData(this.market.id, this.logData)
      .then(data => {
        timeformData = data;
        return this._getRaceTimeout(timeformData);
      })
      .then(res => {
        if (res === 'found data') {
          for (let runner of this.market.marketDefinition.runners) {
            let horse = timeformData.runners.filter(hrs => hrs.selections[0].selectionId == runner.id);
            this.runners[runner.id] = runner;
            this.runners[runner.id].name = horse[0].name;
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
        } else {
          throw new Error('no course data found!');
        }
      })
      .catch(err => log.error('_buildRunnerCache', Object.assign({}, {error: err.toString()}, this.logData)));
  }

  /**
   * @param cachedRunner
   * @param cachedRunnerBackPrice
   * @param order
   * @param backType
   * @private
   */
  _placeBackOrder(cachedRunner, order, cachedRunnerBackPrice, backType) {
    const currentOrder = cachedRunner.orders[order];
    const stake = (backType === 'green') ? ((currentOrder.avp - 1) * currentOrder.s) / (cachedRunnerBackPrice - 1)
      : (currentOrder.avp / cachedRunnerBackPrice) * currentOrder.s;
    const roundedStake = Math.round(stake * 1e2) / 1e2;
    const orderParams = {
      selectionId: cachedRunner.id,
      side: 'BACK',
      size: roundedStake
    };

    currentOrder.closed = true;

    if (this.debug) {
      this.bank -= cachedRunner.lay.stake;
      this.bank += roundedStake;
      log.debug('bank', Object.assign({}, this.logData, {bank: this.bank}));
      return;
    }

    if (backType === 'green') {
      currentOrder.greenOpen = true;
      orderParams.price = cachedRunnerBackPrice;
      BetfairClient.placeOrder(this.market.id, orderParams, this.logData)
        .then(res => {
          if (res.status !== 'SUCCESS') {
            currentOrder.greenOpen = false;
            currentOrder.closed = false;
          }
        })
        .catch(err => {
          currentOrder.greenOpen = false;
          currentOrder.closed = false;
          log.error('BetfairClient.placeBackOrder', Object.assign({}, err, this.logData))
        });
    } else {
      orderParams.price = 1.01;
      cachedRunner.runnerOpen = false;
      //redout with new order
      BetfairClient.placeOrder(this.market.id, orderParams, this.logData)
        .then(res => {
          if (res.status === 'SUCCESS') {
            if (currentOrder.greenOpen) {
              //loop through all unmatched back orders for this runner and cancel
              for (let orderId of Object.keys(cachedRunner.orders)) {
                if (cachedRunner.orders[orderId].side === 'B' && cachedRunner.orders[orderId].sr > 0) {
                  BetfairClient.cancelOrder(this.market.id, orderId, this.logData)
                    .then(() => currentOrder.greenOpen = false)
                    .catch(err => log.error('couldn\t cancel back order!', err));
                }
              }
            }
          } else {
            currentOrder.closed = false;
            cachedRunner.runnerOpen = true;
          }
        })
        .catch(err => {
          currentOrder.closed = false;
          cachedRunner.runnerOpen = true;
          log.error('BetfairClient.placeLayOrder', Object.assign({}, err, this.logData))
        });
    }
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
    cachedRunner.runnerOpen = true;
    console.log('lay size', win, roundedWin);
    if (this.debug) {
      this.bank += win;
      log.debug('bank', Object.assign({}, this.logData, {bank: this.bank}));
      return;
    }

    BetfairClient.placeOrder(this.market.id, orderParams, this.logData)
      .then(res => {
        if (res.status !== 'SUCCESS') {
          cachedRunner.runnerOpen = false;
        }
      })
      .catch(err => {
        cachedRunner.runnerOpen = false;
        log.error('BetfairClient.placeLayOrder', Object.assign({}, err, this.logData))
      });
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

    if (this.raceStartTimerActive) {
      if (moment().diff(this.startTime, 'seconds') < 5) {
        return;
      }
      this.raceStartTimerActive = false;
    }
    if (cachedRunner.runnerOpen) {
      this._backLogic(cachedRunner);
    } else {
      if (this.raceNearingEnd) return;
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
    const runnerOrders = Object.keys(cachedRunner.orders);

    for (let order of runnerOrders) {
      let currentOrder = cachedRunner.orders[order];
      if (currentOrder.side === 'L' && (!currentOrder.closed || currentOrder.greenOpen)) {

        if (cachedRunnerCurBackPrice < cachedRunnerCurLayPrice) {
          if ((cachedRunnerCurLayPrice / currentOrder.avp) <= RED_OUT_THRESHOLD) {
            this._placeBackOrder(cachedRunner, order, cachedRunnerCurLayPrice, 'red');
            console.log('backLogic', 'red', currentOrder.avp, cachedRunnerCurLayPrice);
            // this._setTimer(cachedRunner, cachedRunnerBackPrice, 'back');
            return;
          }

          if ((cachedRunnerCurBackPrice / currentOrder.avp) >= GREEN_OUT_THRESHOLD && !currentOrder.closed) {
            this._placeBackOrder(cachedRunner, order, cachedRunnerCurBackPrice, 'green');
            console.log('backLogic', 'green', currentOrder.avp, cachedRunnerCurBackPrice);
            // this._setTimer(cachedRunner, cachedRunnerBackPrice, 'back');
            return;
          }
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

module.exports = MarketStreamStrategy;
