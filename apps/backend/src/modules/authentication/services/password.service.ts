import { Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';

const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash!: string;

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash(randomBytes(32).toString('hex'));
  }
  hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }
  async verify(hash: string | undefined, password: string): Promise<boolean> {
    const valid = await argon2.verify(hash ?? this.dummyHash, password);
    return hash !== undefined && valid;
  }
}
