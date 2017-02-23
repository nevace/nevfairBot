const tls = require('tls');
const randomId = require('random-id');
const DB = require('./DB');

class StreamBase {
  constructor(appKey, session, strategy, username) {
    this.appkey = appKey;
    this.session = session;
    this.strategy = strategy;
    this.username = username;
    this.stream = tls.connect({ port: 443, host: 'stream-api-integration.betfair.com' });
    this.stream.on('error', this._handleErr);
    this.stream.on('data', this._handleData);
    this.stream.on('close', this._handleSocketClose);
    this.stream.on('end', this._handleSocketEnd);
    this.stream.on('connect', this._handleConnect.bind(this));
  }

  _authenticate(appKey, session) {
    this._sendData({
      op: 'authentication',
      appKey,
      session
    });
  }

  _sendData(data) {
    data.id = parseInt(randomId(9, '0'));
    console.log('write', data)
    this.stream.write(this._parseReq(data));

    DB
      .then(db => db.collection('data').insertOne({ data, username: this.username, created: new Date() }))
      .catch((err) => console.log(err))
  }

  _parseReq(obj) {
    return `${JSON.stringify(obj)}\r\n`
  }

  _subscribe() {}

  _handleConnect() {
    console.log('connected');
    this._authenticate(this.appkey, this.session);
    this._subscribe();
  }

  _handleErr(err) {
    console.log(err)
  }

  _handleData(rawData) {
    console.log(rawData.toString())
      // const data = JSON.parse(rawData);

    // if (data.statusCode !== 'SUCCESS') {
    //   console.log('read', data)
    // }

    // if (data.statusCode !== 'SUCCESS' || data.op === 'connection') {
    //   DB
    //     .then(db => db.collection('data').insertOne({ data, username: this.username, created: new Date() }))
    //     .catch((err) => console.log(err))
    // }
  }

  _handleSocketEnd() {
    console.log('socket ended')
  }

  _handleSocketClose(hasErr) {
    console.log('close, err: ' + hasErr)
  }

}

module.exports = StreamBase;
