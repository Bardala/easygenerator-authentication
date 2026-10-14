import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ApplicationError } from '../errors/application.error.js';
import type { ApiErrorRes, HttpErrorRes } from '../types/api.js';

const publicErrors: Readonly<Partial<Record<number, ApiErrorRes>>> = {
  [HttpStatus.BAD_REQUEST]: {
    code: 'BAD_REQUEST',
    message: 'Invalid request.',
  },
  [HttpStatus.UNAUTHORIZED]: {
    code: 'UNAUTHORIZED',
    message: 'Authentication is required.',
  },
  [HttpStatus.FORBIDDEN]: {
    code: 'FORBIDDEN',
    message: 'The request is not permitted.',
  },
  [HttpStatus.NOT_FOUND]: {
    code: 'NOT_FOUND',
    message: 'The requested resource was not found.',
  },
  [HttpStatus.METHOD_NOT_ALLOWED]: {
    code: 'METHOD_NOT_ALLOWED',
    message: 'The request method is not allowed.',
  },
  [HttpStatus.CONFLICT]: {
    code: 'CONFLICT',
    message: 'The request conflicts with an existing resource.',
  },
  [HttpStatus.PAYLOAD_TOO_LARGE]: {
    code: 'PAYLOAD_TOO_LARGE',
    message: 'The request body is too large.',
  },
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: {
    code: 'UNSUPPORTED_MEDIA_TYPE',
    message: 'The request content type is not supported.',
  },
  [HttpStatus.TOO_MANY_REQUESTS]: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
  },
  [HttpStatus.SERVICE_UNAVAILABLE]: {
    code: 'DEPENDENCY_UNAVAILABLE',
    message: 'A required service is unavailable.',
  },
};

@Injectable()
export class HttpErrorAdapter {
  normalize(error: unknown): HttpErrorRes {
    const statusCode = this.getStatusCode(error);

    if (error instanceof ApplicationError && statusCode === error.statusCode) {
      return { statusCode, res: error.res };
    }

    return {
      statusCode,
      res:
        publicErrors[statusCode] ??
        (statusCode >= 500
          ? { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' }
          : {
              code: 'REQUEST_FAILED',
              message: 'The request could not be completed.',
            }),
    };
  }

  private getStatusCode(error: unknown): number {
    let status: unknown;

    if (error instanceof HttpException) {
      status = error.getStatus();
    } else if (error instanceof Error) {
      // Express middleware commonly uses statusCode or status (http-errors).
      status =
        'statusCode' in error
          ? error.statusCode
          : 'status' in error
            ? error.status
            : undefined;
    }

    return typeof status === 'number' &&
      Number.isInteger(status) &&
      status >= 400 &&
      status <= 599
      ? status
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
