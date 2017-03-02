const log = require('../../log');
const merge = require('deepmerge');

class MarketStreamStrategy {
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
    }
    this.runners = {};
    this.debug = true;
    this.stake = 250;
    this.bank = 0;

    for (let runner of market.marketDefinition.runners) {
      this.runners[runner.id] = runner;
    }

  }

  analyse(data) {
    //first image
    if (data.ct === 'SUB_IMAGE' || data.ct === 'RESUB_DELTA') {
      log.info('read', { data, username: this.username, stream: this.stream, strategy: 'one' });
      return;
    }

    //changes - bot logic
    if (data.op === 'mcm' && data.mc && data.mc.length) {
      const runnerChanges = data.mc[0].rc;

      for (let runner of runnerChanges) {

        //if there are NO open bets on this runner
        if (!this.runners[runner.id].betOpen) {
          //and the SP is >= 20
          if (this.runners[runner.id].bsp >= 20) {
            //and the lay price is >= 10% above SP but <=30
            if (runner.bdatl && runner.bdatl.length && runner.bdatl[0][1] <= 30 && ((runner.bdatl[0][1] / this.runners[runner.id].bsp) >= 1.1)) {
              //place lay bet
              let win = this.stake / (runner.bdatl[0][1] - 1);
              this.runners[runner.id].betOpen = true;
              this.runners[runner.id].lay = { stake: win, price: runner.bdatl[0][1] }

              log.debug('place lay bet', {
                win,
                data: runner,
                username: this.username,
                stream: this.stream,
                strategy: 'one'
              });
              if (this.debug) {
                this.bank += win;
              }
            }
            //the SP is < 20
          } else {
            //and the lay price is >= 20 but <= 30
            if (runner.bdatl && runner.bdatl.length && runner.bdatl[0][1] >= 20 && runner.bdatl[0][1] <= 30) {
              //place lay bet
              let win = this.stake / (runner.bdatl[0][1] - 1);
              this.runners[runner.id].betOpen = true;
              this.runners[runner.id].lay = { stake: win, price: runner.bdatl[0][1] }

              log.debug('place lay bet', {
                win,
                data: runner,
                username: this.username,
                stream: this.stream,
                strategy: 'one'
              });

              if (this.debug) {
                this.bank += win;
              }
            }
          }
          //if there ARE open bets on this runner
        } else {
          //and the SP is >= 20
          if (runner.bdatb && runner.bdatb.length && runner.bdatb[0][1] <= 18) {
            //place back bet
            this.runners[runner.id].betOpen = false;
            this.runners[runner.id].back = {
              stake: (this.runners[runner.id].lay.price / runner.bdatl[0][1]) * this.runners[runner.id].lay.stake,
              price: runner.bdatl[0][1]
            }

            let redOutLoss = (this.runners[runner.id].back.stake * (this.runners[runner.id].back.price) - 1)) - this.stake;

          log.debug('place back bet', {
            redOutLoss,
            data: runner,
            username: this.username,
            stream: this.stream,
            strategy: 'one'
          });

          if (this.debug) {
            this.bank += redOutLoss;
          }
        }
      }

    }
    //log.debug('runner changes', { data: this.runners, username: this.username, stream: this.stream, strategy: 'one' });
  }
}

calculatePL() {
  log.debug('PL', { data: this.bank, username: this.username, stream: this.stream, strategy: 'one' });
}

}

module.exports = MarketStreamStrategy;
