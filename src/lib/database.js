const mongoose = require('mongoose');

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    const error = new Error(
      'MONGO_URI is missing. Add your MongoDB Atlas URI to .env before starting the server.',
    );
    error.status = 500;
    throw error;
  }

  try {
    return await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });
  } catch (error) {
    error.message = `MongoDB connection failed. Check MONGO_URI, Atlas IP access, and database user/password. ${error.message}`;
    throw error;
  }
}

async function disconnectDatabase() {
  if (mongoose.connection.readyState === 0) {
    return;
  }

  await mongoose.disconnect();
}

module.exports = {
  connectToDatabase,
  disconnectDatabase,
};
