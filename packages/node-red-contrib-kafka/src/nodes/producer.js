const logger = require('../util/logger');
const status = require('../util/nodeStatus');

module.exports = function (RED) {
  const { Kafka } = require('kafkajs');

  function KafkaProducerNode(config) {
    RED.nodes.createNode(this, config);
    var node = this;

    node.kafka = config.kafka;
    node.kafkaConfig = RED.nodes.getNode(node.kafka);

    const kafka = new Kafka(node.kafkaConfig.kafkaOptions);

    const producerOptions = new Object();

    node.on('input', async function (msg) {
      status.clear(node);

      try {
        await node.producer.send({
          topic: msg.topic,
          messages: [
            msg.payload
          ],
        })
        status.success(node, ``);
      } catch (err) {
        node.error(err.message, msg);
        status.error(node, err.message);
      }
    })

    node.init = async function init() {
      node.producer = kafka.producer(producerOptions);
      node.status({ fill: "yellow", shape: "ring", text: "Initializing" });

      node.onConnect = function () {
        node.lastMessageTime = new Date().getTime();
        node.status({ fill: "green", shape: "ring", text: "Ready" });
      }

      node.onDisconnect = function () {
        node.status({ fill: "red", shape: "ring", text: "Disconnected" });
      }

      node.producer.on(node.producer.events.CONNECT, node.onConnect);
      node.producer.on(node.producer.events.DISCONNECT, node.onDisconnect);

      await node.producer.connect();
    }

    node.init().catch(err => {
      node.error(err.message);
    });

    node.on('close', async function (done) {
      try {
        await node.consumer.disconnect();
        node.status({});
        clearInterval(node.interval);
        done();
      } catch (err) {
        node.error(err.message);
      }
    });

  }

  RED.nodes.registerType('kafka-producer', KafkaProducerNode);
}
