import type { INestApplicationContext } from "@nestjs/common";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { createClient, type RedisClientType } from "redis";
import type { Server, ServerOptions } from "socket.io";
import { RuntimeConfigService } from "../config/environment";

export class RedisIoAdapter extends IoAdapter {
  private publisher?: RedisClientType;
  private subscriber?: RedisClientType;

  constructor(app: INestApplicationContext, private readonly config: RuntimeConfigService) { super(app); }

  async connect(): Promise<void> {
    const options = { url: this.config.get("REDIS_URL") };
    this.publisher = createClient(options);
    this.subscriber = this.publisher.duplicate();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        Promise.all([this.publisher.connect(), this.subscriber.connect()]),
        new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error("Socket.IO Redis adapter connection timed out")), 5000); })
      ]);
    } catch (error) {
      this.publisher.destroy(); this.subscriber.destroy(); throw error;
    } finally { if (timer) clearTimeout(timer); }
  }

  override createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (!this.publisher || !this.subscriber) throw new Error("Socket.IO Redis adapter is not connected");
    server.adapter(createAdapter(this.publisher, this.subscriber));
    return server;
  }

  override async close(server: Server): Promise<void> {
    await super.close(server);
    await Promise.all([
      this.publisher?.isOpen ? this.publisher.quit() : Promise.resolve(),
      this.subscriber?.isOpen ? this.subscriber.quit() : Promise.resolve()
    ]);
  }
}
