const { MongoClient }  = require('mongodb');
const uri = process.env.DB_URI;

module.exports.dbVeracityClient = () => {
    const client = new MongoClient(uri);
    return client.db('veracity');
};