export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getJson<T>(
  path: string,
  signal: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    signal,
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  });
  const body: unknown = await response.json();

  if (!response.ok) {
    const message =
      typeof body === 'object' &&
      body !== null &&
      'message' in body &&
      typeof body.message === 'string'
        ? body.message
        : 'The request could not be completed.';
    throw new ApiError(response.status, message);
  }

  return body as T;
}
