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
        node.replayId = config.replayId;

        let subscription;
        let reconnectTimer;
        let closing = false;

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

        function parseReplayId(value) {
            if (value === undefined || value === null || value === '') {
                return undefined;
            }

            if (typeof value === 'number' && Number.isInteger(value)) {
                return value;
            }

            const str = String(value).trim().toLowerCase();
            if (str === 'latest') {
                return -1;
            }
            if (str === 'all') {
                return -2;
            }

            const parsed = Number(str);
            if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
                return Math.trunc(parsed);
            }

            throw new Error(
                'Replay Id must be an integer or "latest"/"all" keyword'
            );
        }

        async function connect() {
            if (closing) {
                return;
            }

            status.warningRing(node, 'connecting');

            try {
                const replay = parseReplayId(node.replayId);

                await node.salesforceConfig.withConnection(
                    null,
                    async function (conn) {
                        const channelPath = node.topic;
                        const streaming = conn.streaming || {};
                        const useTopic =
                            channelPath.indexOf('/topic/') === 0 &&
                            typeof streaming.topic === 'function';
                        const channelFactory = useTopic
                            ? streaming.topic(channelPath)
                            : typeof streaming.channel === 'function'
                            ? streaming.channel(channelPath)
                            : null;

                        if (
                            !channelFactory ||
                            typeof channelFactory.subscribe !== 'function'
                        ) {
                            throw new Error(
                                'Streaming API does not support channel ' +
                                    channelPath
                            );
                        }

                        const subscribeArgs = [
                            function (message) {
                                status.successRing(node, 'event');
                                node.send({ payload: message });
                            },
                        ];

                        if (replay !== undefined) {
                            if (channelFactory.subscribe.length >= 2) {
                                subscribeArgs.push(replay);
                            } else {
                                subscribeArgs.push({ replayId: replay });
                            }
                        }

                        subscription = channelFactory.subscribe.apply(
                            channelFactory,
                            subscribeArgs
                        );

                        const listeningMsg =
                            replay !== undefined
                                ? 'listening (replay ' + replay + ')'
                                : 'listening';
                        status.infoRing(node, listeningMsg);
                    }
                );
            } catch (err) {
                status.error(node, err.message);
                node.error(err.message);

                if (!closing && !reconnectTimer) {
                    reconnectTimer = setTimeout(function () {
                        reconnectTimer = null;
                        connect();
                    }, 5000);
                }
            }
        }

        connect();

        node.on('close', function (done) {
            closing = true;
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
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
