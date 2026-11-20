import { BadRequestException } from '@nestjs/common';
import { haversineMeters } from '../../common/geo-distance';

export type MobileFencePoint = {
  latitude: number;
  longitude: number;
  type: 'OFFICE' | 'SITE' | 'HOME';
  siteId?: number | null;
};

export function mobileFenceRadius(
  baseRadius: unknown,
  accuracy?: number | null,
): number {
  const radius = Number(baseRadius);

  if (!Number.isFinite(radius) || radius <= 0) {
    throw new BadRequestException(
      'Geofence radius is not configured for your branch.',
    );
  }

  const extra =
    typeof accuracy === 'number' && Number.isFinite(accuracy)
      ? Math.min(Math.max(accuracy, 0), 150)
      : 0;

  return radius + extra;
}

export function assertMobileWithinFence(
  latitude: number,
  longitude: number,
  points: MobileFencePoint[],
  radiusMeters: number,
): MobileFencePoint {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    (latitude === 0 && longitude === 0)
  ) {
    throw new BadRequestException('Valid GPS coordinates are required.');
  }

  if (!points.length) {
    throw new BadRequestException(
      'No allowed mobile attendance location is configured.',
    );
  }

  let nearest: {
    point: MobileFencePoint;
    distance: number;
  } | null = null;

  for (const point of points) {
    const distance = haversineMeters(
      latitude,
      longitude,
      point.latitude,
      point.longitude,
    );

    if (!nearest || distance < nearest.distance) {
      nearest = { point, distance };
    }
  }

  if (!nearest || nearest.distance > radiusMeters) {
    throw new BadRequestException(
      'You are outside your assigned attendance location.',
    );
  }

  return nearest.point;
}

export function mobileWallDateKey(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}