import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ApiError } from '../../../lib/http';
import { authenticationApi } from '../api/authentication.api';
import { replaceSession } from './session-cache';
import type {
  AuthenticationMode,
  SignInReq,
  SignUpReq,
} from '../types/authentication';
const csrfKey = ['auth', 'csrf'] as const;
export const csrfOptions = queryOptions({
  queryKey: csrfKey,
  queryFn: ({ signal }) => authenticationApi.csrf(signal),
  staleTime: Infinity,
  retry: false,
  refetchOnWindowFocus: false,
});
export function useCsrf() {
  return useQuery(csrfOptions);
}
function tokenFailure(error: unknown) {
  return (
    error instanceof ApiError &&
    ['CSRF_INVALID', 'SESSION_EXPIRED'].includes(error.res.code)
  );
}
export function useAuthentication(mode: AuthenticationMode) {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async (input: SignInReq | SignUpReq) => {
      const { csrfToken } = await client.ensureQueryData(csrfOptions);
      return authenticationApi.authenticate(mode, input, csrfToken);
    },
    onSuccess: async ({ user, csrfToken }) => {
      await replaceSession(client, { user, expired: false });
      client.setQueryData(csrfKey, { csrfToken });
    },
    onError: async (error) => {
      if (tokenFailure(error))
        await client.invalidateQueries({ queryKey: csrfKey });
    },
  });
}
export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    retry: false,
    gcTime: 0,
    mutationFn: async () => {
      const { csrfToken } = await client.ensureQueryData(csrfOptions);
      await authenticationApi.signOut(csrfToken);
    },
    onSuccess: async () => {
      await replaceSession(client, { user: null, expired: false });
      client.removeQueries({ queryKey: csrfKey });
    },
    onError: async (error) => {
      if (tokenFailure(error)) await client.resetQueries({ queryKey: csrfKey });
    },
  });
}
