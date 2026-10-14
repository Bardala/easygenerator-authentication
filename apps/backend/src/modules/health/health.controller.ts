import { Controller, Get, Header } from '@nestjs/common';
import { HealthService } from './health.service.js';
import type { HealthRes } from './types/health.js';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  readiness(): Promise<HealthRes> {
    return this.health.readiness();
  }
}
