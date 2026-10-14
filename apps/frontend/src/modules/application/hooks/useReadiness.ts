import { useQuery } from '@tanstack/react-query';
import { getHealth } from '../api/health.api';

export function useReadiness() {
  return useQuery({
    queryKey: ['application', 'readiness'],
    queryFn: ({ signal }) => getHealth(signal),
  });
}
