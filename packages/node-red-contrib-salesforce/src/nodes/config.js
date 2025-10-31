module.exports = function (RED) {
    'use strict';
    const jsforce = require('jsforce');

    const DEFAULT_LOGIN_URL = 'https://login.salesforce.com';

    function isSessionError(err) {
        if (!err) {
            return false;
        }
        if (Array.isArray(err)) {
            return err.some(isSessionError);
        }
        const code = err.errorCode || err.name || '';
        const message = err.message || '';
        return (
            (typeof code === 'string' &&
                code.indexOf('INVALID_SESSION_ID') !== -1) ||
            (typeof message === 'string' &&
                message.indexOf('INVALID_SESSION_ID') !== -1)
        );
    }

    function setCredential(node, key, value) {
        if (value === undefined || value === null || value === '') {
            return;
        }
        node.credentials = node.credentials || {};
        if (node.credentials[key] === value) {
            return;
        }
        node.credentials[key] = value;
    }

    function SalesforceConfigNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.credentials = node.credentials || {};

        node.loginType =
            config.loginType ||
            node.credentials.loginType ||
            'Username-Password';
        node.loginUrl =
            config.loginUrl || node.credentials.loginUrl || DEFAULT_LOGIN_URL;
        node.username = config.username || node.credentials.username || '';
        node.apiVersion = config.apiVersion || node.credentials.apiVersion;

        setCredential(node, 'id', node.id);
        setCredential(node, 'loginType', node.loginType);
        setCredential(node, 'loginUrl', node.loginUrl);
        if (node.username) {
            setCredential(node, 'username', node.username);
        }
        if (node.apiVersion) {
            setCredential(node, 'apiVersion', node.apiVersion);
        }
        RED.nodes.addCredentials(node.id, node.credentials);

        let activeConn = null;
        let establishing = null;

        function attachRefreshHandlers(conn) {
            conn.on('refresh', function (accessToken, res) {
                setCredential(node, 'accessToken', accessToken);
                if (res && res.instance_url) {
                    setCredential(node, 'instanceUrl', res.instance_url);
                }
                RED.nodes.addCredentials(node.id, node.credentials);
            });
        }

        async function createUsernamePasswordConnection() {
            const username = node.username || node.credentials.username;
            const password = node.credentials.password;
            if (!username || !password) {
                throw new Error(
                    'Salesforce username and password are required'
                );
            }

            const conn = new jsforce.Connection({
                loginUrl: node.loginUrl,
                version: node.apiVersion || undefined,
            });

            await conn.login(username, password);

            setCredential(node, 'username', username);
            if (conn.accessToken) {
                setCredential(node, 'accessToken', conn.accessToken);
            }
            if (conn.instanceUrl) {
                setCredential(node, 'instanceUrl', conn.instanceUrl);
            }
            RED.nodes.addCredentials(node.id, node.credentials);
            attachRefreshHandlers(conn);
            return conn;
        }

        async function createOAuthConnection() {
            const clientId = node.credentials.clientId;
            const clientSecret = node.credentials.clientSecret;
            const refreshToken = node.credentials.refreshToken;
            const accessToken = node.credentials.accessToken;
            const instanceUrl = node.credentials.instanceUrl;
            const redirectUri = node.credentials.redirectUri;

            if (!clientId || !clientSecret) {
                throw new Error(
                    'Salesforce clientId and clientSecret are required'
                );
            }
            if (!refreshToken) {
                throw new Error(
                    'Salesforce refresh token is required. Re-authenticate in the config node.'
                );
            }

            const oauth2 = new jsforce.OAuth2({
                loginUrl: node.loginUrl,
                clientId,
                clientSecret,
                redirectUri,
            });

            const conn = new jsforce.Connection({
                loginUrl: node.loginUrl,
                version: node.apiVersion || undefined,
                instanceUrl,
                accessToken,
                refreshToken,
                oauth2,
            });

            attachRefreshHandlers(conn);

            if (!accessToken) {
                const res = await oauth2.refreshToken(refreshToken);
                conn.accessToken = res.access_token;
                conn.instanceUrl = res.instance_url;
                setCredential(node, 'accessToken', res.access_token);
                setCredential(node, 'instanceUrl', res.instance_url);
                RED.nodes.addCredentials(node.id, node.credentials);
            }

            return conn;
        }

        function createSignedRequestConnection(msg) {
            if (!msg) {
                throw new Error(
                    'Signed-Request login requires msg.accessToken and msg.instanceUrl'
                );
            }
            const accessToken = msg.accessToken;
            const instanceUrl = msg.instanceUrl;
            if (!accessToken || !instanceUrl) {
                throw new Error(
                    'Signed-Request login requires msg.accessToken and msg.instanceUrl'
                );
            }
            const conn = new jsforce.Connection({
                loginUrl: node.loginUrl,
                version: node.apiVersion || undefined,
                instanceUrl,
                accessToken,
            });
            return conn;
        }

        async function establishConnection(msg) {
            switch (node.loginType) {
                case 'Username-Password':
                    return createUsernamePasswordConnection();
                case 'oauth':
                    return createOAuthConnection();
                case 'Signed-Request':
                    return createSignedRequestConnection(msg);
                default:
                    throw new Error(
                        'Unsupported Salesforce login type: ' + node.loginType
                    );
            }
        }

        node.getConnection = async function (msg) {
            if (node.loginType === 'Signed-Request') {
                return establishConnection(msg);
            }

            if (activeConn) {
                return activeConn;
            }

            if (!establishing) {
                establishing = establishConnection(msg)
                    .then(function (conn) {
                        activeConn = conn;
                        return conn;
                    })
                    .catch(function (err) {
                        activeConn = null;
                        throw err;
                    })
                    .finally(function () {
                        establishing = null;
                    });
            }

            return establishing;
        };

        node.invalidate = function () {
            activeConn = null;
            establishing = null;
        };

        node.withConnection = async function (msg, handler) {
            try {
                const conn = await node.getConnection(msg);
                return await handler(conn);
            } catch (err) {
                if (
                    isSessionError(err) &&
                    node.loginType !== 'Signed-Request'
                ) {
                    node.invalidate();
                    const conn = await node.getConnection(msg);
                    return await handler(conn);
                }
                throw err;
            }
        };

        node.login = function (msg, callback) {
            node.getConnection(msg)
                .then(function (conn) {
                    callback(null, conn);
                })
                .catch(function (err) {
                    callback(err);
                });
        };

        node.on('close', function (done) {
            node.invalidate();
            done();
        });
    }

    RED.nodes.registerType('salesforce-config', SalesforceConfigNode, {
        credentials: {
            id: { type: 'text' },
            loginUrl: { type: 'text' },
            loginType: { type: 'text' },
            username: { type: 'text' },
            password: { type: 'password' },
            clientId: { type: 'password' },
            clientSecret: { type: 'password' },
            redirectUri: { type: 'text' },
            accessToken: { type: 'password' },
            refreshToken: { type: 'password' },
            instanceUrl: { type: 'text' },
            apiVersion: { type: 'text' },
            userId: { type: 'text' },
        },
    });

    RED.httpAdmin.get('/force/credentials/:id', function (req, res) {
        const id = req.params.id;
        const credentials = RED.nodes.getCredentials(id) || {};
        return res.json({
            userId: credentials.userId || null,
        });
    });

    RED.httpAdmin.post('/force/credentials/:id/reset', function (req, res) {
        const id = req.params.id;
        const credentials = RED.nodes.getCredentials(id) || {};
        credentials.userId = null;
        RED.nodes.addCredentials(id, credentials);
        return res.json({
            userId: credentials.userId,
        });
    });

    RED.httpAdmin.get('/force/credentials/:id/auth', function (req, res) {
        const id = req.query.id;
        const salesforceConfig = RED.nodes.getNode(id);

        let clientId;
        let clientSecret;

        if (salesforceConfig && salesforceConfig.credentials) {
            clientId =
                salesforceConfig.credentials.clientId || req.query.clientId;
            clientSecret =
                salesforceConfig.credentials.clientSecret ||
                req.query.clientSecret;
        } else {
            clientId = req.query.clientId;
            clientSecret = req.query.clientSecret;
        }

        const credentials = {
            id: id,
            loginType: 'oauth',
            loginUrl: req.query.loginUrl,
            clientId: clientId,
            clientSecret: clientSecret,
            redirectUri: req.query.callback,
        };

        RED.nodes.addCredentials(id, credentials);

        const oauth2 = new jsforce.OAuth2({
            loginUrl: credentials.loginUrl,
            clientId: credentials.clientId,
            clientSecret: credentials.clientSecret,
            redirectUri: credentials.redirectUri,
        });

        let authUrl = oauth2.getAuthorizationUrl({
            scope: 'api id web refresh_token',
        });
        if (req.query.username) {
            authUrl = authUrl + '&login_hint=' + req.query.username;
        }

        return res.redirect(authUrl);
    });

    RED.httpAdmin.get(
        '/force/credentials/:id/auth/callback',
        function (req, res) {
            const id = req.params.id;
            const credentials = RED.nodes.getCredentials(id);

            if (!req.query.code) {
                return res.send('ERROR: missing authorization code');
            }

            if (
                !credentials ||
                !credentials.clientId ||
                !credentials.clientSecret
            ) {
                return res.send('ERROR: missing credentials');
            }

            const conn = new jsforce.Connection({
                oauth2: {
                    loginUrl: credentials.loginUrl,
                    clientId: credentials.clientId,
                    clientSecret: credentials.clientSecret,
                    redirectUri: credentials.redirectUri,
                },
            });

            conn.authorize(req.query.code, function (err, userInfo) {
                if (err) {
                    return res.send(err.message);
                }

                const finalCredentials = {
                    id: id,
                    loginType: 'oauth',
                    loginUrl: credentials.loginUrl,
                    clientId: credentials.clientId,
                    clientSecret: credentials.clientSecret,
                    redirectUri: credentials.redirectUri,
                    accessToken: conn.accessToken,
                    refreshToken: conn.refreshToken,
                    instanceUrl: conn.instanceUrl,
                    userId: userInfo.id,
                };

                RED.nodes.addCredentials(id, finalCredentials);

                return res.json({
                    message:
                        'Authorised. You can now close this window and go back to Node-RED.',
                    credentials: RED.nodes.getCredentials(id),
                });
            });
        }
    );
};
