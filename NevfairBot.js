const BetfairClient = require('./BetfairClient.js')

class NevfairBot {
  constructor(username, password, appKey) {
    this.session;
    this.init(username, password, appKey);
  }

  init(username, password, appKey) {
    BetfairClient.login(username, password, appKey)
      .then(session => {
        console.log(session)
        this.session = session
      })
      .catch(err => console.log(err))
  }
}

module.exports = NevfairBot;
