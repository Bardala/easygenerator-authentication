import { getJson, postJson } from '../../../lib/http';
import type {
  AuthenticationMode,
  AuthenticationRes,
  CsrfRes,
  CurrentUserRes,
  SignInReq,
  SignUpReq,
} from '../types/authentication';
export const authenticationApi = {
  me: (signal: AbortSignal) => getJson<CurrentUserRes>('/auth/me', signal),
  csrf: (signal: AbortSignal) => getJson<CsrfRes>('/auth/csrf', signal),
  authenticate: (
    mode: AuthenticationMode,
    input: SignInReq | SignUpReq,
    token: string,
  ) =>
    postJson<SignInReq | SignUpReq, AuthenticationRes>(
      `/auth/${mode}`,
      input,
      token,
    ),
  signOut: (token: string) =>
    postJson<Record<string, never>, void>('/auth/sign-out', {}, token),
};
