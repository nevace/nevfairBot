const axios = require('axios');
const querystring = require('querystring');
const fs = require('mz/fs');
const https = require('https');
const DB = require('./DB');
const moment = require('moment');

class BetFairClient {
  constructor() {
    this.config = {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }

    Promise.all([fs.readFile('./client-2048.crt'), fs.readFile('./client-2048.key')])
      .then(cert => {
        this.config.httpsAgent = new https.Agent({
          cert: cert[0].toString(),
          key: cert[1].toString()
        });
      })
      .catch(err => console.log(err))
  }

  login(username, password, appKey) {
    this.config.headers['X-Application'] = appKey;
    return this._checkIfCurrentSession(username)
      .then(session => {
        if (session) return session;
        return this._doLogin(username, password)
      })
  }

  _doLogin(username, password) {
    let session;
    return axios.post(
        'https://identitysso.betfair.com/api/certlogin/',
        querystring.stringify({ username, password }),
        this.config
      )
      .then(res => {
        session = { token: res.data.sessionToken, start: new Date() }
        return DB.db
      })
      .then(db => db.collection('users').findOneAndUpdate({ username }, { $set: { session } }))
      .then(() => session)
  }

  _checkIfCurrentSession(username) {
    return DB.db
      .then(db => db.collection('users').findOne({ username }))
      .then(user => {
        if (!user.session) return;
        const lastSessionTimeDiff = moment().diff(user.session.start, 'hours', true);

        if (lastSessionTimeDiff > 3.5) return;

        return user.session;
      })
  }
}

module.exports = new BetFairClient();
