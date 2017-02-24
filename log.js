const winston = require('winston');
require('winston-mongodb').MongoDB;
const DB = require('./DB');
const env = process.env.NODE_ENV || 'development';

module.exports = new(winston.Logger)({
  transports: [
    new(winston.transports.Console)({
      timestamp: new Date(),
      colorize: true,
      level: env === 'development' ? 'debug' : 'info',
      prettyPrint: true,
    }),
    new(winston.transports.MongoDB)({
      db: DB
    })
  ]
});
