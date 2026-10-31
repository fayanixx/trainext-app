import { ref, onMounted, onUnmounted } from 'vue';
import { Geolocation, type Position } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import type { Coordinates } from '@/lib/geofence';

export function useGeolocation() {
  const coordinates = ref<Coordinates | null>(null);
  const accuracy = ref<number | null>(null);
  const loading = ref(true);
  const error = ref<string | null>(null);
  let nativeWatchId: string | null = null;
  let browserWatchId: number | null = null;

  const setCoords = (lat: number, lng: number, acc?: number) => {
    coordinates.value = {
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
    };
    if (typeof acc === 'number') {
      accuracy.value = Math.round(acc);
    }
    loading.value = false;
    error.value = null;
  };

  const verifyPermissions = async (): Promise<boolean> => {
    if (Capacitor.isNativePlatform()) {
      try {
        let status = await Geolocation.checkPermissions();
        if (status.location !== 'granted') {
          status = await Geolocation.requestPermissions();
        }
        if (status.location !== 'granted') {
          error.value = 'Location permission was denied. Please allow it in App Settings.';
          return false;
        }
        return true;
      } catch (err: any) {
        error.value = err.message || 'Failed to request native location permission.';
        return false;
      }
    }
    return true;
  };

  const startWatching = async () => {
    loading.value = true;
    error.value = null;

    const hasPerm = await verifyPermissions();
    if (!hasPerm) {
      loading.value = false;
      return;
    }

    if (Capacitor.isNativePlatform()) {
      // 1. Native Capacitor Geolocation for Android
      try {
        const initialPos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
        setCoords(initialPos.coords.latitude, initialPos.coords.longitude, initialPos.coords.accuracy);

        nativeWatchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 3000,
          },
          (position: Position | null, err) => {
            if (err) {
              console.warn('Native GPS Watch warning:', err);
              return;
            }
            if (position) {
              setCoords(position.coords.latitude, position.coords.longitude, position.coords.accuracy);
            }
          }
        );
      } catch (err: any) {
        loading.value = false;
        error.value = 'Please turn on your phone GPS / Location services.';
        console.error('Native Geolocation failed:', err);
      }
    } else {
      // 2. Browser Fallback
      if (!navigator.geolocation) {
        error.value = 'Geolocation is not supported by your browser.';
        loading.value = false;
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => setCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        (err) => {
          loading.value = false;
          error.value = err.message;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      browserWatchId = navigator.geolocation.watchPosition(
        (pos) => setCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
        (err) => console.warn('Browser watch warning:', err),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
      );
    }
  };

  const stopWatching = async () => {
    if (nativeWatchId) {
      try {
        await Geolocation.clearWatch({ id: nativeWatchId });
      } catch (_) {}
      nativeWatchId = null;
    }
    if (browserWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(browserWatchId);
      browserWatchId = null;
    }
  };

  const refreshLocation = async (): Promise<Coordinates | null> => {
    loading.value = true;

    const hasPerm = await verifyPermissions();
    if (!hasPerm) {
      loading.value = false;
      return null;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
        setCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
        return coordinates.value;
      } catch (err: any) {
        loading.value = false;
        error.value = 'Unable to get location. Ensure device GPS is ON.';
        return null;
      }
    } else {
      return new Promise((resolve) => {
        if (!navigator.geolocation) {
          loading.value = false;
          resolve(null);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setCoords(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
            resolve(coordinates.value);
          },
          (err) => {
            loading.value = false;
            error.value = err.message;
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      });
    }
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