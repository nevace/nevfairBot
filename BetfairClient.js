const axios = require('axios');
const querystring = require('querystring');
const fs = require('mz/fs');
const https = require('https');
const DB = require('./DB');
const moment = require('moment');
const clone = require('clone');
const log = require('./log');
const BETFAIR_LOGIN = 'https://identitysso.betfair.com/api/certlogin/';
const BETFAIR_KEEPALIVE = 'https://identitysso.betfair.com/api/keepAlive';
const BETFAIR_API = 'https://api.betfair.com/exchange/betting/rest/v1.0/';

class BetFairClient {
  constructor() {
    this.config = {
      headers: {
        'Accept': 'application/json'
      },
      httpsAgent: new https.Agent({
        cert: fs.readFileSync('./client-2048.crt'),
        key: fs.readFileSync('./client-2048.key')
      })
    };
  }


  login(credentials) {
    const {username, password, appKey} = credentials;
    this.config.headers['X-Application'] = appKey;
    this.config.headers['Content-Type'] = 'application/x-www-form-urlencoded';

    return this._checkIfCurrentSession(username)
      .then(session => {
        if (session) {
          const lastSessionTimeDiff = moment().diff(session.start, 'hours', true);
          this.config.headers['Content-Type'] = 'application/json';
          this.config.headers['X-Authentication'] = session.token;
          this._keepAlive(lastSessionTimeDiff, username);
          return session;
        }
        return this._doLogin(username, password);
      });
  }

  placeOrder(marketId, orderParams, logData) {

    if (orderParams.size < 2) {
      return this._placeOrderMin(marketId, orderParams, logData);
    }

    return this._doPlaceOrder(marketId, orderParams, logData);
  }

  cancelOrder(marketId, cancelOrderParams, logData) {
    const {sizeReduction, betId} = cancelOrderParams;
    const params = {marketId, instructions: [{betId, sizeReduction}]};

    if (!betId) throw new Error('betId is null');

    return axios.post(`${BETFAIR_API}cancelOrders/`, params, this.config)
      .then(res => this._handleOrderRes(false, res, logData, `cancel order`))
      .catch(err => this._handleOrderRes(true, err, logData, `cancel order`));
  }

  replaceOrder(marketId, replaceOrderParams, logData) {
    const {newPrice, betId} = replaceOrderParams;
    const params = {marketId, instructions: [{betId, newPrice}]};

    if (!betId) throw new Error('betId is null');

    return axios.post(`${BETFAIR_API}replaceOrders/`, params, this.config)
      .then(res => this._handleOrderRes(false, res, logData, `replace order`))
      .catch(err => this._handleOrderRes(true, err, logData, `replace order`));
  }

  _placeOrderMin(marketId, orderParams, logData) {
    const minOrderParams = clone(orderParams);
    const {price, side} = orderParams;
    let betId;
    minOrderParams.size += 2;
    minOrderParams.price = (side === 'BACK') ? 1000 : 1.01;
    console.log('minOrderPArams', minOrderParams);
    return this._doPlaceOrder(marketId, minOrderParams, logData)
      .then(res => {
        betId = res.instructionReports[0].betId;
        return this.cancelOrder(marketId, {sizeReduction: 2, betId}, logData);
      })
      .then(res => this.replaceOrder(marketId, {newPrice: price, betId}, logData))
      .catch(err => this._handleOrderRes(true, err, logData, `place ${side.toLowerCase()} order:_placeOrderMin`));
  }

  /**
   * @param {Boolean} err The error response
   * @param {Object} res The response Object
   * @param {Object} logData Context specific log data to merge with responses
   * @param {String} logMessage The message to show in the logs
   * @description
   * @private
   */
  _handleOrderRes(err, res, logData, logMessage) {
    if (err) {
      let error = (res.response) ? res.response.data : res.data || res.message || res;
      error = (typeof error === 'string') ? {error} : error;
      log.error(logMessage, Object.assign({}, logData, error));
      return error;
    }
    if (res.data.status === 'FAILURE') {
      // log.error(logMessage, Object.assign(logData, res.data));
      throw res;
    }
    log.info(logMessage, Object.assign({}, logData, res.data));
    return res.data;
  }

  _keepAlive(lastSessionTimeDiff, username) {
    let i = 0;
    let interval = (lastSessionTimeDiff) ? 3.5 - lastSessionTimeDiff : 3.5;

    setInterval(() => {
      if (interval !== 3.5 && i === 1) {
        interval = 3.5
      }
      if (i < 1) {
        i++;
      }
      axios.post(BETFAIR_KEEPALIVE, {}, this.config)
        .then(res => log.debug('keepalive', {username}))
        .catch(err => log.error('keepalive error', err.data || err.message))
    }, interval * 60 * 60 * 1000);
  }

  _doPlaceOrder(marketId, orderParams, logData) {
    const {selectionId, side, size, price} = orderParams;
    const params = {
      marketId,
      instructions: [{
        selectionId,
        side,
        orderType: 'LIMIT',
        limitOrder: {
          size,
          price,
          persistenceType: 'PERSIST'
        }
      }]
    };

    return axios.post(`${BETFAIR_API}placeOrders/`, params, this.config)
      .then(res => this._handleOrderRes(false, res, logData, `place ${side.toLowerCase()} order:_doPlaceOrder`))
      .catch(err => this._handleOrderRes(true, err, logData, `place ${side.toLowerCase()} order:_doPlaceOrder`));
  }

  _doLogin(username, password) {
    let session;
    return axios.post(BETFAIR_LOGIN, querystring.stringify({username, password}), this.config)
      .then(res => {
        session = {token: res.data.sessionToken, start: new Date()};
        return DB;
      })
      .then(db => db.collection('users').findOneAndUpdate({username}, {$set: {session}}))
      .then(() => {
        this.config.headers['Content-Type'] = 'application/json';
        this.config.headers['X-Authentication'] = session.token;
        this._keepAlive(null, username);
        return session
      });
  }

  _checkIfCurrentSession(username) {
    return DB
      .then(db => db.collection('users').findOne({username}))
      .then(user => {
        if (!user.session) return;
        const lastSessionTimeDiff = moment().diff(user.session.start, 'hours', true);
        const maxHours = 3.5;

        if (lastSessionTimeDiff > maxHours) return;

        return user.session;
      });
  }
}

module.exports = new BetFairClient();
