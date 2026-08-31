import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { ApiThrottlerGuard } from '../guards/api-throttler.guard';

@Controller('rate-limit-probe')
class RateLimitProbeController {
  @Get()
  get() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 2, blockDuration: 60_000 },
    ]),
  ],
  controllers: [RateLimitProbeController],
  providers: [{ provide: APP_GUARD, useClass: ApiThrottlerGuard }],
})
class RateLimitTestModule {}

describe('API rate limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RateLimitTestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns limit headers and blocks requests over budget', async () => {
    const first = await request(app.getHttpServer())
      .get('/rate-limit-probe')
      .expect(200);
    expect(first.headers['x-ratelimit-limit']).toBe('2');
    expect(first.headers['x-ratelimit-remaining']).toBe('1');

    await request(app.getHttpServer()).get('/rate-limit-probe').expect(200);

    const blocked = await request(app.getHttpServer())
      .get('/rate-limit-probe')
      .expect(429);
    expect(blocked.headers['retry-after']).toBeDefined();
  });
});
