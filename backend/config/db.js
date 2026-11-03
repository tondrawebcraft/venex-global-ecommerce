import mongoose from 'mongoose';

export async function connectDatabase(uri = process.env.MONGODB_URI) {
  if (!uri) throw new Error('MONGODB_URI is required');
  // Request bodies are allowlisted/sanitized at the Express boundary. We build query
  // operators here from server code so Mongoose can preserve those trusted operators.
  mongoose.set('sanitizeFilter', false);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return mongoose.connection;
}

