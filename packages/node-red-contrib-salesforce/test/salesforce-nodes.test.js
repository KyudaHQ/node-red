jest.mock('jsforce');
jest.mock('jsforce/api/streaming');

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
                expect(conn.options.version).toBe('61.0');
                expect(conn.login).toHaveBeenCalledWith('user@example.com', 's3cret');
                return 'first';
            });
            expect(firstResult).toBe('first');
            expect(jsforce.__mock.connections.length).toBe(1);

            const secondResult = await node.withConnection({}, async (conn) => {
                expect(conn.login).toHaveBeenCalledTimes(1);
                expect(conn.options.version).toBe('61.0');
                return 'second';
            });
            expect(secondResult).toBe('second');
            expect(jsforce.__mock.connections.length).toBe(1);
        });

        test('respects configured API version when provided', async () => {
            const flow = [
                {
                    id: 'config',
                    type: 'salesforce-config',
                    name: 'SF',
                    loginType: 'Username-Password',
                    loginUrl: 'https://login.salesforce.com',
                    username: 'user@example.com',
                    apiVersion: '55.0',
                },
            ];

            await helper.load([configNode], flow, { config: CREDENTIALS });
            const node = helper.getNode('config');

            const result = await node.withConnection({}, async (conn) => {
                expect(conn.options.version).toBe('55.0');
                return 'ok';
            });

            expect(result).toBe('ok');
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
            expect(msg.sfResponse.totalSize).toBe(1);
            expect(msg.sfResponse.done).toBe(true);
            expect(msg.sfResponse.fetched).toBe(1);
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

        test('performs SOSL search and returns matched records', async () => {
            const configId = 'config-search';
            const opId = 'op-search';
            const helperId = 'helper-search';
            const flowId = 'flow-search';
            const flow = [
                { id: flowId, type: 'tab', label: 'Search Flow' },
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
                    name: 'search',
                    salesforce: configId,
                    operation: 'search',
                    z: flowId,
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
            opNode.receive({ payload: 'FIND {Acme}' });

            const msg = await messagePromise;

            expect(Array.isArray(msg.payload)).toBe(true);
            expect(msg.payload).toHaveLength(1);
            expect(msg.sfResponse.searchRecords).toBeDefined();

            const conn = jsforce.__mock.connections[0];
            expect(conn.search).toHaveBeenCalledWith('FIND {Acme}');
        });

        test('does not emit message when operation fails', async () => {
            const configId = 'config-error';
            const opId = 'op-error';
            const helperId = 'helper-error';
            const flowId = 'flow-error';
            const flow = [
                { id: flowId, type: 'tab', label: 'Error Flow' },
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
                    operation: 'create',
                    z: flowId,
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, operationNode], flow, { [configId]: CREDENTIALS });

            const helperNode = helper.getNode(helperId);
            const received = [];
            helperNode.on('input', (msg) => received.push(msg));

            const opNode = helper.getNode(opId);
            const errorSpy = jest.spyOn(opNode, 'error');

            opNode.receive({ payload: { Name: 'No SObject' } });

            await waitFor(() => errorSpy.mock.calls.length > 0);
            await wait(20);

            expect(received).toHaveLength(0);
            expect(errorSpy).toHaveBeenCalledWith(
                'Salesforce sObject is required for create',
                expect.objectContaining({ payload: { Name: 'No SObject' } })
            );
        });

        test('describes sObject metadata', async () => {
            const configId = 'config-describe';
            const opId = 'op-describe';
            const helperId = 'helper-describe';
            const flowId = 'flow-describe';
            const flow = [
                { id: flowId, type: 'tab', label: 'Describe Flow' },
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
                    name: 'describe',
                    salesforce: configId,
                    sobject: 'Account',
                    operation: 'describe',
                    z: flowId,
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
            opNode.receive({});

            const msg = await messagePromise;

            expect(msg.payload.name).toBe('Account');

            const conn = jsforce.__mock.connections[0];
            const sobject = conn._sobjects.Account;
            expect(sobject.describe).toHaveBeenCalled();
        });

        test('retrieves records by Id', async () => {
            const configId = 'config-retrieve';
            const opId = 'op-retrieve';
            const helperId = 'helper-retrieve';
            const flowId = 'flow-retrieve';
            const flow = [
                { id: flowId, type: 'tab', label: 'Retrieve Flow' },
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
                    name: 'retrieve',
                    salesforce: configId,
                    sobject: 'Account',
                    operation: 'retrieve',
                    z: flowId,
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
            opNode.receive({ payload: ['001000000000001', '001000000000002'] });

            const msg = await messagePromise;

            expect(Array.isArray(msg.payload)).toBe(true);
            expect(msg.payload).toHaveLength(2);

            const conn = jsforce.__mock.connections[0];
            const sobject = conn._sobjects.Account;
            expect(sobject.retrieve).toHaveBeenCalledWith([
                '001000000000001',
                '001000000000002',
            ]);
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

        test('reports errors without emitting message', async () => {
            const configId = 'config-apex-error';
            const apexId = 'apex-error-node';
            const helperId = 'helper-apex-error';
            const flowId = 'flow-apex-error';
            const flow = [
                { id: flowId, type: 'tab', label: 'Apex Error Flow' },
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
                    name: 'apex-error',
                    salesforce: configId,
                    path: '/services/apexrest/Example',
                    operation: 'unknown',
                    z: flowId,
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, apexNode], flow, { [configId]: CREDENTIALS });

            const helperNode = helper.getNode(helperId);
            const received = [];
            helperNode.on('input', (msg) => received.push(msg));

            const apex = helper.getNode(apexId);
            const errorSpy = jest.spyOn(apex, 'error');

            apex.receive({ payload: { foo: 'bar' } });

            await waitFor(() => errorSpy.mock.calls.length > 0);
            await wait(20);

            expect(received).toHaveLength(0);
            expect(errorSpy).toHaveBeenCalledWith(
                'Unsupported Apex operation: unknown',
                expect.objectContaining({ payload: { foo: 'bar' } })
            );
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

        test('reports errors without emitting message', async () => {
            const configId = 'config-chatter-error';
            const chatterId = 'chatter-error-node';
            const helperId = 'helper-chatter-error';
            const flowId = 'flow-chatter-error';
            const flow = [
                { id: flowId, type: 'tab', label: 'Chatter Error Flow' },
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
                    name: 'chatter-error',
                    salesforce: configId,
                    path: '/feeds/news/me',
                    operation: 'invalid',
                    z: flowId,
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, chatterNode], flow, { [configId]: CREDENTIALS });

            const helperNode = helper.getNode(helperId);
            const received = [];
            helperNode.on('input', (msg) => received.push(msg));

            const chatter = helper.getNode(chatterId);
            const errorSpy = jest.spyOn(chatter, 'error');

            chatter.receive({ payload: { foo: 'bar' } });

            await waitFor(() => errorSpy.mock.calls.length > 0);
            await wait(20);

            expect(received).toHaveLength(0);
            expect(errorSpy).toHaveBeenCalledWith(
                'Unsupported Chatter operation: invalid',
                expect.objectContaining({ payload: { foo: 'bar' } })
            );
        });
    });

    describe('salesforce-stream', () => {
        test('reports invalid replay configuration without emitting message', async () => {
            const configId = 'config-stream-error';
            const streamId = 'stream-error-node';
            const helperId = 'helper-stream-error';
            const flowId = 'flow-stream-error';
            const flow = [
                { id: flowId, type: 'tab', label: 'Stream Error Flow' },
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
                    name: 'stream-error',
                    salesforce: configId,
                    topic: '/topic/ExampleTopic',
                    replayId: 'bogus',
                    z: flowId,
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, streamNode], flow, { [configId]: CREDENTIALS });

            const helperNode = helper.getNode(helperId);
            const received = [];
            helperNode.on('input', (msg) => received.push(msg));

            await waitFor(() => {
                const calls = helper.log().getCalls();
                return calls.some((call) => {
                    const [logEvent] = call.args || [];
                    return (
                        logEvent &&
                        logEvent.level === helper.log().ERROR &&
                        logEvent.id === streamId &&
                        typeof logEvent.msg === 'string' &&
                        logEvent.msg.includes(
                            'Replay Id must be an integer or "latest"/"all" keyword'
                        )
                    );
                });
            }, { timeout: 1000 });

            expect(received).toHaveLength(0);
            expect(jsforce.__mock.connections.length).toBe(0);
        });

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
                    replayId: '42',
                    z: flowId,
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, streamNode], flow, { [configId]: CREDENTIALS });

            await waitFor(() => jsforce.__mock.connections.length > 0);
            const conn = jsforce.__mock.connections[0];
            await waitFor(() => conn._streamingClients.length > 0, { timeout: 1000 });
            await waitFor(() => conn._subscriptions.length > 0, { timeout: 1000 });

            const helperNode = helper.getNode(helperId);
            const messagePromise = new Promise((resolve) => {
                helperNode.on('input', resolve);
            });

            const subscription = conn._subscriptions[0];
            expect(subscription.replayId).toBe(42);
            const client = conn._streamingClients[0];
            expect(conn.streaming.createClient).toHaveBeenCalled();
            expect(client).toBeDefined();
            expect(Array.isArray(client._extensions)).toBe(true);
            expect(client._extensions).toHaveLength(1);
            expect(client._extensions[0]._channel).toBe('/topic/ExampleTopic');
            expect(client._extensions[0]._replay).toBe(42);
            expect(client.subscribe).toHaveBeenCalledWith(
                '/topic/ExampleTopic',
                expect.any(Function)
            );

            subscription.handler({ event: { replayId: 1 }, sobject: { Id: 'evt' } });

            const msg = await messagePromise;
            expect(msg.payload.sobject.Id).toBe('evt');

            subscription.handler({ event: { replayId: 1 }, sobject: { Id: 'evt' } });
        });

        test('subscribes to generic channel paths', async () => {
            const configId = 'config-emp';
            const streamId = 'stream-emp';
            const helperId = 'helper-emp';
            const flowId = 'flow-emp';
            const flow = [
                { id: flowId, type: 'tab', label: 'EMP Flow' },
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
                    name: 'emp',
                    salesforce: configId,
                    topic: '/event/Example__e',
                    replayId: '-1',
                    z: flowId,
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, streamNode], flow, { [configId]: CREDENTIALS });

            await waitFor(() => jsforce.__mock.connections.length > 0);
            const conn = jsforce.__mock.connections[0];
            await waitFor(() => conn._streamingClients.length > 0, { timeout: 1000 });
            await waitFor(() => conn._subscriptions.length > 0, { timeout: 1000 });

            const subscription = conn._subscriptions[0];
            expect(subscription.replayId).toBe(-1);
            expect(conn.streaming.createClient).toHaveBeenCalled();
            const client = conn._streamingClients[0];
            expect(client._extensions[0]._channel).toBe('/event/Example__e');
            expect(client.subscribe).toHaveBeenCalledWith(
                '/event/Example__e',
                expect.any(Function)
            );
        });

        test('resubscribes after subscription error', async () => {
            const configId = 'config-stream-retry';
            const streamId = 'stream-retry-node';
            const helperId = 'helper-stream-retry';
            const flowId = 'flow-stream-retry';
            const flow = [
                { id: flowId, type: 'tab', label: 'Stream Retry Flow' },
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
                    name: 'stream-retry',
                    salesforce: configId,
                    topic: '/topic/ExampleTopic',
                    replayId: '-1',
                    z: flowId,
                    wires: [[helperId]],
                },
                { id: helperId, type: 'helper', z: flowId },
            ];

            await helper.load([configNode, streamNode], flow, { [configId]: CREDENTIALS });

            const stream = helper.getNode(streamId);
            const config = helper.getNode(configId);
            const withConnectionSpy = jest.spyOn(config, 'withConnection');

            try {
                // Speed up retry loop for testing
                stream._baseReconnectDelay = 10;

                await waitFor(() => jsforce.__mock.connections.length > 0);
                const conn = jsforce.__mock.connections[0];
                await waitFor(() => conn._subscriptions.length > 0, { timeout: 1000 });

                const subscription = conn._subscriptions[0];

                const initialSubscriptionCount = conn._subscriptions.length;
                const initialWithConnectionCalls = withConnectionSpy.mock.calls.length;

                subscription.emit('error', new Error('simulated disconnect'));

                await waitFor(
                    () => conn._subscriptions.length > initialSubscriptionCount,
                    { timeout: 500 }
                );

                expect(conn._subscriptions.length).toBeGreaterThan(initialSubscriptionCount);
                expect(withConnectionSpy.mock.calls.length).toBeGreaterThan(
                    initialWithConnectionCalls
                );
            } finally {
                withConnectionSpy.mockRestore();
            }
        });
    });
});
