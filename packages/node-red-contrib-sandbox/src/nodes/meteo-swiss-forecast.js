const fetch = require('node-fetch');
const logger = require('../util/logger');
const status = require('../util/nodeStatus');

module.exports = function (RED) {

  function getForecast(msg, location) {
    const context = {
      message_id: msg._msgid
    }
    const control = {
      summary: msg._msgid
    }
    return fetch(`https://app-prod-ws.meteoswiss-app.ch/v1/stationOverview?station=${location}`, {
      method: 'get',
      headers: {
      },
    })
      .then(response => response.json());
  }

  function SanboxMeteoSwissForecastNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.on('input', async function (msg) {
      try {
        status.info(node, 'processing');
        const result = await getForecast(msg, config.location)
        msg.payload = result;
        status.clear(node);
        return node.send(msg);
      } catch (err) {
        node.error(err.message, msg);
        status.error(node, err.message);
      }
    })
  }

  RED.nodes.registerType('sandbox-meteo-swiss-forecast', SanboxMeteoSwissForecastNode);

  RED.httpAdmin.get('/sandbox/meteo-swiss/locations', async function (req, res) {
    res.json([
      { id: "MTR", name: 'Matro' },
      { id: "COM", name: 'Acquarossa / Comprovasco' },
    ])
  })
}
