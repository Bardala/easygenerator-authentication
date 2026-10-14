import { getJson } from '../../../lib/http';
import type { HealthResponse } from '../types/health';

export function getHealth(signal: AbortSignal): Promise<HealthResponse> {
  return getJson<HealthResponse>('/health', signal);
}
