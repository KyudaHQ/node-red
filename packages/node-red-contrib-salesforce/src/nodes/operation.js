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
                                const soql = msg.payload;
                                if (!soql || typeof soql !== 'string') {
                                    throw new Error(
                                        'SOQL query must be provided in msg.payload'
                                    );
                                }

                                const options = { autoFetch: true };
                                if (!isNaN(maxFetch) && maxFetch > 0) {
                                    options.maxFetch = maxFetch;
                                }

                                const query = conn.query(soql);
                                const records = await query.run(options);
                                const totalSize =
                                    typeof query.totalSize === 'number'
                                        ? query.totalSize
                                        : records.length;
                                const fetched =
                                    typeof query.totalFetched === 'number'
                                        ? query.totalFetched
                                        : records.length;
                                msg.sfResponse = {
                                    totalSize,
                                    done: query.done,
                                    fetched,
                                };
                                return records;
                            }

                            case 'search': {
                                const sosl = msg.payload;
                                if (!sosl || typeof sosl !== 'string') {
                                    throw new Error(
                                        'SOSL query must be provided in msg.payload'
                                    );
                                }
                                const searchResult = await conn.search(sosl);
                                msg.sfResponse = searchResult;
                                return (
                                    searchResult.searchRecords || searchResult
                                );
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

                            case 'retrieve': {
                                if (!sobject) {
                                    throw new Error(
                                        'Salesforce sObject is required for retrieve'
                                    );
                                }
                                let recordIds =
                                    msg.payload !== undefined
                                        ? msg.payload
                                        : msg.ids;
                                if (
                                    recordIds &&
                                    typeof recordIds === 'object' &&
                                    !Array.isArray(recordIds) &&
                                    recordIds !== null &&
                                    recordIds.Id
                                ) {
                                    recordIds = recordIds.Id;
                                }
                                if (
                                    recordIds === undefined ||
                                    recordIds === null ||
                                    (typeof recordIds !== 'string' &&
                                        !Array.isArray(recordIds))
                                ) {
                                    throw new Error(
                                        'Record Id or array of Ids is required in msg.payload'
                                    );
                                }
                                return conn
                                    .sobject(sobject)
                                    .retrieve(recordIds);
                            }

                            case 'describe': {
                                if (!sobject) {
                                    throw new Error(
                                        'Salesforce sObject is required for describe'
                                    );
                                }
                                return conn.sobject(sobject).describe();
                            }

                            case 'describeglobal': {
                                return conn.describeGlobal();
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
                let statusMessage;
                switch (operation) {
                    case 'query': {
                        const records = result.records;
                        const size = Array.isArray(records)
                            ? records.length
                            : 0;
                        statusMessage = size + ' records';
                        break;
                    }
                    case 'search': {
                        const matches = Array.isArray(result)
                            ? result.length
                            : 0;
                        statusMessage = matches + ' matches';
                        break;
                    }
                    case 'describe':
                        statusMessage = 'describe ok';
                        break;
                    case 'describeglobal':
                        statusMessage = 'describe global ok';
                        break;
                    case 'retrieve':
                        statusMessage = 'retrieve ok';
                        break;
                    default: {
                        const label = operation || 'operation';
                        statusMessage = label + ' ok';
                        break;
                    }
                }

                status.success(node, statusMessage);

                send(msg);
                done();
            } catch (err) {
                msg.error = err;
                status.error(node, err.message);
                node.error(err.message, msg);
                done(err);
            }
        });
    }

    RED.nodes.registerType('salesforce-operation', SalesforceOperationNode);
};
