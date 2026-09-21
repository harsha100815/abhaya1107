FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY . .
RUN npm ci --workspace @abhaya/api --workspace @abhaya/types --workspace @abhaya/utils --workspace @abhaya/validation --include-workspace-root
RUN npm run db:generate && npm run build -w @abhaya/api

FROM build AS migrate
USER node
CMD ["npm", "run", "db:deploy"]

FROM build AS pruned
RUN npm prune --omit=dev --workspace @abhaya/api --workspace @abhaya/types --workspace @abhaya/utils --workspace @abhaya/validation

FROM node:24-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=pruned --chown=node:node /app/node_modules ./node_modules
COPY --from=pruned --chown=node:node /app/apps/api ./apps/api
COPY --from=pruned --chown=node:node /app/packages ./packages
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]
