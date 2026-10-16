import fs from 'node:fs';
import { createApp } from './src/app.js';
import { config } from './src/config.js';
import { connectDb } from './src/db.js';

fs.mkdirSync(config.uploadFolder, { recursive: true });

try {
  await connectDb();
  console.log(`MongoDB connected -> ${config.mongoDbName}`);
} catch (err) {
  console.error('\nCould not connect to MongoDB at', config.mongoUri);
  console.error(err.message);
  console.error('\nStart MongoDB (or fix MONGO_URI in backend/.env) and try again.\n');
  process.exit(1);
}

createApp().listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}`);
});
