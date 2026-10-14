export interface HealthResponse {
  status: 'ok';
  checks: { mongodb: 'up' };
}
