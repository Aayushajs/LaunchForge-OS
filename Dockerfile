# syntax=docker/dockerfile:1
FROM node:24.22.2-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@10.22.0 --activate

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app

RUN apt-get update && apt-get install -y python3 make g++ git python3-pip pkg-config libsecret-1-dev && rm -rf /var/lib/apt/lists/*

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Deploy only the dokploy app

ENV NODE_ENV=production
RUN pnpm --filter=@dokploy/server build
RUN pnpm --filter=./apps/dokploy run build

RUN pnpm --filter=./apps/dokploy --prod deploy --legacy /prod/dokploy

RUN cp -R /usr/src/app/apps/dokploy/.next /prod/dokploy/.next
RUN cp -R /usr/src/app/apps/dokploy/dist /prod/dokploy/dist

FROM base AS dokploy
WORKDIR /app

# Set production
ENV NODE_ENV=production

RUN apt-get update && apt-get install -y tini curl unzip zip apache2-utils iproute2 rsync git-lfs && git lfs install && rm -rf /var/lib/apt/lists/*

# Copy only the necessary files
COPY --from=build /prod/dokploy/.next ./.next
COPY --from=build /prod/dokploy/dist ./dist
COPY --from=build /prod/dokploy/next.config.mjs ./next.config.mjs
COPY --from=build /prod/dokploy/public ./public
COPY --from=build /prod/dokploy/package.json ./package.json
COPY --from=build /prod/dokploy/drizzle ./drizzle
COPY .env.production ./.env
COPY --from=build /prod/dokploy/components.json ./components.json
COPY --from=build /prod/dokploy/node_modules ./node_modules


# Install docker
RUN curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh --version 29.9.3 && rm get-docker.sh && curl https://rclone.org/install.sh | bash

# Install Nixpacks and tsx. The release binary is fetched directly because
# the upstream install script ignored NIXPACKS_VERSION and always installed
# whatever was latest; this pins the version the image is tested with.
ARG NIXPACKS_VERSION=1.41.0
RUN case "$(uname -m)" in \
        x86_64) target=x86_64-unknown-linux-musl ;; \
        aarch64) target=aarch64-unknown-linux-musl ;; \
        *) echo "Unsupported architecture $(uname -m)" >&2; exit 1 ;; \
    esac \
    && curl -fsSL --retry 5 --retry-delay 5 --retry-all-errors "https://github.com/railwayapp/nixpacks/releases/download/v${NIXPACKS_VERSION}/nixpacks-v${NIXPACKS_VERSION}-${target}.tar.gz" \
        | tar -xz -C /usr/local/bin nixpacks \
    && nixpacks --version \
    && pnpm install -g tsx

# Install Railpack. Its installer downloads from GitHub releases, which fail
# intermittently, so the step retries.
ARG RAILPACK_VERSION=0.15.4
RUN for attempt in 1 2 3 4 5; do \
        curl -fsSL --retry 3 --retry-all-errors https://railpack.com/install.sh \
            | RAILPACK_VERSION=${RAILPACK_VERSION} bash && break; \
        sleep $((attempt * 10)); \
    done \
    && railpack --version

# Install buildpacks
COPY --from=buildpacksio/pack:0.39.1 /usr/local/bin/pack /usr/local/bin/pack

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD curl -fs http://localhost:3000/api/trpc/settings.health || exit 1

# tini reaps HEALTHCHECK child processes that Node (as PID 1) leaves defunct.
ENTRYPOINT ["/usr/bin/tini", "--"]

# Ejecutar node directamente: pnpm como wrapper queda residente (~100MB RSS)
  CMD ["sh", "-c", "node -r dotenv/config dist/wait-for-postgres.mjs && node -r dotenv/config dist/migration.mjs && exec node -r dotenv/config dist/server.mjs"]
