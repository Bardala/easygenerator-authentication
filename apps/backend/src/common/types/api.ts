export interface ApiErrorRes {
  readonly code: string;
  readonly message: string;
  readonly fieldErrors?: Record<string, readonly string[]>;
}

export interface HttpErrorRes {
  readonly statusCode: number;
  readonly res: ApiErrorRes;
}
