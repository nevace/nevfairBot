const MongoClient = require('mongodb').MongoClient;
const mongoHost = (process.env.NODE_ENV === 'production') ? '' : 'mongodb://localhost:27017/nevfair';

class DB {
	constructor() {
		this.db = MongoClient.connect(mongoHost);
	}

}

module.exports = new DB();
