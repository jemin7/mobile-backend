import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RawListenerModule } from './raw-listener/raw-listener.module';
import { PrismaClientExceptionFilter } from './common/prisma-exception.filter';
import * as bodyParser from 'body-parser';
import * as dns from 'dns';
import * as fs from 'fs';
import * as http from 'http';
import * as path from 'path';

// This host has no working IPv6 route. Prefer IPv4 for all outbound calls
// (web push to Apple/Google, reverse geocoding, SMTP) to avoid slow
// ENETUNREACH IPv6 attempts before falling back to IPv4.
dns.setDefaultResultOrder('ipv4first');

// PM2 can inject an empty string for a variable. Nest's dotenv will not
// replace a value that is already set, so an empty string blocks the .env file.
// Fill only those blanks from .env. Leave any non-empty process value as it is.
function fillEmptyEnvFromFile(filePath: string) {
  let text = '';
  try {
    text = fs.readFileSync(filePath, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const eq = trimmed.indexOf('=');
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key || !value) continue;
    const current = process.env[key];
    if (current == null || current.trim() === '') {
      process.env[key] = value;
    }
  }
}

fillEmptyEnvFromFile(path.join(process.cwd(), '.env'));

function sanitize(name: string) {
  return (name || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
}

async function bootstrap() {
  // --- API server (8001) ---
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  app.enableCors({
    origin: [
      'https://app.entimehr.com',
      'http://localhost:3000',
      'https://openhrm.openwan.in',
      'http://localhost:3001',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });
  app.use(bodyParser.json({
    limit: '5mb',
    verify: (req: any, _res, buf) => { req._raw = buf?.toString('utf8') ?? ''; },
  }));
  app.use(bodyParser.urlencoded({ extended: true, limit: '5mb' }));
  app.useGlobalFilters(new PrismaClientExceptionFilter());
  const port = parseInt(process.env.PORT || '8001', 10);
  await app.listen(port, '0.0.0.0');
  console.log(`API listening on 0.0.0.0:${port}`);

  // Optional temporary second port so an old reverse-proxy target keeps working
  // during the 8000 -> 8001 switch. Remove LEGACY_PORT from .env once nginx points to 8001.
 

  // --- Raw/device listener (8080) ---
  // const app8080 = await NestFactory.create(RawListenerModule, {
  //   logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  // });

  // app8080.use(bodyParser.text({
  //   type: '*/*',
  //   limit: '10mb',
  //   verify: (req: any, _res, buf) => { req._raw = buf?.toString('utf8') ?? ''; },
  // }));

  // const LOG_DIR = path.resolve(process.cwd(), 'logs');
  // const ACCESS_FILE = path.join(LOG_DIR, '_access.txt');

  // app8080.use(async (req: any, _res, next) => {
  //   try {
  //     await fs.promises.mkdir(LOG_DIR, { recursive: true });
  //     const stamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
  //     const url = req.originalUrl || req.url;
  //     const query = url.split('?')[1] ?? '';
  //     const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '';
  //     const rawBody = req._raw ?? (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  //     const entry =
  //       `[${stamp}] IP=${ip}\nMETHOD: ${req.method}\nURL: ${url}\nQUERY: ${query}\n` +
  //       `HEADERS: ${JSON.stringify(req.headers)}\nBODY:\n${rawBody}\n\n`;
  //     await fs.promises.appendFile(ACCESS_FILE, entry, 'utf8');

  //     const sn = sanitize((req.query?.SN as string) || '');
  //     const perFile = sn
  //       ? path.join(LOG_DIR, `${sn}.txt`)
  //       : path.join(LOG_DIR, `${sanitize(ip || 'UNKNOWN')}.txt`);
  //     await fs.promises.appendFile(perFile, entry, 'utf8');
  //   } catch {}
  //   next();
  // });

  // await app8080.listen(8080, '0.0.0.0');
  // console.log('Raw listener on http://localhost:8080');
}
bootstrap();
