// Runs only when initializing a new database volume.
for (const key of ['MONGO_APP_PASSWORD', 'MONGO_INITDB_ROOT_PASSWORD']) {
  if (!/^[a-f0-9]{64}$/.test(process.env[key] ?? '')) {
    throw new Error(
      'MongoDB passwords must be independently generated 32-byte hexadecimal secrets.',
    );
  }
}
db.getSiblingDB('easygenerator').createUser({
  user: 'authentication',
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: 'easygenerator' }],
});
