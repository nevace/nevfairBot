const MongoClient = require('mongodb').MongoClient;
const mongoHost = (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') ?
                  'mongodb://mongo:27017/nevfair' : 'mongodb://localhost:27017/nevfair';

module.exports = MongoClient.connect(mongoHost);
