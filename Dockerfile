FROM node:22-slim
WORKDIR /app
COPY . .
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8787 DB_PATH=/data/garda.db
VOLUME /data
EXPOSE 8787
USER node
CMD ["node","--disable-warning=ExperimentalWarning","backend/server.js"]
