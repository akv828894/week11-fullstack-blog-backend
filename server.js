require('./src/config/env');
const app = require('./src/app');
const { initializeDataStore, closeDataStore } = require('./src/data/blogStore');

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  const storeMode = await initializeDataStore();
  const server = app.listen(PORT, () => {
    console.log(`Week 11 API listening on http://localhost:${PORT} using ${storeMode} store`);
  });

  async function shutdown(signal) {
    console.log(`${signal} received. Closing Week 11 API...`);

    server.close(async () => {
      await closeDataStore();
      process.exit(0);
    });
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

startServer().catch((error) => {
  console.error('Failed to start Week 11 API.');
  console.error(error.message);
  process.exit(1);
});
