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
function errorRes(body: unknown): ApiErrorRes {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('code' in body) ||
    typeof body.code !== 'string' ||
    !('message' in body) ||
    typeof body.message !== 'string'
  ) {
    return {
      code: 'REQUEST_FAILED',
      message: 'The request could not be completed.',
    };
  }
  const res: ApiErrorRes = { code: body.code, message: body.message };
  if (
    'fieldErrors' in body &&
    typeof body.fieldErrors === 'object' &&
    body.fieldErrors !== null
  ) {
    res.fieldErrors = Object.fromEntries(
      Object.entries(body.fieldErrors).filter(
        (entry): entry is [string, string[]] =>
          Array.isArray(entry[1]) &&
          entry[1].every((value: unknown) => typeof value === 'string'),
      ),
    );
  }
  return res;
}
async function json<TRes>(path: string, options: RequestInit): Promise<TRes> {
  const response = await fetch(`/api${path}`, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json', ...options.headers },
  });
  const body: unknown =
    response.status === 204
      ? undefined
      : await response.json().catch(() => undefined);
  if (!response.ok) throw new ApiError(response.status, errorRes(body));
  if (response.status !== 204 && body === undefined)
    throw new Error('Invalid server response');
  return body as TRes;
}
export function getJson<TRes>(
  path: string,
  signal: AbortSignal,
): Promise<TRes> {
  return json(path, { signal });
}
export function postJson<TReq, TRes>(
  path: string,
  body: TReq,
  csrfToken: string,
): Promise<TRes> {
  return json(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
    body: JSON.stringify(body),
  });
}
