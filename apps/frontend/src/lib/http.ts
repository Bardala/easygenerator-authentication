import type { ApiErrorRes } from './types/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly res: ApiErrorRes,
  ) {
    super(res.message);
    this.name = 'ApiError';
  }
}

export async function getJson<TRes>(
  path: string,
  signal: AbortSignal,
): Promise<TRes> {
  const response = await fetch(`/api${path}`, {
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    const res: ApiErrorRes =
      typeof body === 'object' &&
      body !== null &&
      'code' in body &&
      typeof body.code === 'string' &&
      'message' in body &&
      typeof body.message === 'string'
        ? { code: body.code, message: body.message }
        : {
            code: 'REQUEST_FAILED',
            message: 'The request could not be completed.',
          };
    throw new ApiError(response.status, res);
  }

  return body as TRes;
}
