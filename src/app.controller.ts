import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get()
  getHello() {
    return {
      name: 'BracUMan API',
      version: '1.0.0',
      status: 'running',
    };
  }
}
