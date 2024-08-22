
const request = require('request-promise-native')

const j = request.jar();
const r = request.defaults({
  jar: j, followAllRedirects: true
});

module.exports = function (RED) {

  function RikaFirenetConfigNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    async function login() {
      console.log('Logging in to Rika Firenet');
      await r.post({ url: 'https://www.rika-firenet.com/web/login', form: { email: config.username, password: config.password } })
    }
    async function read(msg) {
      const result = await r.get({ url: `https://www.rika-firenet.com/api/client/${config.stoveId}/status?nocache=${Date.now()}` })
      return JSON.parse(result);
    }
    async function write(msg) {
      const result = await r.get({ url: `https://www.rika-firenet.com/api/client/${config.stoveId}/status?nocache=${Date.now()}` })
      return JSON.parse(result);
    }

    node.connection = {
      read: async function (msg) {
        try {
          return await read(msg);
        } catch (err) {
          try {
            await login();
            return await read(msg);
          } catch (error) {
            throw new Error('Failed to read data from Rika Firenet');
          }
        }
      },
      write: async function (msg) {
        try {
          return await write(msg);
        } catch (err) {
          try {
            await login();
            return await write(msg);
          } catch (error) {
            throw new Error('Failed to read data from Rika Firenet');
          }
        }
      }
    };
  }

  RED.nodes.registerType('rika-firenet-config', RikaFirenetConfigNode);
}
