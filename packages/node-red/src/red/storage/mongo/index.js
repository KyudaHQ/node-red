const logger = require('winston').loggers.get('storage');
const _ = require("lodash");
const { MongoClient } = require("mongodb");

let _settings = null;
let _runtime = null;

let client = null;
let id = '123';

function log(name, data) {
    logger.debug(name, data)
}

async function init(settings, runtime) {
    _settings = settings;
    _runtime = runtime;
    const uri = "mongodb://127.0.0.1:27017";
    client = new MongoClient(uri, { useUnifiedTopology: true });
    return await client.connect();
}

async function getFlows() {
    const database = client.db('node-red');
    const collection = database.collection('flows');
    const result = await collection.findOne({
        labId: id
    });
    log('getFlows', result);
    return _.get(result, 'data', [])
}

async function saveFlows(flows) {
    const database = client.db('node-red');
    const collection = database.collection('flows');
    const result = await collection.updateOne({
        labId: id
    }, {
        $set: {
            labId: id,
            data: flows
        }
    }, {
        upsert: true
    });
    log('saveFlows', result.result);
}

async function getCredentials() {
    const database = client.db('node-red');
    const collection = database.collection('credentials');
    const result = await collection.findOne({
        labId: id
    });
    log('getCredentials', result);
    return _.get(result, 'data', [])
}

async function saveCredentials(credentials) {
    const database = client.db('node-red');
    const collection = database.collection('credentials');
    const result = await collection.updateOne({
        labId: id
    }, {
        $set: {
            labId: id,
            data: credentials
        }
    }, {
        upsert: true
    });
    log('saveCredentials', result.result);
}

async function getSettings() {
    const database = client.db('node-red');
    const collection = database.collection('settings');
    const result = await collection.findOne({
        labId: id
    });
    log('getSettings', result);
    return _.get(result, 'data', {})
}

async function saveSettings(settings) {
    const database = client.db('node-red');
    const collection = database.collection('settings');
    const result = await collection.updateOne({
        labId: id
    }, {
        $set: {
            labId: id,
            data: settings
        }
    }, {
        upsert: true
    });
    log('saveSettings', result.result);
}

async function getSessions() {
    const database = client.db('node-red');
    const collection = database.collection('sessions');
    const result = await collection.findOne({
        labId: id
    });
    log('getSessions', result);
    return _.get(result, 'data', {})
}

async function saveSessions(sessions) {
    const database = client.db('node-red');
    const collection = database.collection('sessions');
    const result = await collection.updateOne({
        labId: id
    }, {
        $set: {
            labId: id,
            data: sessions
        }
    }, {
        upsert: true
    });
    log('saveSessions', result.result);
}

async function getLibraryEntry(type, name) {}
async function saveLibraryEntry(type, name, meta, body) {}

module.exports = {
    init,
    getFlows,
    saveFlows,
    getCredentials,
    saveCredentials,
    getSettings,
    saveSettings,
    getSessions,
    saveSessions,
    getLibraryEntry,
    saveLibraryEntry
}