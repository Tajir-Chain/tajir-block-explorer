# syntax=docker/dockerfile:1

# Alpine base (keeps the low-CVE OS surface; the runner also runs `apk upgrade`).
# Build tooling needed by node-gyp / sprite / sub-tools: python3 make g++ git bash jq.
FROM node:22.14.0-alpine AS base
RUN apk add --no-cache libc6-compat python3 make g++ git bash jq curl unzip ca-certificates \
    && ln -sf /usr/bin/python3 /usr/bin/python

# ============================================================
# STAGE 1: Dependencies (PARALLEL, each with an ISOLATED cache)
# BuildKit runs these independent stages concurrently. The
# --mount=type=cache yarn caches persist for LOCAL rebuilds
# (in CI, cross-run reuse comes from the type=gha layer cache).
# ============================================================

FROM base AS app-deps
WORKDIR /app
COPY package.json yarn.lock tsconfig.json ./
COPY types ./types
COPY lib ./lib
COPY configs/app ./configs/app
COPY toolkit/theme ./toolkit/theme
COPY toolkit/utils ./toolkit/utils
COPY toolkit/components/forms/validators/url.ts ./toolkit/components/forms/validators/url.ts
RUN --mount=type=cache,target=/root/.yarn-cache/app \
    yarn --frozen-lockfile --cache-folder /root/.yarn-cache/app --network-timeout 100000

FROM base AS feature-reporter-deps
WORKDIR /feature-reporter
COPY ./deploy/tools/feature-reporter/package.json ./deploy/tools/feature-reporter/yarn.lock ./
RUN --mount=type=cache,target=/root/.yarn-cache/feature-reporter \
    yarn --frozen-lockfile --cache-folder /root/.yarn-cache/feature-reporter --network-timeout 100000

FROM base AS envs-validator-deps
WORKDIR /envs-validator
COPY ./deploy/tools/envs-validator/package.json ./deploy/tools/envs-validator/yarn.lock ./
RUN --mount=type=cache,target=/root/.yarn-cache/envs-validator \
    yarn --frozen-lockfile --cache-folder /root/.yarn-cache/envs-validator --network-timeout 100000

FROM base AS favicon-generator-deps
WORKDIR /favicon-generator
COPY ./deploy/tools/favicon-generator/package.json ./deploy/tools/favicon-generator/yarn.lock ./
RUN --mount=type=cache,target=/root/.yarn-cache/favicon-generator \
    yarn --frozen-lockfile --cache-folder /root/.yarn-cache/favicon-generator --network-timeout 100000

FROM base AS sitemap-generator-deps
WORKDIR /sitemap-generator
COPY ./deploy/tools/sitemap-generator/package.json ./deploy/tools/sitemap-generator/yarn.lock ./
RUN --mount=type=cache,target=/root/.yarn-cache/sitemap-generator \
    yarn --frozen-lockfile --cache-folder /root/.yarn-cache/sitemap-generator --network-timeout 100000

FROM base AS multichain-config-generator-deps
WORKDIR /multichain-config-generator
COPY ./deploy/tools/multichain-config-generator/package.json ./deploy/tools/multichain-config-generator/yarn.lock ./
RUN --mount=type=cache,target=/root/.yarn-cache/multichain \
    yarn --frozen-lockfile --cache-folder /root/.yarn-cache/multichain --network-timeout 100000

FROM base AS essential-dapps-deps
WORKDIR /essential-dapps-chains-config-generator
COPY ./deploy/tools/essential-dapps-chains-config-generator/package.json ./
RUN --mount=type=cache,target=/root/.yarn-cache/essential-dapps \
    yarn --frozen-lockfile --cache-folder /root/.yarn-cache/essential-dapps --network-timeout 100000

FROM base AS llms-txt-deps
WORKDIR /llms-txt-generator
COPY ./deploy/tools/llms-txt-generator/package.json ./deploy/tools/llms-txt-generator/yarn.lock ./
RUN --mount=type=cache,target=/root/.yarn-cache/llms-txt \
    yarn --frozen-lockfile --cache-folder /root/.yarn-cache/llms-txt --network-timeout 100000


# ============================================================
# STAGE 2: Builder
# ============================================================
FROM base AS builder
SHELL ["/bin/bash", "-c"]

ARG GIT_COMMIT_SHA
ENV NEXT_PUBLIC_GIT_COMMIT_SHA=$GIT_COMMIT_SHA
ARG GIT_TAG
ENV NEXT_PUBLIC_GIT_TAG=$GIT_TAG
ARG NEXT_OPEN_TELEMETRY_ENABLED
ENV NEXT_OPEN_TELEMETRY_ENABLED=$NEXT_OPEN_TELEMETRY_ENABLED
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

COPY --from=app-deps /app/node_modules ./node_modules
COPY --from=feature-reporter-deps /feature-reporter/node_modules ./deploy/tools/feature-reporter/node_modules
COPY --from=envs-validator-deps /envs-validator/node_modules ./deploy/tools/envs-validator/node_modules
COPY --from=favicon-generator-deps /favicon-generator/node_modules ./deploy/tools/favicon-generator/node_modules
COPY --from=sitemap-generator-deps /sitemap-generator/node_modules ./deploy/tools/sitemap-generator/node_modules
COPY --from=multichain-config-generator-deps /multichain-config-generator/node_modules ./deploy/tools/multichain-config-generator/node_modules
COPY --from=essential-dapps-deps /essential-dapps-chains-config-generator/node_modules ./deploy/tools/essential-dapps-chains-config-generator/node_modules
COPY --from=llms-txt-deps /llms-txt-generator/node_modules ./deploy/tools/llms-txt-generator/node_modules

COPY . .

# Build SVG sprite + generate .env.registry / .env from build args.
RUN set -a && \
    source ./deploy/scripts/build_sprite.sh && \
    ./deploy/scripts/collect_envs.sh ./docs/ENVS.md && \
    set +a

# Self-host Monaco Editor (public/ is baked into the standalone output at build time).
RUN mkdir -p ./public/monaco && \
    cp -r ./node_modules/monaco-editor/min/vs ./public/monaco/vs

# Next.js build (cache mount speeds LOCAL incremental rebuilds).
RUN --mount=type=cache,target=/app/.next/cache \
    NODE_OPTIONS="--max-old-space-size=4096" \
    yarn build

# Sub-tool builds in parallel.
RUN set -e; \
    pids=""; \
    (cd ./deploy/tools/feature-reporter && yarn compile_config && yarn build) & pids="$pids $!"; \
    (cd ./deploy/tools/envs-validator && yarn build) & pids="$pids $!"; \
    (cd ./deploy/tools/multichain-config-generator && yarn build) & pids="$pids $!"; \
    (cd ./deploy/tools/essential-dapps-chains-config-generator && yarn build) & pids="$pids $!"; \
    (cd ./deploy/tools/llms-txt-generator && yarn build) & pids="$pids $!"; \
    for pid in $pids; do wait $pid || exit 1; done


# ============================================================
# STAGE 3: Runner
# ============================================================
FROM node:22.14.0-alpine AS runner
# apk upgrade patches base-layer OS packages (e.g. musl) baked into the pinned
# node:22.14.0-alpine snapshot; `apk add` only touches the named pkgs.
RUN apk --no-cache upgrade && apk add --no-cache bash curl jq unzip ca-certificates

WORKDIR /app

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    mkdir .next && \
    chown nextjs:nodejs .next

COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Tools
COPY --from=builder /app/deploy/tools/envs-validator/dist/index.js ./envs-validator/index.js
COPY --from=builder /app/deploy/tools/feature-reporter/index.js ./feature-reporter.js
COPY --from=builder /app/deploy/tools/multichain-config-generator/dist ./deploy/tools/multichain-config-generator/dist
COPY --from=builder /app/deploy/tools/llms-txt-generator/dist ./deploy/tools/llms-txt-generator/dist
COPY --from=builder /app/deploy/tools/essential-dapps-chains-config-generator/dist ./deploy/tools/essential-dapps-chains-config-generator/dist

# Scripts
COPY --chmod=755 ./deploy/scripts/entrypoint.sh .
COPY --chmod=755 ./deploy/scripts/validate_envs.sh .
COPY --chmod=755 ./deploy/scripts/make_envs_script.sh .
COPY --chmod=755 ./deploy/scripts/download_assets.sh .
COPY ./deploy/scripts/og_image_generator.js .
COPY --chmod=755 ./deploy/scripts/favicon_generator.sh .
COPY --from=builder /app/deploy/tools/favicon-generator ./deploy/tools/favicon-generator
RUN chmod -R 777 ./deploy/tools/favicon-generator ./public

# API Swagger spec (same-origin avoids CORS; source: Tajir-Chain/swaggers fork)
ADD https://raw.githubusercontent.com/Tajir-Chain/swaggers/master/blockscout/master/polygon_zkevm/swagger.yaml ./public/swagger.yaml

COPY --chmod=755 ./deploy/scripts/sitemap_generator.sh .
COPY --from=builder /app/deploy/tools/sitemap-generator ./deploy/tools/sitemap-generator

COPY --from=builder /app/.env.registry .
COPY --from=builder /app/.env .

ARG ENVS_PRESET
ENV ENVS_PRESET=$ENVS_PRESET
COPY ./configs/envs ./configs/envs

# Standalone output (reduces image size via Next.js output-file-tracing)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

ENTRYPOINT ["./entrypoint.sh"]
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
