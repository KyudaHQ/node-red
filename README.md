# Kyuda's Node-RED

[![platform](https://img.shields.io/badge/platform-Node--RED-red)](https://nodered.org)

This repository provides a set of modules and nodes in Node-RED to quickly create integrations.
These nodes require NodeJS version 16 or more recent.

## Modules

 * node-red-contrib-aws-ses
 * node-red-contrib-camunda
 * node-red-contrib-google
 * node-red-contrib-google-cloud
 * node-red-contrib-graphql
 * node-red-contrib-influxdb
 * node-red-contrib-kafka
 * node-red-contrib-kyuda
 * node-red-contrib-logtail
 * node-red-contrib-minio
 * node-red-contrib-papertrail
 * node-red-contrib-rabbitmq-bus
 * node-red-contrib-salesforce
 * node-red-contrib-zeebe

## Quick Start

The following environment variables are required to run:
 * AUTH0_DOMAIN
 * AUTH0_CLIENT_ID
 * AUTH0_CLIENT_SECRET
 * AUTH0_CALLBACK_URL
 * FLOW_UID


 * `docker run -p 1880:1880 --env-file ./packages/node-red/.env kyuda/node-red:2.0.0`

## Developers

 * `npm run dev`
 * `npx lerna publish`
 * `npx lerna publish --force-publish`
 * `docker buildx build --platform=linux/amd64,linux/arm64 --push --tag kyuda/node-red:latest ./packages/node-red`
 * `docker buildx build --platform=linux/amd64,linux/arm64 --push --tag kyuda/node-red:2.0.0 ./packages/node-red`

## Authors

Node-RED is a project of the [OpenJS Foundation](http://openjsf.org).

This repository is maintained by:
 * Lorenzo Casari [@ilzenzo](http://twitter.com/ilzenzo)