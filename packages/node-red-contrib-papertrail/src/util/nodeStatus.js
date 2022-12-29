module.exports = {
    error: function (node, errorMsg) {
        node.status({
            fill: 'red',
            shape: 'dot',
            text: formatErrorMsg(errorMsg),
        });
    },

    success: function (node, successMsg) {
        node.status({
            fill: 'green',
            shape: 'dot',
            text: successMsg,
        });
    },

    warning: function (node, failureMessage) {
        node.status({
            fill: 'yellow',
            shape: 'dot',
            text: failureMessage,
        });
    },

    info: function (node, infoMessage) {
        node.status({
            fill: 'blue',
            shape: 'dot',
            text: infoMessage,
        });
    },

    errorRing: function (node, errorMsg) {
        node.status({
            fill: 'red',
            shape: 'ring',
            text: formatErrorMsg(errorMsg),
        });
    },

    successRing: function (node, successMsg) {
        node.status({
            fill: 'green',
            shape: 'ring',
            text: successMsg,
        });
    },

    warningRing: function (node, failureMessage) {
        node.status({
            fill: 'yellow',
            shape: 'ring',
            text: failureMessage,
        });
    },

    infoRing: function (node, infoMessage) {
        node.status({
            fill: 'blue',
            shape: 'ring',
            text: infoMessage,
        });
    },

    clear: function (node) {
        node.status({});
    },
};

function formatErrorMsg(errorMsg) {
    errorMsg = errorMsg || 'Unknown Error';
    let result = errorMsg.split(':')[0];
    if (result.length > 30) {
        result = result.substring(0, 30) + '...';
    }
    return result;
}
