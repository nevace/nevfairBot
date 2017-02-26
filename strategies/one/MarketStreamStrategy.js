const log = require('../../log');
const merge = require('deepmerge');

class MarketStreamStrategy {
  constructor(username, stream, market) {
    this.username = username;
    this.stream = stream;
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
      for (let runner of data.mc[0].rc) {
        //if there are no open bets on this runner
        if (!this.runners[runner.id].betOpen) {
          //and the SP is >= 20
          if (this.runners[runner.id].bsp >= 20) {
            //and the back price is >= 10% above SP but <=30
            if (runner.bdatb && runner.bdatb.length && runner.bdatb[0][1] <= 30 && ((runner.bdatb[0][1] / this.runners[runner.id].bsp) >= 1.1)) {
              //place lay bet
              this.runners[runner.id].betOpen = true;
              // this.runners[runner.id].lay = 
              console.log('place bet')
              log.debug('read', { data: runner, username: this.username, stream: this.stream, strategy: 'one' });
            }
            //the SP is < 20
          } else {
            //and the back price is >= 20 but <= 30
            if (runner.bdatb && runner.bdatb.length && runner.bdatb[0][1] >= 20 && runner.bdatb[0][1] <= 30) {
              //place lay bet
              console.log('place bet')
              this.runners[runner.id].betOpen = true;
              log.debug('read', { data: runner, username: this.username, stream: this.stream, strategy: 'one' });
            }
          }
        } else {

        }
      }
      log.debug('read', { data: this.runners, username: this.username, stream: this.stream, strategy: 'one' });
    }
  }

}

module.exports = MarketStreamStrategy;
