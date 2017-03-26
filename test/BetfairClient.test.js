const BetfairClient = require('../BetfairClient');

describe('BetFairClient', () => {

  describe('constructor', () => {

    it('should have correct headers', () => {
      expect(BetfairClient.config.headers).to.eql({
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      });
    });

    it('should have correct certs', () => {
      expect(BetfairClient.config.httpsAgent.options.key).to.not.be.an('undefined');
      expect(BetfairClient.config.httpsAgent.options.cert).to.not.be.an('undefined');
    });

  });

  describe('login', () => {

    it('should add appKey to headers', () => {
      const credentials = {username: 'test', password: 'test', appKey: 'test'};
      BetfairClient.login(credentials);
      expect(BetfairClient.config.headers['X-Application']).to.eql(credentials.appKey);
    });

    it('should eventually return session object', () => {
      // expect(BetfairClient.config.httpsAgent.options.key).to.not.be.an('undefined');
      // expect(BetfairClient.config.httpsAgent.options.cert).to.not.be.an('undefined');
    });

  });

});
