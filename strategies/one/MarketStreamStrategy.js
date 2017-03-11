const log = require('../../log');

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
    };
    this.runners = {};
    this.debug = true;
    this.stake = 250;
    this.bank = 0;

    for (let runner of market.marketDefinition.runners) {
      this.runners[runner.id] = runner;
      this.runners[runner.id].ladder = {
        lay: [{price: null, size: null}],
        back: [{price: null, size: null}]
      };
    }

  }

  _updateCache(runner, cachedRunner, type) {
    const ladderData = (type === 'lay') ? runner.bdatl : runner.bdatb;
    cachedRunner.ladder[type][0] = {
      price: ladderData[0][1],
      size: ladderData[0][2]
    };

    // log.debug('update cache', {
    //   cachedRunner,
    //   username: this.username,
    //   stream: this.stream,
    //   strategy: 'one'
    // });
  }

  _backLogic(cachedRunner) {
    const layPrice = cachedRunner.ladder.lay[0].price;
    const backPrice = cachedRunner.ladder.back[0].price;

    //if SP is >= 20
    if (layPrice <= 18 && backPrice < layPrice) {
      //place back bet
      cachedRunner.betOpen = false;
      cachedRunner.back = {
        stake: (cachedRunner.lay.price / backPrice) * cachedRunner.lay.stake,
        price: backPrice
      };

      let redOutLoss = (cachedRunner.back.stake * (cachedRunner.back.price - 1)) - this.stake;

      log.debug('place back bet', {
        redOutLoss,
        cachedRunner,
        username: this.username,
        stream: this.stream,
        marketId: this.market.id,
        strategy: 'one'
      });

      if (this.debug) {
        this.bank -= cachedRunner.lay.stake;
        this.bank += redOutLoss;

        log.debug('bank', {
          bank: this.bank,
          username: this.username,
          stream: this.stream,
          marketId: this.market.id,
          strategy: 'one'
        });
      }
    }

  }

  _layLogic(cachedRunner) {
    const layPrice = cachedRunner.ladder.lay[0].price;
    //and the SP is >= 20
    if (cachedRunner.bsp >= 20) {
      //and the lay price is >= 10% above SP but <=30
      if (layPrice <= 30 && ((layPrice / cachedRunner.bsp) >= 1.1)) {
        //place lay bet
        let win = this.stake / (layPrice - 1);
        cachedRunner.betOpen = true;
        cachedRunner.lay = {stake: win, price: layPrice};

        log.debug('place lay bet', {
          win,
          cachedRunner,
          username: this.username,
          stream: this.stream,
          marketId: this.market.id,
          strategy: 'one'
        });
        if (this.debug) {
          this.bank += win;

          log.debug('bank', {
            bank: this.bank,
            username: this.username,
            stream: this.stream,
            marketId: this.market.id,
            strategy: 'one'
          });
        }
      }
      //the SP is < 20
    } else {
      //and the lay price is >= 20 but <= 30
      if (layPrice >= 20 && layPrice <= 30) {
        //place lay bet
        let win = this.stake / (layPrice - 1);
        cachedRunner.betOpen = true;
        cachedRunner.lay = {stake: win, price: layPrice};

        log.debug('place lay bet', {
          win,
          cachedRunner,
          username: this.username,
          stream: this.stream,
          marketId: this.market.id,
          strategy: 'one'
        });

        if (this.debug) {
          this.bank += win;

          log.debug('bank', {
            bank: this.bank,
            username: this.username,
            stream: this.stream,
            marketId: this.market.id,
            strategy: 'one'
          });
        }
      }
    }
  }

  analyse(data) {
    //first image
    if (data.ct === 'SUB_IMAGE' || data.ct === 'RESUB_DELTA') {
      log.info('read', {
        data,
        username: this.username,
        stream: this.stream,
        marketId: this.market.id,
        strategy: 'one'
      });
      return;
    }

    //changes - bot logic
    if (data.op === 'mcm' && data.mc && data.mc.length) {
      const runnerChanges = data.mc[0].rc;

      for (let runner of runnerChanges) {
        let cachedRunner = this.runners[runner.id];
        // let laySize = cachedRunner.ladder.lay[0].size;
        // let backSize = cachedRunner.ladder.back[0].size;

        // update ladder lay cache if changed
        if (runner.bdatl && runner.bdatl.length) {
          this._updateCache(runner, cachedRunner, 'lay');
        }

        // update ladder back cache if changed
        if (runner.bdatb && runner.bdatb.length) {
          this._updateCache(runner, cachedRunner, 'back');
        }

        if (cachedRunner.betOpen) {
          this._backLogic(cachedRunner);
        } else {
          this._layLogic(cachedRunner);
        }
      }
      //log.debug('runner changes', { data: this.runners, username: this.username, stream: this.stream, strategy: 'one' });
    }
  }

}

module.exports = MarketStreamStrategy;
