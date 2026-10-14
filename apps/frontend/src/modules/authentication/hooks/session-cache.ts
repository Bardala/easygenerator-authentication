import type { QueryClient } from '@tanstack/react-query';
import { sessionKey } from './useSession';
import type { SessionState } from '../types/authentication';

export async function replaceSession(
  client: QueryClient,
  state: SessionState,
): Promise<void> {
  await client.cancelQueries({
    predicate: (query) => query.meta?.['private'] === true,
  });
  client.removeQueries({
    predicate: (query) =>
      query.meta?.['private'] === true &&
      !(
        query.queryKey.length === 2 &&
        query.queryKey[0] === 'auth' &&
        query.queryKey[1] === 'me'
      ),
  });
  client.setQueryData(sessionKey, state);
}
