const BetfairClient = require('./BetfairClient.js')

class NevfairBot {
  constructor(username, password) {
    this.session;
    this.init(username, password);
  }

  init(username, password) {
    BetfairClient.login(username, password)
      .then(session => {
        console.log(session)
        this.session = session
      })
      .catch(err => console.log(err))
  }
}

module.exports = NevfairBot;
