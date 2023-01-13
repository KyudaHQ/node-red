const fetch = require('node-fetch');
const logger = require('../util/logger');
const status = require('../util/nodeStatus');

const KYUDA_FLOW_TOKEN = process.env.KYUDA_FLOW_TOKEN;

module.exports = function (RED) {

  function invokeSource(source_uid, pipeline_uid, payload) {
    return fetch(`https://api.kyuda.io/v1/flows-api/invoke-source`, {
      method: 'post',
      body: JSON.stringify({
        source_uid,
        event: payload,
        control: {}
      }),
      headers: { 'Authorization': `Bearer ${KYUDA_FLOW_TOKEN}` }
    })
      .then(response => response.json());
  }

  function KyudaInvokeSourceNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.on('input', async function (msg) {
      try {
        status.info(node, 'processing');
        const result = await invokeSource(node.id, config.sourceUid, msg.payload)
        msg.payload = result;
        status.clear(node);
        return node.send(msg);
      } catch (err) {
        node.error(err.message, msg);
        status.error(node, err.message);
      }
    })
  }

  RED.nodes.registerType('kyuda-invoke-source', KyudaInvokeSourceNode);

  RED.httpAdmin.get('/kyuda/sources', async function (req, res) {
    return fetch(`https://api.kyuda.io/v1/flows-api/get-sources`, {
      method: 'get',
      headers: { 'Authorization': `Bearer ${KYUDA_FLOW_TOKEN}` }
    })
      .then(response => response.json())
      .then(json => {
        return res.json(json)
      })
  })
}
