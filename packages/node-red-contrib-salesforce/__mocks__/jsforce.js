const { EventEmitter } = require('events');

const connectionInstances = [];
const oauthInstances = [];
let connectionCounter = 0;

class MockConnection extends EventEmitter {
    constructor(options = {}) {
        super();
        this.options = options;
        this.login = jest.fn(async (username, password) => {
            this.username = username;
            this.password = password;
            this.accessToken = `TOKEN-${connectionCounter}`;
            this.instanceUrl = 'https://example.my.salesforce.com';
        });
        this.query = jest.fn((soql) => {
            this.lastQuery = soql;
            const queryState = {
                totalSize: 1,
                totalFetched: 1,
                done: true,
            };
            const records = [
                {
                    Id: '001000000000001',
                    Name: 'Acme',
                },
            ];
            const runMock = jest.fn(async (opts = {}) => {
                this.lastQueryOptions = opts;
                return records;
            });
            return {
                run: runMock,
                get totalSize() {
                    return queryState.totalSize;
                },
                get totalFetched() {
                    return queryState.totalFetched;
                },
                get done() {
                    return queryState.done;
                },
            };
        });
        this._sobjects = {};
        this.sobject = jest.fn((name) => {
            if (!this._sobjects[name]) {
                this._sobjects[name] = {
                    name,
                    create: jest.fn(async (payload) => ({
                        success: true,
                        id: '001000000000002',
                        payload,
                    })),
                    update: jest.fn(async (payload) => ({
                        success: true,
                        id: Array.isArray(payload) ? undefined : payload.Id || '001000000000003',
                        payload,
                    })),
                    upsert: jest.fn(async (payload, extIdField) => ({
                        success: true,
                        id: '001000000000004',
                        extIdField,
                        payload,
                    })),
                    destroy: jest.fn(async (payload) => ({
                        success: true,
                        id: Array.isArray(payload) ? undefined : payload,
                        payload,
                    })),
                    retrieve: jest.fn(async (ids) => {
                        if (Array.isArray(ids)) {
                            return ids.map((id) => ({
                                Id: id,
                                sobject: name,
                            }));
                        }
                        return {
                            Id: ids,
                            sobject: name,
                        };
                    }),
                    describe: jest.fn(async () => ({
                        name,
                        fields: [],
                    })),
                };
            }
            return this._sobjects[name];
        });
        this.search = jest.fn(async (sosl) => ({
            searchRecords: [
                {
                    attributes: {
                        type: 'Account',
                        url: '/services/data/vXX.X/sobjects/Account/001000000000001',
                    },
                    Id: '001000000000001',
                    Name: 'Acme',
                    _query: sosl,
                },
            ],
        }));
        this.describeGlobal = jest.fn(async () => ({
            encoding: 'UTF-8',
            maxBatchSize: 200,
            sobjects: [],
        }));
        this.apex = {
            get: jest.fn(async (path) => ({ method: 'get', path })),
            post: jest.fn(async (path, body) => ({ method: 'post', path, body })),
            put: jest.fn(async (path, body) => ({ method: 'put', path, body })),
            patch: jest.fn(async (path, body) => ({ method: 'patch', path, body })),
            delete: jest.fn(async (path, body) => ({ method: 'delete', path, body })),
        };
        this._resources = {};
        this.chatter = {
            resource: jest.fn((path) => {
                if (!this._resources[path]) {
                    this._resources[path] = {
                        retrieve: jest.fn(async () => ({ path, operation: 'retrieve' })),
                        create: jest.fn(async (payload) => ({ path, operation: 'create', payload })),
                    };
                }
                return this._resources[path];
            }),
        };
        this._subscriptions = [];
        this.streaming = {
            topic: jest.fn((topicName) => {
                const subscribe = jest.fn((handler, replay) => {
                    const replayId =
                        typeof replay === 'number'
                            ? replay
                            : replay && typeof replay.replayId !== 'undefined'
                            ? replay.replayId
                            : undefined;
                    const subscription = {
                        topic: topicName,
                        handler,
                        replayId,
                        cancel: jest.fn(),
                        unsubscribe: jest.fn(),
                    };
                    this._subscriptions.push(subscription);
                    return subscription;
                });
                return { subscribe };
            }),
            channel: jest.fn((channelName) => {
                const subscribe = jest.fn((handler, opts) => {
                    const replayId =
                        typeof opts === 'number'
                            ? opts
                            : opts && typeof opts.replayId !== 'undefined'
                            ? opts.replayId
                            : undefined;
                    const subscription = {
                        channel: channelName,
                        handler,
                        options: opts,
                        replayId,
                        cancel: jest.fn(),
                        unsubscribe: jest.fn(),
                    };
                    this._subscriptions.push(subscription);
                    return subscription;
                });
                return { subscribe };
            }),
        };
        this.authorize = jest.fn(async () => ({ id: 'https://login.salesforce.com/id/ORG/USER' }));
        connectionInstances.push(this);
        connectionCounter += 1;
    }
}

class MockOAuth2 {
    constructor(options = {}) {
        this.options = options;
        this.getAuthorizationUrl = jest.fn(() => 'https://login.salesforce.com/mock-auth');
        this.refreshToken = jest.fn(async (refreshToken) => ({
            id: 'https://login.salesforce.com/id/ORG/USER',
            access_token: 'REFRESHED_TOKEN',
            instance_url: 'https://example.my.salesforce.com',
            refreshToken,
        }));
        oauthInstances.push(this);
    }
}

module.exports = {
    Connection: MockConnection,
    OAuth2: MockOAuth2,
    __mock: {
        connections: connectionInstances,
        oauth2: oauthInstances,
        reset() {
            connectionInstances.length = 0;
            oauthInstances.length = 0;
            connectionCounter = 0;
        },
    },
};
