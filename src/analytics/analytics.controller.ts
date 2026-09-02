import { Body, Controller, Post } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { RecordVisitDto } from './dto/record-visit.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('visit')
  recordVisit(@Body() dto: RecordVisitDto) {
    return this.analyticsService.recordVisit(dto.visitorId);
  }
}
