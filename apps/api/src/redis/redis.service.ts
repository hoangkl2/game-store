import { Global, Injectable, Module, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { createClient, type RedisClientType } from "redis";
import { randomUUID } from "node:crypto";
import { RuntimeConfigService } from "../config/environment";
import { MetricsService } from "../observability/metrics.service";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly client: RedisClientType;
  private ready = false;
  private lastError?: string;
  constructor(private readonly config: RuntimeConfigService, private readonly metrics: MetricsService) {
    this.client = createClient({ url: config.get("REDIS_URL"), socket: { reconnectStrategy: (retries) => retries > 6 ? false : Math.min(100 * 2 ** retries, 3000) } });
    this.client.on("error", (error) => { this.ready = false; this.lastError = error.message.slice(0, 256); this.metrics.dependencyFailures.inc({ dependency: "redis" }); });
    this.client.on("ready", () => { this.ready = true; this.lastError = undefined; });
  }
  async onModuleInit(): Promise<void> {
    try { await this.client.connect(); await this.client.ping(); this.ready = true; }
    catch (error) { this.lastError = error instanceof Error ? error.message.slice(0, 256) : "Redis connection failed"; if (this.config.get("REDIS_REQUIRED")) throw error; }
  }
  async onModuleDestroy(): Promise<void> { this.ready = false; if (this.client.isOpen) await this.client.quit(); }
  key(value: string): string { return `${this.config.get("REDIS_KEY_PREFIX")}${value}`; }
  isReady(): boolean { return this.ready && this.client.isReady; }
  status(): { ready: boolean; error?: string } { return { ready: this.isReady(), error: this.lastError }; }
  async ping(): Promise<number> { const started = performance.now(); await this.client.ping(); return performance.now() - started; }
  async duplicate(): Promise<RedisClientType> { const duplicate = this.client.duplicate(); await duplicate.connect(); return duplicate; }
  async incrementWindow(key: string, ttlSeconds: number): Promise<number> {
    if (!this.isReady()) throw new Error("REDIS_UNAVAILABLE");
    const full = this.key(key); const count = await this.client.incr(full); if (count === 1) await this.client.expire(full, ttlSeconds); return count;
  }
  async setPresence(identityId: string, seconds = 45): Promise<void> { await this.client.set(this.key(`presence:user:${identityId}`), this.config.get("INSTANCE_ID"), { EX: seconds }); }
  async setReconnectGrace(identityId: string, gameSessionId: string, seconds: number): Promise<void> { await this.client.set(this.key(`reconnect:${gameSessionId}:${identityId}`), "pending", { EX: seconds }); }
  async acquireLock(resource: string, milliseconds: number): Promise<string | undefined> { const owner = `${this.config.get("INSTANCE_ID")}:${randomUUID()}`; const result = await this.client.set(this.key(`lock:${resource}`), owner, { NX: true, PX: milliseconds }); return result === "OK" ? owner : undefined; }
  async renewLock(resource: string, owner: string, milliseconds: number): Promise<boolean> { const result = await this.client.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end", { keys: [this.key(`lock:${resource}`)], arguments: [owner, String(milliseconds)] }); return result === 1; }
  async releaseLock(resource: string, owner: string): Promise<boolean> { const result = await this.client.eval("if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end", { keys: [this.key(`lock:${resource}`)], arguments: [owner] }); return result === 1; }
  async enqueueMatchmaking(queue: string, ticketId: string, score: number): Promise<void> { await this.client.zAdd(this.key(`matchmaking:${queue}`), { score, value: ticketId }); }
  async removeMatchmaking(queue: string, ticketId: string): Promise<void> { await this.client.zRem(this.key(`matchmaking:${queue}`), ticketId); }
  async scheduleTimeout(bucket: string, durableReference: string, dueAtMilliseconds: number): Promise<void> { await this.client.zAdd(this.key(`timer:${bucket}`), { score: dueAtMilliseconds, value: durableReference }); }
  async popDueTimeouts(bucket: string, nowMilliseconds: number, limit = 100): Promise<string[]> {
    const result = await this.client.eval("local v=redis.call('zrangebyscore',KEYS[1],'-inf',ARGV[1],'LIMIT',0,ARGV[2]); if #v>0 then redis.call('zrem',KEYS[1],unpack(v)) end; return v", { keys: [this.key(`timer:${bucket}`)], arguments: [String(nowMilliseconds), String(limit)] });
    return Array.isArray(result) ? result.map(String) : [];
  }
  async publishInvalidation(channel: string, payload: string): Promise<number> { return this.client.publish(this.key(`invalidation:${channel}`), payload); }
}

@Global()
@Module({ providers: [RedisService], exports: [RedisService] })
export class RedisModule {}
