import type { HttpStatus } from '@nestjs/common';
import type { ApiErrorRes } from '../types/api.js';

/** Only explicitly public payloads belong here; driver errors stay in cause. */
export class ApplicationError<
  TRes extends ApiErrorRes = ApiErrorRes,
> extends Error {
  constructor(
    public readonly statusCode: HttpStatus,
    public readonly res: TRes,
    options?: ErrorOptions,
  ) {
    super(res.message, options);
    this.name = 'ApplicationError';
  }
}
