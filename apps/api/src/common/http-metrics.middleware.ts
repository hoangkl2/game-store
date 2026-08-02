import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { MetricsService } from "../observability/metrics.service";

@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(request: Request, response: Response, next: NextFunction): void {
    const started = performance.now();
    response.once("finish", () => {
      const route = request.route?.path ? `${request.baseUrl}${String(request.route.path)}` : "unmatched";
      this.metrics.httpDuration.observe(
        { method: request.method, route, status: String(response.statusCode) },
        (performance.now() - started) / 1000
      );
    });
    next();
  }
}
