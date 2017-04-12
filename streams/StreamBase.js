const tls = require('tls');
const randomId = require('random-id');
const log = require('../log');
const EventEmitter = require('events').EventEmitter;

class StreamBase extends EventEmitter {
  constructor(appKey, session, strategy, username) {
    super();
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
    const subscriptionConfig = (this.strategyIns) ? this.strategyIns.subscriptionConfig : this.subscriptionConfig;
    log.debug('connected');
    this._authenticate(meta);
    this._sendData(subscriptionConfig);
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
    this.stream.write(this._parseReq(data));
    log.info('write', this._logData({data}, meta));
  }

  _parseReq(obj) {
    return `${JSON.stringify(obj)}\r\n`;
  }

  _handleErr(err, meta = {}) {
    log.error('socket error', this._logData({error: err}, meta));
  }

  _handleData(rawData, meta = {}) {
    this.data += rawData.toString();

    if (this.data.includes('\r\n')) {
      let dataArr = this.data.split('\r\n');
      dataArr.pop();

      for (let jsonString of dataArr) {
        const data = JSON.parse(jsonString);

        this._processData(data);

        if (data.op === 'connection') {
          log.info('read', this._logData({data}, meta));
        }

        if (data.statusCode === 'FAILURE') {
          log.error('read', this._logData({data}, meta));
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
   * @abstract
   */
  _processData(data) {
    console.log(data);
  }

  _handleSocketEnd(meta = {}) {
    log.debug('socket ended', this._logData(null, meta));
  }

  _handleSocketClose(hasErr, meta = {}) {
    log.info('socket closed', this._logData({error: hasErr}, meta));
  }

  _logData(dataToMerge = {}, meta) {
    const logData = {
      username: this.username,
      stream: this.constructor.name,
    };

    if (this.strategy) {
      logData.strategy = this.strategy.strategy;
    }

    Object.assign(logData, dataToMerge, meta);
    return logData;
  }

}

module.exports = StreamBase;
