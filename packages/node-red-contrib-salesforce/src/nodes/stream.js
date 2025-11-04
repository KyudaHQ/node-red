const status = require('../util/nodeStatus');
const { StreamingExtension } = require('jsforce/api/streaming');

module.exports = function (RED) {
    'use strict';

    function SalesforceStreamNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.salesforce = config.salesforce;
        node.salesforceConfig = RED.nodes.getNode(node.salesforce);
        node.topic = config.topic;
        node.replayId = config.replayId;

        const DEFAULT_RECONNECT_DELAY_MS = 5000;
        const MAX_RECONNECT_DELAY_MS = 60000;
        const envDelay = parseInt(process.env.KYUDA_STREAM_RETRY_MS, 10);
        node._baseReconnectDelay =
            Number.isFinite(envDelay) && envDelay > 0
                ? envDelay
                : DEFAULT_RECONNECT_DELAY_MS;

        let subscription;
        let reconnectTimer;
        let closing = false;
        let retryCount = 0;
        let activeClient = null;
        let clientTransportBinding = null;
        let replayExtension;

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

            const err = new Error(
                'Replay Id must be an integer or "latest"/"all" keyword'
            );
            err.retryable = false;
            throw err;
        }

        function detachSubscriptionListeners(instance) {
            if (
                instance &&
                typeof instance.removeListener === 'function' &&
                instance.__errorHandler
            ) {
                instance.removeListener('error', instance.__errorHandler);
                instance.__errorHandler = null;
            }
        }

        function cancelSubscription(instance) {
            if (!instance) {
                return;
            }
            try {
                if (typeof instance.cancel === 'function') {
                    instance.cancel();
                } else if (typeof instance.unsubscribe === 'function') {
                    instance.unsubscribe();
                }
            } catch (cancelErr) {
                node.log(
                    'Failed to cancel streaming subscription: ' +
                        (cancelErr && cancelErr.message
                            ? cancelErr.message
                            : cancelErr)
                );
            }
        }

        function detachClientListeners(client) {
            if (
                !client ||
                !clientTransportBinding ||
                clientTransportBinding.client !== client
            ) {
                return;
            }
            if (typeof client.unbind === 'function') {
                client.unbind('transport:down', clientTransportBinding.handler);
            }
            clientTransportBinding = null;
        }

        function disposeActiveClient() {
            if (!activeClient) {
                return;
            }
            try {
                node.log(
                    'Salesforce stream disposing streaming client for ' +
                        node.topic
                );
                detachClientListeners(activeClient);
                if (typeof activeClient.disconnect === 'function') {
                    activeClient.disconnect();
                }
            } catch (clientErr) {
                node.log(
                    'Failed to dispose streaming client: ' +
                        (clientErr && clientErr.message
                            ? clientErr.message
                            : clientErr)
                );
            } finally {
                activeClient = null;
            }
        }

        function resetReplayTracking() {
            if (replayExtension) {
                try {
                    if (typeof replayExtension.setChannel === 'function') {
                        replayExtension.setChannel(null);
                    }
                    if (typeof replayExtension.setReplay === 'function') {
                        replayExtension.setReplay(null);
                    }
                } catch (resetErr) {
                    node.log(
                        'Failed to reset replay extension: ' +
                            (resetErr && resetErr.message
                                ? resetErr.message
                                : resetErr)
                    );
                }
            }
            replayExtension = null;
        }

        function ensureReplayExtension(channel, initialReplay) {
            if (
                replayExtension &&
                typeof replayExtension.setChannel === 'function' &&
                replayExtension._channel === channel
            ) {
                return replayExtension;
            }
            replayExtension = new StreamingExtension.Replay(
                channel,
                initialReplay
            );
            return replayExtension;
        }

        function getEventEnvelope(message) {
            if (!message || typeof message !== 'object') {
                return null;
            }
            if (message.event && typeof message.event === 'object') {
                return message.event;
            }
            if (
                message.data &&
                message.data.event &&
                typeof message.data.event === 'object'
            ) {
                return message.data.event;
            }
            return null;
        }

        function getReplayId(message) {
            const event = getEventEnvelope(message);
            if (
                event &&
                Object.prototype.hasOwnProperty.call(event, 'replayId')
            ) {
                return event.replayId;
            }
            if (
                message &&
                typeof message === 'object' &&
                Object.prototype.hasOwnProperty.call(message, 'replayId')
            ) {
                return message.replayId;
            }
            return undefined;
        }

        function getEventUuid(message) {
            const event = getEventEnvelope(message);
            if (!event) {
                return undefined;
            }
            if (Object.prototype.hasOwnProperty.call(event, 'EventUuid')) {
                return event.EventUuid;
            }
            if (Object.prototype.hasOwnProperty.call(event, 'uuid')) {
                return event.uuid;
            }
            return undefined;
        }

        function normalizeReplayValue(value) {
            if (value === undefined || value === null) {
                return undefined;
            }
            if (typeof value === 'number' && Number.isFinite(value)) {
                return value;
            }
            const parsed = Number(value);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
            return value;
        }

        function formatStatusMessage(message) {
            const uuid = getEventUuid(message);
            const replay = normalizeReplayValue(getReplayId(message));
            const parts = [];
            if (uuid) {
                parts.push('uuid:' + uuid);
            }
            if (replay !== undefined) {
                parts.push('replay:' + replay);
            }
            if (parts.length === 0) {
                return 'message received';
            }
            return parts.join(' ');
        }

        function scheduleReconnect(err) {
            // Avoid runaway loops when node is closing, we already have a timer,
            // or the error is marked non-retryable (misconfiguration, bad channel, etc.).
            if (closing || reconnectTimer || (err && err.retryable === false)) {
                return;
            }

            // Base delay defaults to 5s but can be overridden via config/env; we apply
            // a capped exponential backoff (x1, x2, x4, x8) up to MAX_RECONNECT_DELAY_MS
            // to balance quick recovery with avoiding rapid reconnect storms.
            const configuredDelay = node._baseReconnectDelay;
            const baseDelay =
                Number.isFinite(configuredDelay) && configuredDelay > 0
                    ? configuredDelay
                    : DEFAULT_RECONNECT_DELAY_MS;
            const exponent = Math.min(retryCount, 3);
            const delay = Math.min(
                MAX_RECONNECT_DELAY_MS,
                baseDelay * Math.pow(2, exponent)
            );
            const attempt = retryCount + 1;
            retryCount = Math.min(retryCount + 1, 4);

            status.warningRing(
                node,
                'reconnecting in ' + Math.round(delay / 1000) + 's'
            );

            const reason = err && err.message ? err.message : err;
            node.log(
                'Salesforce stream reconnect attempt ' +
                    attempt +
                    ' for ' +
                    node.topic +
                    ' in ' +
                    delay +
                    'ms' +
                    (reason ? ' (reason: ' + reason + ')' : '')
            );

            reconnectTimer = setTimeout(function () {
                reconnectTimer = null;
                connect();
            }, delay);
        }

        function handleSubscriptionError(err) {
            if (closing) {
                return;
            }
            const message =
                (err && err.message) ||
                (typeof err === 'string'
                    ? err
                    : 'Streaming subscription error');
            node.log('Salesforce stream subscription error: ' + message);
            status.error(node, message);
            node.error('Streaming subscription error: ' + message);
            detachSubscriptionListeners(subscription);
            cancelSubscription(subscription);
            subscription = null;
            disposeActiveClient();
            const error = err instanceof Error ? err : new Error(message);
            scheduleReconnect(error);
        }

        async function connect() {
            if (closing) {
                return;
            }

            status.warningRing(node, 'connecting');

            try {
                // Parse and validate the requested replay Id before doing any network work.
                const replay = parseReplayId(node.replayId);

                await node.salesforceConfig.withConnection(
                    null,
                    async function (conn) {
                        const streaming = conn.streaming || {};
                        if (typeof streaming.subscribe !== 'function') {
                            const err = new Error(
                                'Salesforce connection does not have streaming support'
                            );
                            err.retryable = false;
                            throw err;
                        }

                        const channelPath = node.topic;
                        const canonicalChannel =
                            typeof channelPath === 'string' &&
                            channelPath.startsWith('/')
                                ? channelPath
                                : '/topic/' + channelPath;

                        node.log(
                            'Salesforce stream preparing subscription for ' +
                                canonicalChannel
                        );

                        const handleMessage = function (message) {
                            const replayValueRaw = getReplayId(message);
                            const replayValue =
                                normalizeReplayValue(replayValueRaw);
                            if (replayValue !== undefined) {
                                node.log(
                                    'Salesforce stream received replay ' +
                                        replayValue +
                                        ' on ' +
                                        canonicalChannel
                                );
                            } else {
                                node.log(
                                    'Salesforce stream received message without replay id on ' +
                                        canonicalChannel
                                );
                            }
                            status.successRing(
                                node,
                                formatStatusMessage(message)
                            );
                            node.send({ payload: message });
                        };

                        // Clean up any stale client before creating a new one.
                        disposeActiveClient();

                        if (replay === undefined) {
                            node.log(
                                'Salesforce stream subscribing to ' +
                                    canonicalChannel +
                                    ' (tailing latest events)'
                            );
                            subscription = streaming.subscribe(
                                channelPath,
                                handleMessage
                            );
                        } else {
                            if (typeof streaming.createClient !== 'function') {
                                const err = new Error(
                                    'Streaming API replay requires jsforce 1.11 or newer'
                                );
                                err.retryable = false;
                                throw err;
                            }

                            const targetReplay =
                                replayExtension &&
                                replayExtension._replay != null
                                    ? replayExtension._replay
                                    : replay;
                            replayExtension = ensureReplayExtension(
                                canonicalChannel,
                                targetReplay
                            );
                            node.log(
                                'Salesforce stream subscribing to ' +
                                    canonicalChannel +
                                    ' with replay ' +
                                    targetReplay
                            );

                            activeClient = streaming.createClient([
                                replayExtension,
                            ]);

                            if (
                                !activeClient ||
                                typeof activeClient.subscribe !== 'function'
                            ) {
                                const err = new Error(
                                    'Failed to create Salesforce streaming client'
                                );
                                err.retryable = false;
                                throw err;
                            }

                            subscription = activeClient.subscribe(
                                canonicalChannel,
                                handleMessage
                            );

                            if (
                                typeof activeClient.bind === 'function' &&
                                typeof activeClient.unbind === 'function'
                            ) {
                                const downHandler = function () {
                                    handleSubscriptionError(
                                        new Error(
                                            'Streaming transport connection lost'
                                        )
                                    );
                                };
                                activeClient.bind(
                                    'transport:down',
                                    downHandler
                                );
                                clientTransportBinding = {
                                    client: activeClient,
                                    handler: downHandler,
                                };
                            }
                        }

                        if (!subscription) {
                            const err = new Error(
                                'Failed to subscribe to Salesforce streaming channel'
                            );
                            err.retryable = false;
                            throw err;
                        }

                        retryCount = 0;
                        if (
                            subscription &&
                            typeof subscription.on === 'function'
                        ) {
                            subscription.__errorHandler = function (error) {
                                handleSubscriptionError(error);
                            };
                            subscription.on(
                                'error',
                                subscription.__errorHandler
                            );
                        }

                        if (
                            subscription &&
                            typeof subscription.errback === 'function'
                        ) {
                            subscription.errback(function (error) {
                                handleSubscriptionError(error);
                            });
                        }

                        node.log(
                            'Salesforce stream subscription established for ' +
                                canonicalChannel +
                                (replayExtension &&
                                replayExtension._replay != null
                                    ? ' (replay ' +
                                      replayExtension._replay +
                                      ')'
                                    : ' (tailing latest)')
                        );

                        const listeningMsg =
                            replayExtension && replayExtension._replay != null
                                ? 'listening (replay ' +
                                  replayExtension._replay +
                                  ')'
                                : 'listening';
                        status.infoRing(node, listeningMsg);
                    }
                );
            } catch (err) {
                // Async connection/subscription issues end up here once the awaited block rejects.
                // Only schedule reconnects for retryable errors to avoid looping on misconfiguration.
                status.error(node, err.message);
                node.error(err.message);
                scheduleReconnect(err);
            }
        }

        resetReplayTracking();
        connect();

        node.on('close', function (done) {
            closing = true;
            retryCount = 0;
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            try {
                if (subscription) {
                    detachSubscriptionListeners(subscription);
                    cancelSubscription(subscription);
                }
            } finally {
                subscription = null;
                disposeActiveClient();
                resetReplayTracking();
                status.clear(node);
                done();
            }
        });
    }

    RED.nodes.registerType('salesforce-stream', SalesforceStreamNode);
};
