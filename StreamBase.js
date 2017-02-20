const tls = require('tls');
const randomId = require('random-id');

class StreamBase {
  constructor(appKey, session, strategy) {
    this.appkey = appKey;
    this.session = session;
    this.strategy = strategy;
    this.stream = tls.connect({ port: 443, host: 'stream-api-integration.betfair.com' });
    this.stream.on('error', this._handleErr);
    this.stream.on('data', this._handleData);
    this.stream.on('close', this._handleSocketClose);
    this.stream.on('end', this._handleSocketEnd);
    this.stream.on('connect', this._handleConnect.bind(this));
  }

  _authenticate(appKey, session) {
    const auth = this._buildReq({
      op: 'authentication',
      id: parseInt(randomId(9, '0')),
      appKey,
      session
    })
    this.stream.write(auth);
  }

  _buildReq(obj) {
    return `${JSON.stringify(obj)}\r\n`
  }

  _handleConnect() {
    console.log('connected');
    this._authenticate(this.appkey, this.session);
  }

  _handleErr(err) {
    console.log(err)
  }

  _handleData(data) {
    console.log(data.toString());
  }

  _handleSocketEnd() {
    console.log('socket ended')
  }

  _handleSocketClose(hasErr) {
    console.log('close, err: ' + hasErr)
  }

}

module.exports = StreamBase;
