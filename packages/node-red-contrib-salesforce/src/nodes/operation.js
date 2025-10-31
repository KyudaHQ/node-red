const logger = require('../util/logger');
const status = require('../util/nodeStatus');

module.exports = function (RED) {
    'use strict';

    function SalesforceOperationNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.salesforce = config.salesforce;
        node.salesforceConfig = RED.nodes.getNode(node.salesforce);

        if (!node.salesforceConfig) {
            const err = new Error('Missing Salesforce configuration');
            node.error(err.message);
            status.error(node, err.message);
            return;
        }

        node.on('input', async function (msg, send, done) {
            send =
                send ||
                function () {
                    node.send.apply(node, arguments);
                };
            done =
                done ||
                function (err) {
                    if (err) {
                        node.error(err, msg);
                    }
                };

            const sobject = msg.sobject || config.sobject;
            const extname = msg.extname || config.extname;
            const operation = (
                msg.operation ||
                config.operation ||
                ''
            ).toLowerCase();
            const maxFetchValue = msg.maxfetch || config.maxfetch;
            const maxFetch = parseInt(maxFetchValue, 10);

            status.info(node, 'processing');

            try {
                const result = await node.salesforceConfig.withConnection(
                    msg,
                    async function (conn) {
                        switch (operation) {
                            case 'query': {
                                if (
                                    !msg.payload ||
                                    typeof msg.payload !== 'string'
                                ) {
                                    throw new Error(
                                        'SOQL query must be provided in msg.payload'
                                    );
                                }
                                const options = { autoFetch: true };
                                if (!isNaN(maxFetch) && maxFetch > 0) {
                                    options.maxFetch = maxFetch;
                                }
                                const queryResult = await conn
                                    .query(msg.payload)
                                    .run(options);
                                msg.sfResponse = queryResult;
                                return queryResult.records || [];
                            }

                            case 'create': {
                                if (!sobject) {
                                    throw new Error(
                                        'Salesforce sObject is required for create'
                                    );
                                }
                                return conn
                                    .sobject(sobject)
                                    .create(msg.payload);
                            }

                            case 'update': {
                                if (!sobject) {
                                    throw new Error(
                                        'Salesforce sObject is required for update'
                                    );
                                }
                                return conn
                                    .sobject(sobject)
                                    .update(msg.payload);
                            }

                            case 'upsert': {
                                if (!sobject) {
                                    throw new Error(
                                        'Salesforce sObject is required for upsert'
                                    );
                                }
                                if (!extname) {
                                    throw new Error(
                                        'External Id field name is required for upsert'
                                    );
                                }
                                return conn
                                    .sobject(sobject)
                                    .upsert(msg.payload, extname);
                            }

                            case 'delete': {
                                if (!sobject) {
                                    throw new Error(
                                        'Salesforce sObject is required for delete'
                                    );
                                }
                                return conn
                                    .sobject(sobject)
                                    .destroy(msg.payload);
                            }

                            default:
                                throw new Error(
                                    'Unsupported Salesforce operation: ' +
                                        operation
                                );
                        }
                    }
                );

                msg.payload = result;

                if (operation === 'query') {
                    const size = Array.isArray(result) ? result.length : 0;
                    status.success(node, size + ' records');
                } else {
                    status.success(node, operation + ' ok');
                }

                send(msg);
                done();
            } catch (err) {
                msg.error = err;
                status.error(node, err.message);
                node.error(err.message, msg);
                send(msg);
                done(err);
            }
        });
    }

    RED.nodes.registerType('salesforce-operation', SalesforceOperationNode);
};
