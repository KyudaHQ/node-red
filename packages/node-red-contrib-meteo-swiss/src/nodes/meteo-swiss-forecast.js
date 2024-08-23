const fetch = require('node-fetch');
const logger = require('../util/logger');
const status = require('../util/nodeStatus');

module.exports = function (RED) {

  async function getForecast(msg, plz) {
    const context = {
      message_id: msg._msgid
    }
    const control = {
      summary: msg._msgid
    }
    const result = await fetch(`https://app-prod-ws.meteoswiss-app.ch/v1/plzDetail?plz=${plz + '00'}`, {
      method: 'get',
      headers: {
      },
    })
      .then(response => response.json());
    return result
  }

  function MeteoSwissForecastNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.on('input', async function (msg) {
      try {
        status.info(node, 'processing');
        const result = await getForecast(msg, config.plz)
        msg.payload = result;
        status.successRing(node, `${config.plz} ${result.currentWeather.temperature}°C`);
        return node.send(msg);
      } catch (err) {
        node.error(err.message, msg);
        status.error(node, err.message);
      }
    })
  }

  RED.nodes.registerType('meteo-swiss-forecast', MeteoSwissForecastNode);
}
