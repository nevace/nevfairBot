const log = require('./../log');
const event = require('../event');
const moment = require('moment');
const randomId = require('random-id');

class MarketStrategyBase {
  /**
   * @param username
   * @param streamName
   * @param market
   * @param strategyName
   */
  constructor(username, streamName, market, strategyName) {
    this.id = parseInt(randomId(9, '0'));
    this.username = username;
    this.stream = streamName;
    this.strategyName = strategyName;
    this.market = market;
    this.runners = {};
    this.debug = false;
    this.bank = 0;
    event.on(`${this.username}:orderData`, this._handleOrderData.bind(this));
    // this._listenForOrderData();
  }

  // _listenForOrderData() {
  //   const handleOrderData = this._handleOrderData.bind(this);
  //   Object.defineProperty(handleOrderData, 'name', {value: `${handleOrderData}`, writable: false});
  //   event.on(`${this.username}:orderData`,);
  // }

  _handleOrderData(data) {
    //first image
    if (data.ct === 'SUB_IMAGE' || data.ct === 'RESUB_DELTA') {
      log.info('read', Object.assign(data, this.logData));
      return;
    }

    if (data.op === 'ocm' && data.oc && data.oc.length) {
      for (let market of data.oc) {
        if (market.id === this.market.id && market.orc) {
          for (let orderChanges of market.orc) {
            if (orderChanges.uo && orderChanges.uo.length) {
              let runnerOrders = this.runners[orderChanges.id].orders;
              for (let unmatchedOrder of orderChanges.uo) {
                let isClosed = false;
                let greenOpen = false;
                //if runner exists in cache, add flags if not there
                if (runnerOrders[unmatchedOrder.id]) {
                  isClosed = runnerOrders[unmatchedOrder.id].closed || false;
                  greenOpen = runnerOrders[unmatchedOrder.id].greenOpen || false;
                }
                //overwrite runner with new data
                runnerOrders[unmatchedOrder.id] = unmatchedOrder;
                //remove cancelled orders
                if (runnerOrders[unmatchedOrder.id].sc > 0) {
                  delete runnerOrders[unmatchedOrder.id];
                } else {
                  //update green status and closed status if green bet has been matched
                  const allBackOrdersGreen = orderChanges.uo.filter(uO => uO.side === 'B' && uO.sr === 0).length;
                  if (allBackOrdersGreen) {
                    runnerOrders[unmatchedOrder.id].greenOpen = false;
                    runnerOrders[unmatchedOrder.id].closed = true;
                    this.runners[orderChanges.id].runnerOpen = false;
                  } else {
                    runnerOrders[unmatchedOrder.id].closed = isClosed;
                    runnerOrders[unmatchedOrder.id].greenOpen = greenOpen;
                  }
                }
              }
            }
            log.debug('runnerCache change', Object.assign({}, this.logData, this.runners[orderChanges.id]));
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

    cachedRunner.ladder[type].previous = cachedRunner.ladder[type].current;
    cachedRunner.ladder[type].current = {
      price: ladderData[0][1],
      size: ladderData[0][2]
    };
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

  removeListener() {
    event.removeListener(`${this.username}:orderData`, this._handleOrderData);
  }

  /**
   * @param data
   */
  analyse(data) {
    //first image
    if (data.ct === 'SUB_IMAGE' || data.ct === 'RESUB_DELTA') {
      this.startTime = moment(data.pt);
      log.info('read', Object.assign(data, this.logData));
      return;
    }

    //changes - bot logic
    if (data.op === 'mcm' && data.mc && data.mc.length) {
      const runnerChanges = data.mc[0].rc;

      for (let runner of runnerChanges) {
        let cachedRunner = this.runners[runner.id];

        if (!cachedRunner) continue;

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
