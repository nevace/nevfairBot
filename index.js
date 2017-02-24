const log = require('./log');
const NevfairBot = require('./NevfairBot');
const fs = require('mz/fs');
const botConfig = require('./botConfig.json');

for (let account of botConfig.accounts) {
  let credentials = account.credentials;

  for (let botSettings of account.NevfairBotInstances) {
    new NevfairBot(credentials, botSettings)
  }
}

process.on('unhandledRejection', function(reason, p) {
  log.error('Unhandled Rejection at: Promise ', p, ' reason: ', reason);
});
