import { Controller, Get } from '@nestjs/common';

/**
 * Root health-check controller.
 * Domain-specific logic lives inside the feature modules.
 */
@Controller()
export class AppController {
  @Get('health')
  healthCheck(): { status: string; timestamp: string } {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
