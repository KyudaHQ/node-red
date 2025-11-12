const logger = require('../util/logger');
const status = require('../util/nodeStatus');

module.exports = function (RED) {
    'use strict';

    function SalesforceChatterNode(config) {
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
                const err = new Error('Chatter resource path is required');
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
                        const resource = conn.chatter.resource(path);
                        switch (operation) {
                            case 'retrieve':
                                return resource.retrieve();
                            case 'create':
                                return resource.create(msg.payload);
                            default:
                                throw new Error(
                                    'Unsupported Chatter operation: ' +
                                        operation
                                );
                        }
                    }
                );

                msg.payload = result;
                status.success(node, operation + ' ok');
                send(msg);
                done();
            } catch (err) {
                // Connection acquisition or Chatter call failures surface here after awaiting
                // the operation. Report via node.error and signal completion without emitting.
                msg.error = err;
                status.error(node, err.message);
                node.error(err.message, msg);
                done(err);
            }
        });
    }

    RED.nodes.registerType('salesforce-chatter', SalesforceChatterNode);
};
