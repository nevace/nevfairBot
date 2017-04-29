const winston = require('winston');
const DB = require('./DB');
const env = process.env.NODE_ENV || 'development';
const transports = [
  new (winston.transports.Console)({
    timestamp: new Date(),
    colorize: true,
    // level: env === 'development' ? 'debug' : 'info',
    level: 'debug',
    prettyPrint: true,
  })
];

if (process.env.NODE_ENV !== 'test') {
  // require('winston-mongodb').MongoDB;
  // transports.push(new (winston.transports.MongoDB)({db: DB}))
}

module.exports = new winston.Logger({transports});
