const fetch = require('node-fetch');
const logger = require('../util/logger');
const status = require('../util/nodeStatus');

const KYUDA_FLOW_TOKEN = process.env.KYUDA_FLOW_TOKEN;

module.exports = function (RED) {

  function invokeSource(msg, endpoint) {
    const context = {
      message_id: msg._msgid
    }
    const control = {
      summary: msg._msgid
    }
    return fetch(`https://sdk.kyuda.io/endpoints/${endpoint}/execute`, {
      method: 'put',
      headers: {
        "X-Kyuda-Interface": "flow",
        Authorization: "Bearer " + KYUDA_FLOW_TOKEN,
      },
      body: JSON.stringify({
        event: msg.payload,
        context,
        control
      })
    })
      .then(response => response.json());
  }

  function KyudaInvokeSourceNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.on('input', async function (msg) {
      try {
        status.info(node, 'processing');
        const result = await invokeSource(msg, config.endpoint)
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
