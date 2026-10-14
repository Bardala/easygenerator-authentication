import { getJson } from '../../../lib/http';
import type { HealthRes } from '../types/health';

export function getHealth(signal: AbortSignal): Promise<HealthRes> {
  return getJson<HealthRes>('/health', signal);
}
