const NevfairBot = require('./NevfairBot');
const fs = require('mz/fs');

process.on('unhandledRejection', function(reason, p) {
  console.log("Possibly Unhandled Rejection at: Promise ", p, " reason: ", reason);
  // application specific logging here
});

fs.readFile('./botConfig.json')
  .then(config => {
    const parsedData = JSON.parse(config);

    for (let account of parsedData.accounts) {
      let credentials = account.credentials;

      for (let botSettings of account.NevfairBotInstances) {
        new NevfairBot(credentials, botSettings)
      }
    }
  })
  .catch(err => console.log(err))
