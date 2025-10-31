const logger = require('../util/logger');
const status = require('../util/nodeStatus');

module.exports = function (RED) {
    'use strict';

    function SalesforceStreamNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.salesforce = config.salesforce;
        node.salesforceConfig = RED.nodes.getNode(node.salesforce);
        node.topic = config.topic;

        let subscription;

        if (!node.salesforceConfig) {
            const err = new Error('Missing Salesforce configuration');
            node.error(err.message);
            status.error(node, err.message);
            return;
        }

        if (!node.topic) {
            const err = new Error('Streaming topic is required');
            node.error(err.message);
            status.error(node, err.message);
            return;
        }

        if (node.salesforceConfig.loginType === 'Signed-Request') {
            const err = new Error(
                'Salesforce streaming node does not support Signed-Request authentication'
            );
            node.error(err.message);
            status.error(node, err.message);
            return;
        }

        async function connect() {
            status.warningRing(node, 'connecting');

            try {
                await node.salesforceConfig.withConnection(
                    null,
                    async function (conn) {
                        status.infoRing(node, 'connected');
                        subscription = conn.streaming
                            .topic(node.topic)
                            .subscribe(function (message) {
                                status.successRing(node, 'event');
                                node.send({ payload: message });
                            });
                    }
                );
            } catch (err) {
                status.error(node, err.message);
                node.error(err.message);
            }
        }

        connect();

        node.on('close', function (done) {
            try {
                if (subscription) {
                    if (typeof subscription.cancel === 'function') {
                        subscription.cancel();
                    } else if (typeof subscription.unsubscribe === 'function') {
                        subscription.unsubscribe();
                    }
                }
            } finally {
                subscription = null;
                status.clear(node);
                done();
            }
        });
    }

    RED.nodes.registerType('salesforce-stream', SalesforceStreamNode);
};
