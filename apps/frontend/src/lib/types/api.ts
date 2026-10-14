export interface ApiErrorRes {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}
