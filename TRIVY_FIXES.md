# Trivy CVE fixes — tajir-block-explorer (frontend)

**Current image scan: 45 HIGH/CRITICAL (42 HIGH, 3 CRITICAL).** Down from ~116.
Branch: `security/trivy-baseline`. The safe baseline (direct-dep bumps + 34 compatible
`resolutions` + base-image `apk upgrade`) is already applied and the image **builds
clean** (`yarn --frozen-lockfile` passes). What's below is the remaining 45.

> These numbers are from the **image** scan (what actually ships), not `trivy fs` on the
> lockfile. A lockfile scan reports a much smaller, misleading number — ignore it.

## How to verify locally (no CI needed)

```bash
# after editing package.json, refresh the lockfile — the build uses --frozen-lockfile
yarn install
yarn install --frozen-lockfile      # MUST pass, or the docker build fails

# build + scan the IMAGE (identical to what CI does)
docker build -t tajir-fe:local .
trivy image --severity HIGH,CRITICAL --scanners vuln tajir-fe:local
```

**Done =** `trivy image` → 0, build passes, UI click-tested. Only push once it's 0.

## ⚠️ The big lesson: `resolutions` alone do NOT fix these

Several packages have a `resolutions` pin **that is not taking effect** — the image still
ships old, deeply-nested duplicate copies. `tar`, `ip-address`, `sigstore`,
`serialize-javascript` are all pinned in `package.json` yet still flagged. So you can't
just add a pin and assume it's fixed — **you must re-scan the image and confirm.** The
real fix is usually to upgrade the *consuming* dependency (the thing that pulls the old
copy) or dedupe, not to add another top-level pin.

## Cluster 1 — `tar` (16 findings, incl. both CRITICALs) — highest priority

Two copies ship: **6.2.1** and **7.4.3**; fix = **7.5.19**. The `tar: 7.5.19` resolution
did NOT dedupe them. Find who pulls each (`yarn why tar`), upgrade those consumers, re-scan.
- CRITICAL `CVE-2026-59873` (gzip-bomb DoS) — on both copies
- + 6 HIGH each (arbitrary file overwrite/create, path traversal, symlink) — `CVE-2026-23745/23950/24842/26960/29786/31802/59874`

## Cluster 2 — the 10 pins that broke the build (removed, still unfixed)

These were pinned but forced a version consumers reject → broke `--frozen-lockfile`, so I
**removed** them (see the `fix(build): drop 10 incompatible yarn resolutions` commit). Their
CVEs are back. Fix each by upgrading the consumer to a version that natively wants the new
major, then re-scan:
| package | installed | fixed |
|---|---|---|
| `glob` | 10.4.5 | 10.5.0 / 11 (Command Injection `CVE-2025-64756`) |
| `picomatch` | 2.3.1 | 2.3.2 / 4 (ReDoS) |
| `ws` | 8.18.3 | 8.21.0 (DoS) |
| `@libp2p/kad-dht` | 15.1.11 | 16.2.6 (unvalidated PUT_VALUE) |
| `postcss` | 8.4.31 | 8.5.12 (info disclosure/DoS) |
| `sharp` | 0.33.5 | 0.35.0 (libvips bundle — 3rd CRITICAL lives here) |
| `nanoid`, `immutable`, `svgo`, `js-yaml` | — | dropped too; re-add scoped only if they resurface in the image scan |

## Cluster 3 — OpenTelemetry (3 findings) — needs a code change

Bump the whole `@opentelemetry/*` set together (a half-bump breaks telemetry init):
- `@opentelemetry/sdk-node` 0.49.1 → **0.217.0**
- `@opentelemetry/auto-instrumentations-node` 0.43.0 → **0.75.0**
- `@opentelemetry/propagator-jaeger` 1.22.0 → **2.9.0**

The 0.217 sdk-node changes the metrics-reader type — `instrumentation.node.ts` (~line 30,
`PeriodicExportingMetricReader` not assignable to `MetricReader`) must be updated. This is
why it was reverted in the baseline; it's a real code edit, not just a version bump.

## Cluster 4 — remaining transitive DoS

- `brace-expansion` — global copy still 2.0.1 → 2.1.2+ (`CVE-2026-13149/14257/69152`). The
  baseline only scoped the eslint copy; the global one still ships.
- `minimatch` — 3 DoS (`CVE-2026-26996/27903/27904`); fix per path (9.0.7 / 7.4.8 / 5.1.8 / 3.1.3).
- `ip-address` 9.0.5 → 10.3.1, `sigstore` 3.0.0 → 4.1.1, `serialize-javascript` → 7.0.3 —
  pinned but not sticking (see the big lesson above); upgrade the consumer.

## Gotchas (don't relearn)
- `lodash` — leave at `4.17.21`; `4.18.0` is a bad publish (yarn refuses). Waive if it appears.
- `tar` has no 6.x fix — 7.x is a breaking API change; can't blind-pin.
- yarn-classic: a `resolution` whose version is a different major than what a consumer
  requests makes the lockfile non-idempotent → `--frozen-lockfile` fails → build breaks.
  That's why cluster 2 was removed. Scope pins (`consumer/**/pkg`) instead of global-pinning.
