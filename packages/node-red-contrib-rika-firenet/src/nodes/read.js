const logger = require('../util/logger');
const status = require('../util/nodeStatus');

module.exports = function (RED) {

  function RikaFirenetReadNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.rikaFirenet = config.rikaFirenet;
    node.rikaFirenetConfig = RED.nodes.getNode(node.rikaFirenet);

    node.on('input', async function (msg) {
      try {
        status.info(node, 'processing');
        const result = await node.rikaFirenetConfig.connection.read();
        msg.payload = result;
        status.successRing(node, `${result.name} ${result.sensors.inputRoomTemperature}°C`);
        return node.send(msg);
      } catch (err) {
        node.error(err.message, msg);
        status.error(node, err.message);
      }
    })
  }

  RED.nodes.registerType('rika-firenet-read', RikaFirenetReadNode);
}
