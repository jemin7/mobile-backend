import type { Request } from 'express';

export function normalizeQuery(query: Request['query']): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      normalized[key] = value.length > 0 ? String(value[0]) : '';
    } else if (typeof value === 'string') {
      normalized[key] = value;
    } else if (value != null) {
      normalized[key] = String(value);
    }
  }
  return normalized;
}

export function readBodyText(body: unknown): string {
  if (typeof body === 'string') {
    return body;
  }
  if (Buffer.isBuffer(body)) {
    return body.toString('utf8');
  }
  if (body == null) {
    return '';
  }
  return JSON.stringify(body);
}

export function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const headerIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
  const ip = (headerIp || req.ip || req.socket?.remoteAddress || '').trim();
  return ip.replace('::ffff:', '').slice(0, 50);
}

export function requestPath(req: Request): string {
  return (req.originalUrl || req.url || '').split('?')[0];
}
