# Trivy CVE fixes — tajir-block-explorer (frontend)

Safe baseline (next, axios, etc.) already applied on `security/trivy-baseline`.
**Run `yarn install` first** (regenerates yarn.lock — clears brace-expansion/js-cookie the baseline
already pins). Then apply the fixes below → `yarn build` → **click-test the UI** → push (CI scans on push).

**Done =** `trivy image --severity HIGH,CRITICAL` → 0, build passes, UI works.

## Direct deps (bump in `dependencies`)
- `path-to-regexp` → `8.4.0`
- **OpenTelemetry — bump the whole `@opentelemetry/*` set together** (half a bump breaks telemetry init;
  `exporter-jaeger` may be dropped in new OTEL):
  - `@opentelemetry/sdk-node` → `0.217.0`
  - `@opentelemetry/auto-instrumentations-node` → `0.75.0`
  - + `exporter-*`, `resources`, `sdk-trace-node`, `semantic-conventions` → matching 2.x

## `resolutions` — single major (add/bump)
- `protobufjs` → `7.5.6`  🔴 CRITICAL
- `node-forge` → `1.4.0`  ⚠️ bump the 3 existing `1.3.2` entries
- `ws` → `8.21.0`  ⚠️ bump the existing `8.17.1` entries
- `swagger-ui-react/**/js-yaml` → `4.3.1`  (bump existing `4.1.1`)
- `@opentelemetry/propagator-jaeger` → `2.9.0`
- `@libp2p/kad-dht` → `16.2.6`
- `ip-address` → `10.3.1`
- `h3` → `1.15.6`
- `hono` → `4.12.25`
- `immutable` → `5.1.8`
- `defu` → `6.1.5`
- `flatted` → `3.4.2`
- `@babel/plugin-transform-modules-systemjs` → `7.29.4`
- `undici` → `6.27.0`
- `sharp` → `0.35.0`
- `sigstore` → `4.1.1`
- `serialize-javascript` → `7.0.3`
- `socket.io-parser` → `4.2.6`
- `postcss` → `8.5.18`

## Multi-major — path-scope per version (do NOT global-pin)
- `tar` → `7.5.19`  🔴 CRITICAL  (at 6.2.1 + 7.4.3; tar 7 = breaking API)
- `minimatch` → per path: `9.0.7` / `7.4.8` / `5.1.8` / `3.1.3`
- `nanoid` → `3.3.17` (3.x path) / `5.1.16` (5.x path)
- `glob`, `picomatch` → per major

## Gotchas
- `lodash` — **leave at `4.17.21`**; `4.18.0` is a bad publish (yarn refuses). Waive CVE-2026-4800.
- `js-cookie` / `brace-expansion` resolutions didn't apply in one build — re-verify after `yarn install`.

## Dockerfile
- Add `RUN apk --no-cache upgrade` in the `runner` stage (fixes `musl-utils` base CVE).
