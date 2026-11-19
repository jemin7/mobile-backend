export const DEVICE_ROUTE_PREFIXES = [
  '/essl',
  '/iclock',
  '/zkteco',
  '/dahua',
  '/html/dahua',
];

export function isDeviceRoute(path: string): boolean {
  const normalized = path.split('?')[0].toLowerCase();
  return DEVICE_ROUTE_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
}
