import dotenv from 'dotenv';
dotenv.config({ path: process.env.ENV_FILE || '../.env' });
import app from './app.js';
import { connectDatabase } from './config/db.js';

const port = Number(process.env.PORT || 5001);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
if (!process.env.COOKIE_SECRET || process.env.COOKIE_SECRET.length < 32) throw new Error('COOKIE_SECRET must contain at least 32 characters.');

await connectDatabase();
const server = app.listen(port, '0.0.0.0', () => console.log(`VENEX API listening on ${port}`));

async function shutdown(signal) {
  console.log(`${signal} received, shutting down.`);
  server.close(async () => {
    const mongoose = await import('mongoose');
    await mongoose.default.disconnect();
    process.exit(0);
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

