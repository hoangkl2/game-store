import { Global, Module } from "@nestjs/common";
import { ConfigModule as NestConfigModule } from "@nestjs/config";
import { RuntimeConfigService, validateEnvironment } from "./environment";

@Global()
@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment })],
  providers: [RuntimeConfigService],
  exports: [RuntimeConfigService]
})
export class RuntimeConfigModule {}
