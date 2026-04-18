import * as Location from 'expo-location'
import type { Coordinates, Geofence, LocationResult, GeofenceCheckResult } from '../types'

const EARTH_RADIUS_M = 6_371_000
const ACCURACY_THRESHOLD_M = 30

export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const φ1 = (a.latitude * Math.PI) / 180
  const φ2 = (b.latitude * Math.PI) / 180
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180

  const h =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))

  return EARTH_RADIUS_M * c
}

export function isAccuracyAcceptable(accuracyMetres: number): boolean {
  return accuracyMetres <= ACCURACY_THRESHOLD_M
}

export function isWithinGeofence(location: Coordinates, fence: Geofence): GeofenceCheckResult {
  const distance = haversineDistance(location, {
    latitude: fence.latitude,
    longitude: fence.longitude,
  })

  if (distance <= fence.radius_m) {
    return { inside: true }
  }

  return { inside: false, distanceMetres: distance, reason: 'outside_geofence' }
}

export async function getCurrentLocation(): Promise<LocationResult> {
  const { status } = await Location.requestForegroundPermissionsAsync()

  if (status !== 'granted') {
    return { success: false, error: 'permission_denied' }
  }

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      timeInterval: 5000,
    })

    return {
      success: true,
      coords: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
      accuracyMetres: position.coords.accuracy ?? 0,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message.toLowerCase() : ''
    if (message.includes('timeout') || message.includes('timed out')) {
      return { success: false, error: 'timeout' }
    }
    return { success: false, error: 'unavailable' }
  }
}

export class GeofenceService {
  getCurrentLocation(): Promise<LocationResult> {
    return getCurrentLocation()
  }

  isWithinGeofence(location: Coordinates, fence: Geofence): GeofenceCheckResult {
    return isWithinGeofence(location, fence)
  }

  haversineDistance(a: Coordinates, b: Coordinates): number {
    return haversineDistance(a, b)
  }

  isAccuracyAcceptable(accuracyMetres: number): boolean {
    return isAccuracyAcceptable(accuracyMetres)
  }
}

export default new GeofenceService()
