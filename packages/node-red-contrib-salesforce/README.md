# node-red-contrib-salesforce

[![Platform](https://img.shields.io/badge/platform-Node--RED-red)](https://nodered.org)
![Release](https://img.shields.io/npm/v/@kyuda/node-red-contrib-salesforce.svg)
![NPM](https://img.shields.io/npm/dm/@kyuda/node-red-contrib-salesforce.svg)

This module leverages the [JSforce](https://github.com/jsforce/jsforce) client library (v3) to bring Salesforce awesomeness to Node-RED!

## What’s Included
- Config node supporting Username/Password and OAuth 2.0 flows with automatic token refresh.
- Runtime nodes for CRUD operations, SOQL/SOSL, metadata describes, Apex REST invocations, Chatter API calls, and Streaming events.
- Stream listeners now support replay Ids and EMP channel paths (topics, platform events, change data capture).
- Updated for JSforce v3 with promise-based internals and improved error handling.

## Credits

The package is developed and maintained by [Kyuda](https://www.kyuda.io/).