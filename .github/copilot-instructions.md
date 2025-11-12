# Node-RED Monorepo – AI Assistant Guide

These instructions help Copilot (or any automation) make sensible changes inside this repository.

## Repository Shape
- **Monorepo:** `lerna` manages packages in `packages/*`. Each package ships its own `package.json`, `README.md`, and `src/` tree.
- **Primary Runtime:** `packages/node-red` contains the Kyuda-branded Node-RED runtime and docker image build context.
- **Add-on Nodes:** All other packages (`node-red-contrib-*`) wrap third-party services or SDKs. Prefer cloning the closest package to start new work.
- **Docs:** High-level wrapping guidance lives in `WRAPPING_NODE_PACKAGES.md` at the repo root. Read it before generating new nodes.

## Coding Patterns
- **Config vs Runtime:** Every integration exposes at least one config node (`src/nodes/config.js`) and one or more runtime nodes (`src/nodes/*.js`). Config nodes instantiate clients (AWS SDK, Apollo, KafkaJS, etc.) and store helper methods. Runtime nodes fetch the config with `RED.nodes.getNode`, merge `msg` overrides with editor defaults, call helpers, and set `msg.payload`.
- **Status & Logging:** Use `src/util/nodeStatus.js` for consistent status updates. Only add logging when it aids debugging—prefer the existing utilities.
- **Editor UI:** Each node requires a matching `.html` file defining palette metadata, edit dialog, and optional admin endpoints. Keep OAuth flows and dynamic dropdowns in the HTML/HTTP admin layer.
- **Lifecycle:** For long-lived clients (Kafka, gRPC), initialize connections in `node.init()` and tear down inside `node.on('close', done => { ... })` to avoid resource leaks.
- **Async Handling:** Runtime handlers should be `async` when calling SDKs. Wrap logic in `try/catch` blocks and report errors via `node.error` plus status updates.

## Style & Tooling
- **Language:** JavaScript (CommonJS) in `src/` by default. Follow existing formatting (Prettier config is shared). Avoid introducing non-ASCII characters.
- **Lint/Test:** Tests rely on Jest and `node-red-node-test-helper`. Use `npm test` inside individual packages when adjusting runtime behavior.
- **Environment:** Some packages require environment variables (e.g., `KYUDA_FLOW_TOKEN`). Document new requirements in both README and node editor tooltips.

## When Adding a New Wrapper
1. Duplicate a similar package (REST, GraphQL, messaging, etc.). Update metadata (`package.json`, README badges, `node-red` map).
2. Implement the config node to build and expose the required SDK client.
3. Create runtime nodes that:
   - Resolve the config node.
   - Merge editor defaults with `msg` values.
   - Call config helpers inside `try/catch`.
   - Update `msg.payload` (and optionally `msg.error`).
   - Use `nodeStatus` helpers for user feedback.
4. Build the editor dialog in `.html`. Register any credentials in the config node definition.
5. Add smoke tests if feasible. At minimum, ensure the node registers and basic flows succeed.
6. Update docs: README section, CHANGELOG entry if releasing, and mention any env vars.

## Pull Request Expectations
- Keep commits scoped to one package unless changes are cross-cutting (e.g., shared utility updates).
- Mention testing performed (`npm test`, flow validation, etc.).
- Ensure Docker workflow still builds when touching `packages/node-red` runtime files.

Following these guidelines will keep automated changes consistent with the existing ecosystem and minimize review churn. For deeper context, refer to `WRAPPING_NODE_PACKAGES.md` and existing `node-red-contrib-*` packages.
