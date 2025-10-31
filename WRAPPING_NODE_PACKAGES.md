# Wrapping Node.js Packages for Node-RED

This guide captures the conventions that Kyuda follows in this repository when exposing third-party Node.js libraries as Node-RED nodes. Use it as your checklist when onboarding new integrations.

## Monorepo Layout
- Each integration lives in `packages/<package-name>` with its own `package.json`, `README.md`, and `src/` folder.
- `lerna.json` keeps package versions independent. Cloning any existing package is the fastest way to spin up a new one.
- The `node-red` map inside every package's `package.json` declares palette names and points to the runtime JS files in `src/nodes/`.

## Dual-Layer Node Pattern
- **Config node** (`src/nodes/config.js`): builds/owns the underlying SDK client once. Return helpers such as `query`, `mutate`, `sendMail`, etc. Examples: `node-red-contrib-graphql/src/nodes/config.js`, `node-red-contrib-kafka/src/nodes/config.js`, `node-red-contrib-aws-ses/src/nodes/config.js`.
- **Runtime nodes** (`src/nodes/*.js`): stay thin. Read editor defaults from `config`, merge `msg` overrides, call the config helper, update `msg.payload`, and surface errors with `node.error`. See `graphql-query`, `aws-ses-send`, `kafka-producer` for reference.
- Use `async` handlers so `await` takes care of promise plumbing. Always wrap the body with `try/catch` to emit status/error updates consistently.

## Editor & Admin UI
- Every runtime node has a matching `.html` file that defines palette metadata, edit dialog, and optional help. Keep complex UX (OAuth redirects, dynamic dropdowns) in the HTML/HTTP admin layer to keep runtime code clean. Example: `node-red-contrib-google/src/nodes/config.html` manages OAuth, while `config.js` simply consumes stored credentials.
- Expose sensitive values via `credentials` blocks in `RED.nodes.registerType` (see `kafka-config`). This ensures credentials flow through the standard secure storage.
- When runtime metadata must refresh (e.g., Kyuda source list), add lightweight `RED.httpAdmin` endpoints alongside the node (`node-red-contrib-kyuda/src/nodes/invoke-source.js`).

## Shared Utilities
- Reuse `src/util/nodeStatus.js` for status dots and `src/util/logger.js` where logging is needed. If you need more helpers, add them to `src/util/` and keep them generic so other packages can consume them.
- For streaming or long-lived clients, follow existing lifecycle hooks: use `node.init()` to connect, listen for connection events, and implement `node.on('close', async done => { ... })` to tear down resources cleanly (`kafka-producer`, `grpc-call`).

## Implementation Checklist
1. Duplicate the closest existing package (REST, GraphQL, streaming, etc.) and update metadata.
2. Update the config node to instantiate the desired SDK client and expose a small method surface.
3. Implement runtime nodes that:
   - Resolve the config node with `RED.nodes.getNode`.
   - Merge `msg` overrides with editor defaults.
   - Call the config helper inside `try/catch`.
   - Use `status.info/success/error` to signal progress.
   - Set `msg.payload` (and optionally `msg.error`) before forwarding.
4. Build the editor form in the `.html` file with only the fields the SDK truly needs. Provide tooltips and validation where possible.
5. Register credentials fields in the config node declaration if secrets are involved.
6. Add or update tests using `node-red-node-test-helper` when the integration allows for mocking. Even a single smoke test keeps regressions in check.
7. Refresh documentation badges/links in the package README.

## Testing & Publishing
- Use the shared Jest/Husky setup already defined in `package.json` to lint and test (`npm test`).
- Docker builds in `.github/workflows/publish.yml` only target `packages/node-red`. Per-package publication still happens via npm using `lerna publish` or `npm publish` with the correct `directory`.

## When Extending Further
- Factor repeated scaffolding (package template, util imports, lint config) into a generator script if you expect many new wrappers.
- Consider promoting shared utilities to a dedicated internal package if they start to evolve independently.
- Document any nonstandard runtime requirements (env vars, external services) in the package README and surface them in the editor tooltip.

Following this playbook keeps wrappers lightweight, reduces maintenance cost, and ensures a consistent developer and user experience across the Kyuda Node-RED catalogue.
