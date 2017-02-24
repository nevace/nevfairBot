const log = require('./log');
const NevfairBot = require('./NevfairBot');
const fs = require('mz/fs');
const botConfig = require('./botConfig.json');

for (let account of botConfig.accounts) {
  let credentials = account.credentials;

  new NevfairBot(credentials, account.strategies)
}

process.on('unhandledRejection', (reason, p) => log.error('Unhandled Rejection at: Promise ', p, ' reason: ', reason));
