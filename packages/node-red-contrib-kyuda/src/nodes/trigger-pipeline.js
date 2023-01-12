const fetch = require('node-fetch');
const logger = require('../util/logger');
const status = require('../util/nodeStatus');

const KYUDA_FLOW_TOKEN = process.env.KYUDA_FLOW_TOKEN;

module.exports = function (RED) {

  function triggerPipeline(source_uid, pipeline_uid, payload) {
    return fetch(`https://api.kyuda.io/v1/flows-api/trigger-pipeline`, {
      method: 'post',
      body: JSON.stringify({
        pipeline_uid,
        source_uid,
        event: payload,
        control: {}
      }),
      headers: { 'Authorization': `Bearer ${KYUDA_FLOW_TOKEN}` }
    })
      .then(response => response.json());
  }

  function KyudaTriggerPipelineNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.on('input', async function (msg) {
      try {
        status.info(node, 'processing');
        const result = await triggerPipeline(node.id, config.pipelineUid, msg.payload)
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

  RED.httpAdmin.get('/kyuda/pipelines', async function (req, res) {
    return fetch(`https://api.kyuda.io/v1/flows-api/get-pipelines`, {
      method: 'get',
      headers: { 'Authorization': `Bearer ${KYUDA_FLOW_TOKEN}` }
    })
      .then(response => response.json())
      .then(json => {
        return res.json(json)
      })
  })

}
