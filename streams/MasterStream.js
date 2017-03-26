const StreamBase = require('./StreamBase');

/**
 * @extends StreamBase
 */
class MasterStream extends StreamBase {
  constructor(appKey, session, strategy, username) {
    super(appKey, session, strategy, username);
    this.strategyIns = new (require(`../strategies/${this.strategy.strategy}/MasterStreamStrategy`))(username, this.constructor.name);
    this.streams = {};
    this.StreamFactory = require('./StreamFactory');
  }

  _passToStrategy(data) {
    const marketChanges = this.strategyIns.analyse(data);

    if (marketChanges) {
      for (let market of marketChanges) {
        if (market.inPlay) {
          //this will only exist if a market is suspended between turning in play
          //so ignore, don't create new stream
          if (this.streams[market.market.id]) return;
          this.streams[market.market.id] = {};
          this.streams[market.market.id].market = this.StreamFactory.createStream(this.appKey, this.session, 'market', this.strategy, this.username, market.market);
          // log.debug('masterStream cache', { data: this.streams, username: this.username, stream: this.constructor.name, strategy: this.strategy.strategy });
        } else {
          if (this.streams[market.market.id]) {
            //if debug, calculate PL
            // if (this.streams[market.market.id].market.debug) {
            //   this.streams[market.market.id].market.calculatePL();
            // }
            this.streams[market.market.id].market.stream.end();
            this.streams[market.market.id].market = null;
            delete this.streams[market.market.id];
            // log.debug('masterStream cache', { data: this.streams, username: this.username, stream: this.constructor.name, strategy: this.strategy.strategy });
          }
        }
      }
    }
  }

}

module.exports = MasterStream;
