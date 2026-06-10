import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Global Prefix
  app.setGlobalPrefix('api');

  // Cookie Parser
  app.use(cookieParser());

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  // Security
  app.use(helmet());

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = process.env.APP_PORT || 3000;

  // Swagger API Documentation (nur wenn SWAGGER_ENABLED=true, nie in Production)
  if (process.env.SWAGGER_ENABLED === 'true' && process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Orynthia API')
      .setDescription('Persönliche Finanzmanagement API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`API Docs: http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`Orynthia API läuft auf Port ${port}`);
}

bootstrap();
