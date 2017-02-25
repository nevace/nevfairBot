const tls = require('tls');
const randomId = require('random-id');
const log = require('../log');

class StreamBase {
  constructor(appKey, session, strategy, username) {
    this.appKey = appKey;
    this.session = session;
    this.strategy = strategy;
    this.username = username;
    this.stream = tls.connect({ port: 443, host: 'stream-api-integration.betfair.com' });
    this.stream.on('connect', this._handleConnect.bind(this));
    this.stream.on('error', this._handleErr.bind(this));
    this.stream.on('data', this._handleData.bind(this));
    this.stream.on('end', this._handleSocketEnd.bind(this));
    this.stream.on('close', this._handleSocketClose.bind(this));
    this.data = '';
  }

  _authenticate() {
    this._sendData({
      op: 'authentication',
      appKey: this.appkey,
      session: this.session
    });
  }

  _sendData(data) {
    data.id = parseInt(randomId(9, '0'));
    this.stream.write(this._parseReq(data));
    log.info('write', { data, username: this.username, stream: this.constructor.name, strategy: this.strategy.strategy })
  }

  _parseReq(obj) {
    return `${JSON.stringify(obj)}\r\n`
  }

  _subscribe() {}

  _handleConnect() {
    log.debug('connected');
    this._authenticate();
    this._subscribe();
  }

  _handleErr(err) {
    log.error('socket error', { error: err, username: this.username, stream: this.constructor.name, strategy: this.strategy.strategy })
  }

  _handleData(rawData) {
    const stringData = rawData.toString()
    this.data += stringData;

    if (this.data.includes('\r\n')) {
      let dataArr = this.data.split('\r\n');
      dataArr.pop();

      for (let jsonString of dataArr) {
        const data = JSON.parse(jsonString);

        this._passToStrategy(data);

        if (data.op === 'connection') {
          log.info('read', { data, username: this.username, stream: this.constructor.name, strategy: this.strategy.strategy });
        }

        if (data.statusCode === 'FAILURE') {
          log.error('read', { data, username: this.username, stream: this.constructor.name, strategy: this.strategy.strategy });
        }

      }

      this.data = '';
    }
  }

  _passToStrategy(data) {

  }

  _handleSocketEnd() {
    log.debug('socket ended', { username: this.username, stream: this.constructor.name, strategy: this.strategy.strategy })
  }

  _handleSocketClose(hasErr) {
    log.info('socket closed', { error: hasErr, username: this.username, stream: this.constructor.name, strategy: this.strategy.strategy })
  }

}

module.exports = StreamBase;
