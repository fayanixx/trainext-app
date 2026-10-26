import { ref, onMounted, onUnmounted } from 'vue';
import type { Coordinates } from '@/lib/geofence';

export function useGeolocation() {
  const coordinates = ref<Coordinates | null>(null);
  const accuracy = ref<number | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  let watchId: number | null = null;

  const updateCoordinates = (position: GeolocationPosition) => {
    coordinates.value = {
      latitude: Number(position.coords.latitude.toFixed(6)),
      longitude: Number(position.coords.longitude.toFixed(6)),
    };
    accuracy.value = Math.round(position.coords.accuracy);
    loading.value = false;
    error.value = null;
  };

  const handleError = (err: GeolocationPositionError) => {
    loading.value = false;
    switch (err.code) {
      case err.PERMISSION_DENIED:
        error.value = 'Location access was denied. Please allow location permissions in your browser or phone settings.';
        break;
      case err.POSITION_UNAVAILABLE:
        error.value = 'Location data is currently unavailable. Ensure GPS is enabled on your device.';
        break;
      case err.TIMEOUT:
        error.value = 'GPS location request timed out. Please refresh and check your signal.';
        break;
      default:
        error.value = 'An unexpected geolocation error occurred.';
        break;
    }
  };

  const startWatching = () => {
    if (!navigator.geolocation) {
      error.value = 'Geolocation is not supported by your current browser or mobile platform.';
      loading.value = false;
      return;
    }

    loading.value = true;
    error.value = null;

    // Direct fetch first
    navigator.geolocation.getCurrentPosition(updateCoordinates, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0,
    });

    // Continuous real-time location watching
    watchId = navigator.geolocation.watchPosition(updateCoordinates, handleError, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
    });
  };

  const stopWatching = () => {
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  };

  const refreshLocation = async (): Promise<Coordinates | null> => {
    loading.value = true;
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        error.value = 'Geolocation not supported.';
        loading.value = false;
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateCoordinates(pos);
          resolve(coordinates.value);
        },
        (err) => {
          handleError(err);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  };

  onMounted(() => {
    startWatching();
  });

  onUnmounted(() => {
    stopWatching();
  });

  return {
    coordinates,
    accuracy,
    loading,
    error,
    refreshLocation,
  };
}