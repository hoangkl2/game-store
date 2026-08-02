import { ArgumentsHost, Catch, HttpException, HttpStatus, type ExceptionFilter } from "@nestjs/common";
import type { Request, Response } from "express";
import { JsonLogger } from "../observability/json-logger.service";
import { RequestContextService } from "./request-context";

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: JsonLogger, private readonly contexts: RequestContextService) {}

  catch(error: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const supplied = error instanceof HttpException ? error.getResponse() : undefined;
    const code = typeof supplied === "object" && supplied && "code" in supplied ? String(supplied.code) : status === 500 ? "INTERNAL_ERROR" : "REQUEST_REJECTED";
    const message = status >= 500 ? "An internal error occurred" : typeof supplied === "string" ? supplied : typeof supplied === "object" && supplied && "message" in supplied ? supplied.message : "Request rejected";
    if (status >= 500) this.logger.error("Unhandled request failure", { method: request.method, path: request.path, errorName: error instanceof Error ? error.name : "UnknownError" });
    response.status(status).json({ statusCode: status, code, message, requestId: this.contexts.current()?.requestId, timestamp: new Date().toISOString() });
  }
}
