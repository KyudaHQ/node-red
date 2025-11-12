const noop = () => {};

class Replay {
    constructor(channel, replayId) {
        this._channel = channel;
        this._replay = replayId;
        this._extensionEnabled = true;
    }

    incoming(message, callback) {
        if (typeof callback === 'function') {
            callback(message);
        }
    }

    outgoing(message, callback) {
        if (typeof callback === 'function') {
            callback(message);
        }
    }

    setExtensionEnabled(enabled) {
        this._extensionEnabled = enabled;
    }

    setChannel(channel) {
        this._channel = channel;
    }

    setReplay(replayId) {
        this._replay = replayId;
    }
}

class AuthFailure {
    constructor(handler = noop) {
        this._handler = handler;
    }

    incoming(message, callback) {
        if (message && message.advice && message.advice.reconnect === 'none') {
            this._handler(message);
        }
        if (typeof callback === 'function') {
            callback(message);
        }
    }

    outgoing(message, callback) {
        if (typeof callback === 'function') {
            callback(message);
        }
    }
}

module.exports = {
    StreamingExtension: {
        Replay,
        AuthFailure,
    },
};
