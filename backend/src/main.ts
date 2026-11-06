import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  // 生产走 Nginx 同源反代，默认不开放跨域；确需跨域时用 CORS_ORIGIN 显式白名单
  app.enableCors({
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : false,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  const port = Number(process.env.PORT ?? 8080);
  await app.listen(port);
  console.log(`ZhangBen backend listening on http://localhost:${port}/api`);
}
bootstrap();
