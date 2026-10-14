// Independent of a developer's private .env file and database.
Object.assign(process.env, {
  APP_ENV: 'test',
  APP_ORIGIN: 'http://127.0.0.1:5173',
  PORT: '3000',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/easygenerator_test',
  SESSION_SECRET: 'test-only-secret-not-for-deployment-0123456789',
  LOG_LEVEL: 'error',
});
