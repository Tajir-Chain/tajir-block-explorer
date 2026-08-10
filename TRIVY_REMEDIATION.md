# Trivy CVE remediation — tajir-block-explorer (frontend)

**Goal:** the weekly supply-chain Trivy scan gates on `HIGH,CRITICAL` and this image currently
fails it. Get the image to **0 HIGH/CRITICAL**, with the app still building and rendering.

**Stack:** Blockscout frontend fork · yarn-classic (1.22) · Next.js standalone build ·
image `docker.io/tajirchain/tajir-block-explorer`.

Infra (Nauman) applied the safe/low-risk bumps to get you a **building baseline** and cleared the
CRITICALs. The remaining set needs someone who can build + click-test the UI — that's you. Below is
exactly what's done, the traps we already hit, and what's left.

---

## How to work it

- **Direct deps** → bump the version in `package.json` (`dependencies`/`devDependencies`).
- **Transitive deps** → pin the fixed version in the **`resolutions`** block. For a package that
  exists at multiple majors in the tree, use a **path-scoped** key (e.g. `some-parent/**/pkg`), not
  a bare global — a global forces every consumer onto one major and breaks the others.
- After edits: `yarn install` → rebuild → re-scan. Commit **`package.json` + `yarn.lock`** together.

**Fast loop (no docker build) — for the dependency CVEs:**
```bash
yarn install
trivy fs --severity HIGH,CRITICAL --skip-dirs node_modules yarn.lock
```
**Final confirmation (base layer + deps together):**
```bash
docker build -t tajir-block-explorer:local .
trivy image --severity HIGH,CRITICAL tajir-block-explorer:local
```

---

## ✅ Already applied (safe baseline — in package.json)

| Package | Set to | Where |
|---|---|---|
| `next`, `@next/bundle-analyzer` | 15.5.21 | direct |
| `axios` | 1.18.0 | global + 2 scoped resolutions |
| `brace-expansion` | 2.1.4 (+ `eslint/**` scope 1.1.18) | resolution |
| `@grpc/grpc-js` | 1.14.4 | resolution |
| `form-data` | 4.0.6 | resolution |
| `js-cookie` | 3.0.7 | resolution ⚠️ (see gotcha — didn't apply) |
| `linkify-it` | 5.0.2 | resolution |

This cleared the 4 CRITICALs and roughly half the HIGHs.

---

## ⚠️ Traps we already hit (save yourself the time)

1. **`lodash` — do NOT bump to 4.18.0.** yarn rejects it: *"Bad release, use 4.17.21."* The CVE
   (CVE-2026-4800, `_.template` code-exec) has **no usable fixed release** on the 4.x line. Keep
   `4.17.21` and **waive that CVE** (it's the `template` import path — confirm you don't use
   `_.template` with untrusted input; if not, it's not reachable). Waiver is a joint call with infra
   (lives in the infra `.trivyignore.yaml`).
2. **`axios` and `next` cascade fast** — 1.16→1.18, 15.5.18→15.5.21 within days. Always take the
   **latest patch** of the line, re-scan, don't assume the first "fixed version" is still current.
3. **`js-cookie` resolution didn't take** — set to 3.0.7 but the tree still resolved 3.0.5.
   Investigate (may need the direct dep bumped to `^3.0.7`, or a path-scoped resolution).
4. **`brace-expansion` 1.x tops out at 1.1.18** (no 1.1.20) — that's the max for the eslint-scoped
   1.x pin; it clears all three brace-expansion CVEs.
5. **Existing `swagger-ui-react/**/js-yaml: 4.1.1` resolution is now itself flagged** — bump it to
   `4.3.1` (js-yaml DoS CVE-2026-59869 / GHSA-5p4m-2wfm-xmqj).

---

## 🔧 Remaining work (yours — build + UI test after each)

**Coordinated / major (need judgment + testing):**
- **OpenTelemetry cluster** — bump ALL `@opentelemetry/*` direct deps together to a mutually
  compatible release (sdk-node→0.217.x, auto-instrumentations-node→0.75.x, and the stable
  `resources`/`sdk-trace-node`/`semantic-conventions`/`exporter-*` to their matching 2.x). Note
  **`@opentelemetry/exporter-jaeger` may be removed** in newer OTEL — you may need to drop/replace
  it. A half-done OTEL bump breaks telemetry init, so move them as a set.
- **`@libp2p/kad-dht`** 15→16.2.6 (transitive via `@helia/verified-fetch` / IPFS)
- **`ip-address`** 9→10.3.1 (transitive)

**Multi-major transitive (path-scope, don't global-pin):**
- **`minimatch`** — present at 3.1.2 / 5.1.6 / 7.4.6 / 9.0.5 → pin each path to its line's fixed
  patch (9.0.7, 7.4.8, 5.1.8, 3.1.3, …)
- **`nanoid`** — present at 3.3.11 and 5.1.6 → 3.3.17 for the 3.x path, 5.1.16 for the 5.x path
- **`glob`** — multiple majors; pin per-path

**Straight transitive bumps (resolutions):**
- `h3` → 1.15.6, `hono` → 4.12.25, `immutable` → 4.3.9/5.1.8, `defu` → 6.1.5,
  `flatted` → 3.4.2, `@babel/plugin-transform-modules-systemjs` → 7.29.4
- **`node-forge` → 1.4.0** — ⚠️ it's *already* pinned to 1.3.2 in `resolutions` (3 scoped keys:
  `@helia/verified-fetch/**`, `@reown/appkit/**`, `@reown/appkit-adapter-wagmi/**`), and 1.3.2 is
  now flagged with 4 CVEs incl. **auth-bypass / cert-validation-bypass**. Bump all three to 1.4.0.
- `path-to-regexp` → 8.4.0 (direct dep, currently `8.1.0`), `picomatch` → 2.3.2 / 4.0.4 (multi-major)

**Base layer (Dockerfile):**
- `musl-utils` 1.2.5-r9 → r11: the **runner** stage (`FROM node:22.14.0-alpine AS runner`) does
  `apk add --no-cache --upgrade bash curl jq unzip` — that only upgrades the *named* packages. Add a
  full `RUN apk --no-cache upgrade` in the runner stage (or bump the node base tag).

---

## Definition of done
```bash
trivy fs --severity HIGH,CRITICAL --skip-dirs node_modules yarn.lock   # → 0 (or only agreed waivers)
docker build -t tajir-block-explorer:local . && \
trivy image --severity HIGH,CRITICAL tajir-block-explorer:local        # → 0
yarn build                                                             # succeeds
# + app runs and renders normally (esp. after next + OTEL changes)
```

## Hand back
- PR in this repo with `package.json` + `yarn.lock` (+ `Dockerfile` for musl).
- Flag anything you couldn't safely bump → we waive it (scoped + justification) jointly with infra.
- Once CI republishes the fixed image, **send Nauman the new tag/digest** — he re-pins it in
  `tajir-op-infra` (`ansible/inventory/group_vars/all.yml`) so the weekly scan goes green.
