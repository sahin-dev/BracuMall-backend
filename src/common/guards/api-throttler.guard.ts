import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  getRateLimitTracker,
  type RateLimitRequest,
} from '../rate-limit/rate-limit.util';

@Injectable()
export class ApiThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    return super.canActivate(context);
  }

  protected async getTracker(request: RateLimitRequest): Promise<string> {
    return getRateLimitTracker(request);
  }
}
