const winston = require('winston');
require('winston-mongodb').MongoDB;
const DB = require('./DB');
const env = process.env.NODE_ENV || 'development';

const Log = new winston.Logger({
  transports: [
    new (winston.transports.Console)({
      timestamp: new Date(),
      colorize: true,
      level: env === 'development' ? 'debug' : 'info',
      prettyPrint: true,
    }),
    new (winston.transports.MongoDB)({
      db: DB
    })
  ]
});

module.exports = Log;
