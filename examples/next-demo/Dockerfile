# Multi-stage image for the Northline next-demo (SectionPack host).
# Build from monorepo root so npm workspaces resolve @ctrlc/* packages.
#
#   docker compose up --build demo
#   # or: docker build -f examples/next-demo/Dockerfile -t ctrlc-demo .
#
# App listens on 3040 (same as npm run dev:demo / start).

FROM node:20-bookworm-slim AS build
WORKDIR /app

# Workspace manifests first for better layer cache
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY packages/react/package.json packages/react/
COPY packages/next/package.json packages/next/
COPY packages/capture/package.json packages/capture/
COPY packages/cli/package.json packages/cli/
COPY examples/next-demo/package.json examples/next-demo/
COPY examples/clone-template/package.json examples/clone-template/

# Prefer lockfile; fall back if npm ci fails (rare lock drift)
RUN npm ci || npm install

COPY tsconfig.base.json ./
COPY packages packages
COPY examples/next-demo examples/next-demo

# Build library packages then the Next demo
RUN npm run build \
  && npm run build -w @ctrlc/next-demo

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3040
ENV HOSTNAME=0.0.0.0

COPY --from=build /app /app

WORKDIR /app/examples/next-demo
EXPOSE 3040
CMD ["npm", "run", "start"]
