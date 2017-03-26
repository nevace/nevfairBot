const tls = require('tls');
const randomId = require('random-id');
const log = require('../log');

class StreamBase {
  constructor(appKey, session, strategy, username) {
    this.appKey = appKey;
    this.session = session;
    this.strategy = strategy;
    this.username = username;
    this.stream = tls.connect({port: 443, host: 'stream-api-integration.betfair.com'});
    this.stream.on('connect', this._handleConnect.bind(this));
    this.stream.on('error', this._handleErr.bind(this));
    this.stream.on('data', this._handleData.bind(this));
    this.stream.on('end', this._handleSocketEnd.bind(this));
    this.stream.on('close', this._handleSocketClose.bind(this));
    this.data = '';
  }

  _handleConnect(meta = {}) {
    log.debug('connected');
    this._authenticate(meta);
    this._sendData(this.strategyIns.subscriptionConfig);
  }

  _authenticate(meta = {}) {
    this._sendData({
      op: 'authentication',
      appKey: this.appKey,
      session: this.session
    }, meta);
  }

  _sendData(data, meta = {}) {
    data.id = parseInt(randomId(9, '0'));

    const logData = {
      data,
      username: this.username,
      stream: this.constructor.name,
      strategy: this.strategy.strategy
    };

    Object.assign(logData, meta);

    this.stream.write(this._parseReq(data));
    log.info('write', logData);
  }

  _parseReq(obj) {
    return `${JSON.stringify(obj)}\r\n`;
  }

  _handleErr(err, meta = {}) {
    const logData = {
      error: err,
      username: this.username,
      stream: this.constructor.name,
      strategy: this.strategy.strategy
    };

    Object.assign(logData, meta);

    log.error('socket error', logData);
  }

  _handleData(rawData, meta = {}) {
    this.data += rawData.toString();

    if (this.data.includes('\r\n')) {
      let dataArr = this.data.split('\r\n');
      dataArr.pop();

      for (let jsonString of dataArr) {
        const data = JSON.parse(jsonString);
        const logData = {
          data,
          username: this.username,
          stream: this.constructor.name,
          strategy: this.strategy.strategy
        };

        Object.assign(logData, meta);

        this._passToStrategy(data);

        if (data.op === 'connection') {
          log.info('read', logData);
        }

        if (data.statusCode === 'FAILURE') {
          log.error('read', logData);
        }

      }

      this.data = '';
    }
  }

  /**
   * @param {Object} data The data received from Betfair
   * @param {string} data.ct The subscription type
   * @param {string} data.op The type of operation
   * @param {Object[]} data.mc The market changes
   * @param {Object} data.mc.marketDefinition The market definition
   * @param {boolean} data.mc.marketDefinition.inPlay If the Market is in-play
   * @param {string} data.mc.marketDefinition.status The status of the market
   */
  _passToStrategy(data) {
    console.log(data);
  }

  _handleSocketEnd(meta = {}) {
    const logData = {
      username: this.username,
      stream: this.constructor.name,
      strategy: this.strategy.strategy
    };

    Object.assign(logData, meta);
    log.debug('socket ended', logData);
  }

  _handleSocketClose(hasErr, meta = {}) {
    const logData = {
      error: hasErr,
      username: this.username,
      stream: this.constructor.name,
      strategy: this.strategy.strategy
    };

    Object.assign(logData, meta);
    log.info('socket closed', logData);
  }

}

module.exports = StreamBase;
