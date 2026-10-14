import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { ApplicationError } from '../errors/application.error.js';

export function createApiValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: { target: false, value: false },
    exceptionFactory: (errors: ValidationError[]) => {
      const fieldErrors: Record<string, string[]> = Object.create(
        null,
      ) as Record<string, string[]>;
      for (const error of errors)
        fieldErrors[error.property] = Object.values(error.constraints ?? {});
      return new ApplicationError(HttpStatus.BAD_REQUEST, {
        code: 'VALIDATION_ERROR',
        message: 'Check the submitted fields.',
        fieldErrors,
      });
    },
  });
}
