FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN npm ci --workspace @abhaya/web --workspace @abhaya/client --workspace @abhaya/ui --workspace @abhaya/utils --workspace @abhaya/types --workspace @abhaya/validation --include-workspace-root
ARG NEXT_PUBLIC_MAP_TILE_URL
ENV NEXT_PUBLIC_MAP_TILE_URL=$NEXT_PUBLIC_MAP_TILE_URL
RUN npm run build -w @abhaya/web

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
