import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private prisma: PrismaService) {}

  @Get()
  getHello() {
    return {
      name: 'BracUMan API',
      version: '1.0.0',
      status: 'running',
    };
  }

  // Readiness probe for load balancers / uptime monitoring — confirms the
  // process is up AND can actually reach the database, not just that Node started.
  @Get('health')
  @HttpCode(HttpStatus.OK)
  async health() {
    try {
      await this.prisma.$runCommandRaw({ ping: 1 });
      return { status: 'ok', database: 'up', timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
