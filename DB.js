const MongoClient = require('mongodb').MongoClient;
const mongoHost = (process.env.NODE_ENV === 'production') ? '' : 'mongodb://localhost:27017/nevfair';

module.exports = MongoClient.connect(mongoHost);
