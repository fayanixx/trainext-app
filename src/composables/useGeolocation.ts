import { computed, readonly, ref } from 'vue'
import type { GeoPosition } from '@/types'

const position = ref<GeoPosition | null>(null)
const error = ref('')
const isWatching = ref(false)
const isLoading = ref(false)

let watchId: number | null = null
let startPromise: Promise<GeoPosition> | null = null

function mapPosition(result: GeolocationPosition): GeoPosition {
  return {
    latitude: result.coords.latitude,
    longitude: result.coords.longitude,
    accuracy: Number.isFinite(result.coords.accuracy)
      ? result.coords.accuracy
      : null,
    timestamp: result.timestamp
  }
}

function handleError(err: GeolocationPositionError): void {
  if (err.code === err.PERMISSION_DENIED) {
    error.value =
      'Location permission was denied. Enable location access to use geofenced attendance.'
  } else if (err.code === err.POSITION_UNAVAILABLE) {
    error.value = 'Your current location is unavailable. Move to an open area and retry.'
  } else if (err.code === err.TIMEOUT) {
    error.value = 'Getting your location timed out. Retry in a moment.'
  } else {
    error.value = err.message || 'Unable to read your location.'
  }
}

function startWatch(): void {
  if (watchId !== null || typeof navigator === 'undefined') {
    return
  }

  if (!('geolocation' in navigator)) {
    error.value = 'Geolocation is not supported by this browser.'
    return
  }

  watchId = navigator.geolocation.watchPosition(
    (result) => {
      position.value = mapPosition(result)
      error.value = ''
    },
    handleError,
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 2000
    }
  )
  isWatching.value = true
}

async function getCurrentPosition(): Promise<GeoPosition> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    throw new Error('Geolocation is not supported by this browser.')
  }

  isLoading.value = true

  return new Promise<GeoPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (result) => {
        const mapped = mapPosition(result)
        position.value = mapped
        error.value = ''
        isLoading.value = false
        resolve(mapped)
      },
      (err) => {
        handleError(err)
        isLoading.value = false
        reject(new Error(error.value))
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    )
  })
}

async function start(): Promise<GeoPosition> {
  startWatch()
  if (position.value) {
    return position.value
  }
  if (!startPromise) {
    startPromise = getCurrentPosition().finally(() => {
      startPromise = null
    })
  }
  return startPromise
}

async function refresh(): Promise<GeoPosition> {
  return getCurrentPosition()
}

function stop(): void {
  if (watchId !== null && typeof navigator !== 'undefined') {
    navigator.geolocation.clearWatch(watchId)
  }
  watchId = null
  isWatching.value = false
}

export function useGeolocation() {
  const hasPosition = computed(() => position.value !== null)

  return {
    position: readonly(position),
    error: readonly(error),
    isWatching: readonly(isWatching),
    isLoading: readonly(isLoading),
    hasPosition,
    start,
    refresh,
    stop
  }
}
