# ==============================================================================
# Production Dockerfile for Avigo Oil and Gas Integrated Ltd.
# Zero third-party dependencies - builds purely on lightweight Node.js Alpine base.
# ==============================================================================
FROM node:20-alpine

# Set deployment working directory
WORKDIR /app

# Set production environment flags
ENV NODE_ENV=production \
    PORT=3000 \
    AVIGO_PORTAL_PATH=/avigo-portal

# Copy package metadata
COPY package.json ./

# Copy core engine, views, public assets, and content storage
COPY server.js ./
COPY views ./views
COPY public ./public
COPY data ./data
COPY scripts ./scripts

# Ensure application files and data directories have write permissions
RUN chown -R node:node /app

# Switch to non-privileged node user for security hardening
USER node

# Expose internal HTTP service port
EXPOSE 3000

# Health check probe against native health API endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Boot the Avigo Lightweight Engine
CMD ["node", "server.js"]

