jest.mock('jsforce');

const helper = require('node-red-node-test-helper');
const jsforce = require('jsforce');

const configNode = require('../src/nodes/config.js');
const operationNode = require('../src/nodes/operation.js');
const apexNode = require('../src/nodes/apex.js');
const chatterNode = require('../src/nodes/chatter.js');
const streamNode = require('../src/nodes/stream.js');

helper.init(require.resolve('node-red'));

const CREDENTIALS = {
    password: 's3cret',
};

jest.setTimeout(10000);

function wait(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(condition, opts = {}) {
    const timeout = opts.timeout || 200;
    const interval = opts.interval || 10;
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeout) {
            throw new Error('Timed out waiting for condition');
        }
        await wait(interval);
    }
}

describe('@kyuda/node-red-contrib-salesforce nodes', () => {
    beforeAll((done) => {
        helper.startServer(done);
    });

    afterAll((done) => {
        helper.stopServer(done);
    });

    beforeEach(() => {
        jsforce.__mock.reset();
    });

    afterEach(() => {
        jest.clearAllMocks();
        return helper.unload();
    });

    describe('salesforce-config', () => {
        test('establishes and caches username/password connection', async () => {
            const flow = [
                {
                    id: 'config',
                    type: 'salesforce-config',
                    name: 'SF',
                    loginType: 'Username-Password',
                    loginUrl: 'https://login.salesforce.com',
                    username: 'user@example.com',
                },
            ];

            await helper.load([configNode], flow, { config: CREDENTIALS });
            const node = helper.getNode('config');

            const firstResult = await node.withConnection({}, async (conn) => {
                expect(conn.login).toHaveBeenCalledWith('user@example.com', 's3cret');
                return 'first';
            });
            expect(firstResult).toBe('first');
            expect(jsforce.__mock.connections.length).toBe(1);

            const secondResult = await node.withConnection({}, async (conn) => {
                expect(conn.login).toHaveBeenCalledTimes(1);
                return 'second';
            });
            expect(secondResult).toBe('second');
            expect(jsforce.__mock.connections.length).toBe(1);
        });

        test('re-establishes connection after INVALID_SESSION_ID', async () => {
            const flow = [
                {
                    id: 'config',
                    type: 'salesforce-config',
                    name: 'SF',
                    loginType: 'Username-Password',
                    loginUrl: 'https://login.salesforce.com',
                    username: 'user@example.com',
                },
            ];

            await helper.load([configNode], flow, { config: CREDENTIALS });
            const node = helper.getNode('config');

            let attempts = 0;
            const result = await node.withConnection({}, async (conn) => {
                attempts += 1;
                if (attempts === 1) {
                    const error = new Error('INVALID_SESSION_ID: Session expired');
                    error.errorCode = 'INVALID_SESSION_ID';
                    throw error;
                }
                return 'ok';
            });

            expect(result).toBe('ok');
            expect(jsforce.__mock.connections.length).toBe(2);
        });
    });

    describe('salesforce-operation', () => {
        test('runs query and forwards records', async () => {
            const configId = 'config-query';
            const opId = 'op-query';
            const helperId = 'helper-query';
            const flowId = 'flow-query';
            const flow = [
                { id: flowId, type: 'tab', label: 'Query Flow' },
                {
                    id: configId,
                    type: 'salesforce-config',
                    name: 'SF',
                    loginType: 'Username-Password',
                    loginUrl: 'https://login.salesforce.com',
                    username: 'user@example.com',
                },
                {
                    id: opId,
                    type: 'salesforce-operation',
                    name: 'query',
                    salesforce: configId,
                    z: flowId,
                    operation: 'query',
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, operationNode], flow, { [configId]: CREDENTIALS });

            const helperNode = helper.getNode(helperId);
            const messagePromise = new Promise((resolve) => {
                helperNode.on('input', resolve);
            });

            const opNode = helper.getNode(opId);
            opNode.receive({ payload: 'SELECT Id, Name FROM Account' });

            const msg = await messagePromise;

            expect(msg.sfResponse).toBeDefined();
            expect(msg.sfResponse.records).toHaveLength(1);
            expect(msg.payload).toHaveLength(1);
            expect(msg.payload[0].Id).toBe('001000000000001');

            const conn = jsforce.__mock.connections[0];
            expect(conn.query).toHaveBeenCalledWith('SELECT Id, Name FROM Account');
        });

        test('creates record via sobject API', async () => {
            const configId = 'config-create';
            const opId = 'op-create';
            const helperId = 'helper-create';
            const flowId = 'flow-create';
            const flow = [
                { id: flowId, type: 'tab', label: 'Create Flow' },
                {
                    id: configId,
                    type: 'salesforce-config',
                    name: 'SF',
                    loginType: 'Username-Password',
                    loginUrl: 'https://login.salesforce.com',
                    username: 'user@example.com',
                },
                {
                    id: opId,
                    type: 'salesforce-operation',
                    name: 'create',
                    salesforce: configId,
                    sobject: 'Account',
                    operation: 'create',
                    z: flowId,
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, operationNode], flow, { [configId]: CREDENTIALS });

            const payload = { Name: 'New Account' };
            const helperNode = helper.getNode(helperId);
            const messagePromise = new Promise((resolve) => {
                helperNode.on('input', resolve);
            });

            const opNode = helper.getNode(opId);
            opNode.receive({ payload });

            const msg = await messagePromise;

            expect(msg.payload.success).toBe(true);
            const conn = jsforce.__mock.connections[0];
            const sobject = conn._sobjects.Account;
            expect(sobject.create).toHaveBeenCalledWith(payload);
        });
    });

    describe('salesforce-apex', () => {
        test('invokes Apex REST method', async () => {
            const configId = 'config-apex';
            const apexId = 'apex-node';
            const helperId = 'helper-apex';
            const flowId = 'flow-apex';
            const flow = [
                { id: flowId, type: 'tab', label: 'Apex Flow' },
                {
                    id: configId,
                    type: 'salesforce-config',
                    name: 'SF',
                    loginType: 'Username-Password',
                    loginUrl: 'https://login.salesforce.com',
                    username: 'user@example.com',
                },
                {
                    id: apexId,
                    type: 'salesforce-apex',
                    name: 'apex',
                    salesforce: configId,
                    path: '/services/apexrest/Example',
                    operation: 'post',
                    z: flowId,
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, apexNode], flow, { [configId]: CREDENTIALS });

            const payload = { foo: 'bar' };
            const helperNode = helper.getNode(helperId);
            const messagePromise = new Promise((resolve) => {
                helperNode.on('input', resolve);
            });

            const apex = helper.getNode(apexId);
            apex.receive({ payload });

            const msg = await messagePromise;
            expect(msg.payload.method).toBe('post');

            const conn = jsforce.__mock.connections[0];
            expect(conn.apex.post).toHaveBeenCalledWith('/services/apexrest/Example', payload);
        });
    });

    describe('salesforce-chatter', () => {
        test('retrieves chatter resource', async () => {
            const configId = 'config-chatter';
            const chatterId = 'chatter-node';
            const helperId = 'helper-chatter';
            const flowId = 'flow-chatter';
            const flow = [
                { id: flowId, type: 'tab', label: 'Chatter Flow' },
                {
                    id: configId,
                    type: 'salesforce-config',
                    name: 'SF',
                    loginType: 'Username-Password',
                    loginUrl: 'https://login.salesforce.com',
                    username: 'user@example.com',
                },
                {
                    id: chatterId,
                    type: 'salesforce-chatter',
                    name: 'chatter',
                    salesforce: configId,
                    path: '/feeds/news/me',
                    operation: 'retrieve',
                    z: flowId,
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, chatterNode], flow, { [configId]: CREDENTIALS });

            const helperNode = helper.getNode(helperId);
            const messagePromise = new Promise((resolve) => {
                helperNode.on('input', resolve);
            });

            const chatter = helper.getNode(chatterId);
            chatter.receive({});

            const msg = await messagePromise;
            expect(msg.payload.operation).toBe('retrieve');

            const conn = jsforce.__mock.connections[0];
            expect(conn.chatter.resource).toHaveBeenCalledWith('/feeds/news/me');
            const resource = conn._resources['/feeds/news/me'];
            expect(resource.retrieve).toHaveBeenCalled();
        });
    });

    describe('salesforce-stream', () => {
        test('subscribes to topic and forwards events', async () => {
            const configId = 'config-stream';
            const streamId = 'stream-node';
            const helperId = 'helper-stream';
            const flowId = 'flow-stream';
            const flow = [
                { id: flowId, type: 'tab', label: 'Stream Flow' },
                {
                    id: configId,
                    type: 'salesforce-config',
                    name: 'SF',
                    loginType: 'Username-Password',
                    loginUrl: 'https://login.salesforce.com',
                    username: 'user@example.com',
                },
                {
                    id: streamId,
                    type: 'salesforce-stream',
                    name: 'stream',
                    salesforce: configId,
                    topic: '/topic/ExampleTopic',
                    z: flowId,
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, streamNode], flow, { [configId]: CREDENTIALS });

            await waitFor(() => jsforce.__mock.connections.length > 0);
            const conn = jsforce.__mock.connections[0];
            await waitFor(() => conn._subscriptions.length > 0, { timeout: 1000 });

            const helperNode = helper.getNode(helperId);
            const messagePromise = new Promise((resolve) => {
                helperNode.on('input', resolve);
            });

            const subscription = conn._subscriptions[0];
            subscription.handler({ event: { replayId: 1 }, sobject: { Id: 'evt' } });

            const msg = await messagePromise;
            expect(msg.payload.sobject.Id).toBe('evt');
            expect(conn.streaming.topic).toHaveBeenCalledWith('/topic/ExampleTopic');
        });
    });
});
