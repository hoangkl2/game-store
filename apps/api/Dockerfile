FROM node:20.19.5-bookworm-slim AS build
WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile \
  && pnpm --filter @game-store/api prisma:generate \
  && pnpm --filter @game-store/api build \
  && pnpm --filter @game-store/api deploy --prod /runtime

FROM node:20.19.5-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps
WORKDIR /app
RUN apt-get update \
  && apt-get install --no-install-recommends -y ca-certificates curl dumb-init \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable && corepack prepare pnpm@9.15.0 --activate
COPY --from=build --chown=node:node /runtime /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=4 CMD curl --fail --silent http://127.0.0.1:4000/api/v1/health/live || exit 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
