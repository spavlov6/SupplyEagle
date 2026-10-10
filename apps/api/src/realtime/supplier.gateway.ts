import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
} from '@nestjs/websockets';
import { Logger, type OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AnalysisUpdatedMessage,
  RouteAssessmentUpdatedMessage,
} from '@supplyeagle/types';
import type { Server, Socket } from 'socket.io';
import { readCorsOrigin } from './cors-origin.js';
import { RedisService } from './redis.service.js';
import { RouteRedisService } from './route-redis.service.js';
import { userRoom } from './supplier-events.js';

@WebSocketGateway({
  cors: {
    origin: readCorsOrigin(),
  },
})
export class SupplierGateway implements OnModuleInit, OnGatewayConnection {
  private readonly logger = new Logger(SupplierGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly redis: RedisService,
    private readonly routeRedis: RouteRedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.redis.listen((event) => {
      switch (event.type) {
        case 'analysis.updated':
          this.server.to(userRoom(event.userId)).emit('analysis.updated', {
            supplierId: event.supplierId,
          } satisfies AnalysisUpdatedMessage);
          return;
        case 'supplier.created':
        case 'supplier.reassess':
          return;
        default: {
          const unexpected: never = event;
          void unexpected;
          return;
        }
      }
    });
    await this.routeRedis.listen((event) => {
      switch (event.type) {
        case 'route.assessment.updated':
          this.server.to(userRoom(event.userId)).emit('route.assessment.updated', {
            routeId: event.routeId,
          } satisfies RouteAssessmentUpdatedMessage);
          return;
        case 'route.created':
        case 'route.reassess':
          return;
        default: {
          const unexpected: never = event;
          void unexpected;
          return;
        }
      }
    });
  }

  handleConnection(client: Socket): void {
    const token = client.handshake.auth.token;
    if (typeof token !== 'string' || token.length === 0) {
      client.disconnect();
      return;
    }

    try {
      const payload = this.jwt.verify<{ sub?: string }>(token);
      if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
        client.disconnect();
        return;
      }

      void client.join(userRoom(payload.sub));
    } catch (error) {
      this.logger.warn(
        `Rejected a supplier socket: ${error instanceof Error ? error.message : 'invalid token'}`,
      );
      client.disconnect();
    }
  }
}
