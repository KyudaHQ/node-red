const logger = require('../util/logger');
const status = require('../util/nodeStatus');

module.exports = function (RED) {

  function KyudaTriggerPipelineNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.kyuda = config.kyuda;
    node.kyudaConfig = RED.nodes.getNode(node.kyuda);

    node.on('input', async function (msg) {
      try {
        status.info(node, 'processing');
        const result = await node.kyudaConfig.triggerPipeline(config.pipelineUid, msg.payload)
        msg.payload = result;
        status.clear(node);
        return node.send(msg);
      } catch (err) {
        node.error(err.message, msg);
        status.error(node, err.message);
      }
    })
  }

  RED.nodes.registerType('kyuda-trigger-pipeline', KyudaTriggerPipelineNode);
}
