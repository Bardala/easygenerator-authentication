import { queryOptions, useQuery } from '@tanstack/react-query';
import { ApiError } from '../../../lib/http';
import { authenticationApi } from '../api/authentication.api';
import type { SessionState } from '../types/authentication';
export const sessionKey = ['auth', 'me'] as const;
export const sessionOptions = queryOptions({
  queryKey: sessionKey,
  queryFn: async ({ signal }): Promise<SessionState> => {
    try {
      const { user } = await authenticationApi.me(signal);
      return { user, expired: false };
    } catch (error) {
      if (error instanceof ApiError && error.status === 401)
        return { user: null, expired: error.res.code === 'SESSION_EXPIRED' };
      throw error;
    }
  },
  staleTime: 60_000,
  retry: false,
  refetchOnWindowFocus: true,
  refetchOnReconnect: true,
  meta: { private: true },
});
export function useSession() {
  return useQuery(sessionOptions);
}
