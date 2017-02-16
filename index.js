// const tls = require('tls');
const NevfairBot = require('./NevfairBot');


process.on('unhandledRejection', function(reason, p) {
  console.log("Possibly Unhandled Rejection at: Promise ", p, " reason: ", reason);
  // application specific logging here
});

// const client = tls.connect({ port: 443, host: 'stream-api-integration.betfair.com' });

// client.on('error', err => console.log(err));

// client.on('data', (data) => {
//   console.log('data')
//   console.log(data.toString());
// });

// client.on('connect', (data) => {
//   console.log('connected');
//   const test = `${JSON.stringify({'op': 'authentication', 'id': 1234, 'appKey': 'uZ38LvLtpbk7cysA', 'session': 'K0gmjwi/tS3SMEOX+pBmQP85YkrEpqR12/b1HZ577Zk='})}\r\n`;
//   client.write(test);
// });

// client.on('end', () => console.log('socket ended'));

// client.on('close', err => console.log('close, err: ' + err));

new NevfairBot('nevace', '$hadow65', 'uZ38LvLtpbk7cysA');
