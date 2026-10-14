export interface User {
  id: string;
  email: string;
  name: string;
}
export interface SignInReq {
  email: string;
  password: string;
}
export interface SignUpReq extends SignInReq {
  name: string;
}
export interface CsrfRes {
  csrfToken: string;
}
export interface AuthenticationRes extends CsrfRes {
  user: User;
}
export interface CurrentUserRes {
  user: User;
}
export interface SessionState {
  user: User | null;
  expired: boolean;
}
export type AuthField = 'email' | 'name' | 'password';
export type FieldErrors = Partial<Record<AuthField, string>>;
export type AuthenticationMode = 'sign-up' | 'sign-in';
