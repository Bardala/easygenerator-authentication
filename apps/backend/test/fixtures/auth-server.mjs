import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { AppModule } from '../../dist/app.module.js';
import { configureApplication } from '../../dist/app.setup.js';
import { UsersService } from '../../dist/modules/users/users.service.js';

const app = await NestFactory.create(AppModule, {
  bodyParser: false,
  bufferLogs: true,
  abortOnError: false,
});
app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
configureApplication(app);
const connection = app.get(getConnectionToken());
await connection.asPromise();
await app.listen(0, '127.0.0.1');
process.send({ ready: await app.getUrl() });
const users = app.get(UsersService);
const findPublic = users.findPublic.bind(users);
let resume;
process.on('message', async (message) => {
  if (message === 'pause-user-lookup') {
    users.findPublic = async (id) => {
      process.send({ waiting: true });
      await new Promise((resolve) => {
        resume = resolve;
      });
      return findPublic(id);
    };
    process.send({ prepared: true });
  }
  if (message === 'resume-user-lookup') {
    users.findPublic = findPublic;
    resume();
  }
  if (message === 'disconnect') {
    await connection.close();
    process.send({ disconnected: true });
  }
  if (message === 'stop') {
    if (process.env.CLEAN_TEST_DATABASE === '1') {
      if (!connection.db.databaseName.startsWith('easygenerator_auth_test_'))
        throw new Error('Unsafe test cleanup database');
      await connection.db.dropDatabase();
    }
    await app.close();
    process.exit(0);
  }
});
