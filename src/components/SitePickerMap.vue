<template>
  <div class="picker-wrap font-aileron" :style="{ height }">
    <div ref="mapElement" class="picker-map"></div>
    <div class="picker-hint-hud">
      <span class="w-2 h-2 rounded-full bg-[#00C2FF] animate-pulse"></span>
      Tap map to set geofence center
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'

const props = withDefaults(
  defineProps<{
    latitude: number
    longitude: number
    radiusMeters: number
    height?: string
  }>(),
  {
    height: '300px'
  }
)

const emit = defineEmits<{
  'update:latitude': [value: number]
  'update:longitude': [value: number]
}>()

const mapElement = ref<HTMLDivElement | null>(null)

let map: L.Map | null = null
let centerMarker: L.CircleMarker | null = null
let radiusCircle: L.Circle | null = null
let syncingFromMap = false

function applyCenter(latitude: number, longitude: number): void {
  if (!map) {
    return
  }

  const center = L.latLng(latitude, longitude)

  if (!centerMarker) {
    centerMarker = L.circleMarker(center, {
      radius: 8,
      color: '#0284c7',
      weight: 2,
      fillColor: '#00C2FF',
      fillOpacity: 1
    }).addTo(map)
  } else {
    centerMarker.setLatLng(center)
  }

  if (!radiusCircle) {
    radiusCircle = L.circle(center, {
      radius: props.radiusMeters,
      color: '#00C2FF',
      weight: 2,
      fillColor: '#00C2FF',
      fillOpacity: 0.16,
      dashArray: '8 6'
    }).addTo(map)
  } else {
    radiusCircle.setLatLng(center)
    radiusCircle.setRadius(props.radiusMeters)
  }
}

watch(
  () => [props.latitude, props.longitude],
  ([latitude, longitude]) => {
    if (syncingFromMap || !map) {
      return
    }
    const center = L.latLng(latitude, longitude)
    applyCenter(latitude, longitude)
    if (!map.getBounds().contains(center)) {
      map.setView(center, map.getZoom())
    }
  }
)

watch(
  () => props.radiusMeters,
  (radius) => {
    radiusCircle?.setRadius(radius)
  }
)

onMounted(async () => {
  await nextTick()

  if (!mapElement.value) {
    return
  }

  map = L.map(mapElement.value, {
    zoomControl: true,
    attributionControl: true
  }).setView([props.latitude, props.longitude], 17)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map)

  applyCenter(props.latitude, props.longitude)

  map.on('click', (event: L.LeafletMouseEvent) => {
    syncingFromMap = true
    emit('update:latitude', Number(event.latlng.lat.toFixed(7)))
    emit('update:longitude', Number(event.latlng.lng.toFixed(7)))
    applyCenter(event.latlng.lat, event.latlng.lng)
    map?.panTo(event.latlng)
    syncingFromMap = false
  })

  window.setTimeout(() => map?.invalidateSize(), 150)
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
  centerMarker = null
  radiusCircle = null
})
</script>

<style scoped>
.font-aileron {
  font-family: 'Aileron', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

.picker-wrap {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.picker-map {
  position: absolute;
  inset: 0;
}

.picker-hint-hud {
  position: absolute;
  top: 10px;
  left: 10px;
  z-index: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 9999px;
  background: rgba(4, 9, 22, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
  font-size: 11px;
  font-weight: 700;
  color: #e2e8f0;
  pointer-events: none;
}
</style>