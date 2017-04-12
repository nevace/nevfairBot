const axios = require('axios');
const querystring = require('querystring');
const fs = require('mz/fs');
const https = require('https');
const DB = require('./DB');
const moment = require('moment');
const BETFAIR_LOGIN = 'https://identitysso.betfair.com/api/certlogin/';
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
          this.config.headers['Content-Type'] = 'application/json';
          this.config.headers['X-Authentication'] = session.token;
          return session;
        }
        return this._doLogin(username, password);
      });
  }

  placeOrder(marketId, orderParams) {
    const {selectionId, side, size, price} = orderParams;
    return axios.post(
      `${BETFAIR_API}placeOrders/`,
      {
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
      },
      this.config
    )
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
