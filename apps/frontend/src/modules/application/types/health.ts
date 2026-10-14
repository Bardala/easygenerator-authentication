export interface HealthRes {
  status: 'ok';
  checks: { mongodb: 'up' };
}
