const logger = require('../util/logger');
const status = require('../util/nodeStatus');

module.exports = function (RED) {
    'use strict';

    function SalesforceApexNode(config) {
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

            const path = msg.path || config.path;
            const operation = (
                msg.operation ||
                config.operation ||
                ''
            ).toLowerCase();

            if (!path) {
                const err = new Error('Apex REST path is required');
                status.error(node, err.message);
                node.error(err.message, msg);
                done(err);
                return;
            }

            status.info(node, 'processing');

            try {
                const result = await node.salesforceConfig.withConnection(
                    msg,
                    async function (conn) {
                        switch (operation) {
                            case 'get':
                                return conn.apex.get(path);
                            case 'post':
                                return conn.apex.post(path, msg.payload);
                            case 'put':
                                return conn.apex.put(path, msg.payload);
                            case 'patch':
                                return conn.apex.patch(path, msg.payload);
                            case 'delete':
                                return conn.apex.delete(path, msg.payload);
                            default:
                                throw new Error(
                                    'Unsupported Apex operation: ' + operation
                                );
                        }
                    }
                );

                msg.payload = result;
                status.success(node, operation + ' ok');
                send(msg);
                done();
            } catch (err) {
                // Any rejection from acquiring the connection or executing the Apex REST call
                // will land here, after the awaited operation resolves. Report via node.error
                // and let done(err) signal the runtime without emitting the faulty message.
                msg.error = err;
                status.error(node, err.message);
                node.error(err.message, msg);
                done(err);
            }
        });
    }

    RED.nodes.registerType('salesforce-apex', SalesforceApexNode);
};
