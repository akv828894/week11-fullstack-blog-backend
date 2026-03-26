require('../src/config/env');
const { connectToDatabase, disconnectDatabase } = require('../src/lib/database');

async function main() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is empty in .env');
    process.exit(1);
  }

  try {
    const connection = await connectToDatabase();
    console.log(`MongoDB connected successfully to database: ${connection.name}`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
