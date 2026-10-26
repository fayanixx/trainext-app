<template>
  <div class="geofence-map-wrapper font-aileron" :style="{ height }">
    <div ref="mapElement" class="geofence-map"></div>

    <!-- HUD Overlay -->
    <div class="map-status">
      <div class="badge-pill mb-2" :class="inside === true ? 'badge-pill-success' : inside === false ? 'badge-pill-danger' : 'badge-pill-amber'">
        <span class="w-2 h-2 rounded-full mr-1.5" :class="inside === true ? 'bg-emerald-400 animate-pulse' : inside === false ? 'bg-rose-400' : 'bg-amber-400'"></span>
        {{ inside === true ? 'INSIDE GEOFENCE' : inside === false ? 'OUTSIDE GEOFENCE' : 'AWAITING GPS' }}
      </div>

      <div v-if="site" class="status-grid-hud">
        <span>Distance to center</span>
        <strong class="text-[#00C2FF]">{{ distanceLabel }}</strong>
        <span>Allowed radius</span>
        <strong class="text-white">{{ site.radius_meters.toFixed(1) }} m</strong>
        <span>Boundary margin</span>
        <strong :class="inside ? 'text-emerald-400' : 'text-rose-400'">{{ marginLabel }}</strong>
        <span>GPS accuracy</span>
        <strong class="text-slate-300">{{ accuracyLabel }}</strong>
      </div>

      <p v-if="!site" class="status-note-hud">
        No company site is assigned. Your live position is still shown.
      </p>
      <p v-if="geoError" class="status-error-hud">{{ geoError }}</p>
    </div>

    <!-- Legend -->
    <div class="map-legend-hud">
      <span><i class="dot dot-site"></i> Site center</span>
      <span><i class="dot dot-intern"></i> Your position</span>
      <span><i class="line line-radius"></i> Geofence radius</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import L from 'leaflet'
import type { CompanySite } from '@/types'
import { useGeolocation } from '@/composables/useGeolocation'
import {
  formatDistanceMeters,
  haversineDistanceMeters,
  isStrictlyWithinGeofence
} from '@/lib/geofence'

const props = withDefaults(
  defineProps<{
    site: CompanySite | null
    height?: string
  }>(),
  {
    height: '380px'
  }
)

const emit = defineEmits<{
  position: [latitude: number, longitude: number]
}>()

const mapElement = ref<HTMLDivElement | null>(null)
const { position, error: geoError, start } = useGeolocation()

let map: L.Map | null = null
let siteCircle: L.Circle | null = null
let siteCenter: L.CircleMarker | null = null
let accuracyCircle: L.Circle | null = null
let internMarker: L.CircleMarker | null = null
let distanceLine: L.Polyline | null = null
let hasFitted = false

const distanceMeters = computed<number | null>(() => {
  if (!position.value || !props.site) {
    return null
  }
  return haversineDistanceMeters(
    {
      latitude: position.value.latitude,
      longitude: position.value.longitude
    },
    {
      latitude: props.site.latitude,
      longitude: props.site.longitude
    }
  )
})

const inside = computed<boolean | null>(() => {
  if (!position.value || !props.site) {
    return null
  }
  return isStrictlyWithinGeofence(
    {
      latitude: position.value.latitude,
      longitude: position.value.longitude
    },
    props.site
  )
})

const distanceLabel = computed(() =>
  distanceMeters.value === null ? '—' : formatDistanceMeters(distanceMeters.value)
)

const marginLabel = computed(() => {
  if (distanceMeters.value === null || !props.site) {
    return '—'
  }
  const margin = props.site.radius_meters - distanceMeters.value
  return margin >= 0
    ? `${formatDistanceMeters(margin)} inside`
    : `${formatDistanceMeters(Math.abs(margin))} outside`
})

const accuracyLabel = computed(() =>
  position.value?.accuracy
    ? `±${position.value.accuracy.toFixed(1)} m`
    : 'Unavailable'
)

function siteBounds(): L.LatLngBounds | null {
  if (!props.site) {
    return null
  }
  const center = L.latLng(props.site.latitude, props.site.longitude)
  const circle = L.circle(center, { radius: props.site.radius_meters })
  return circle.getBounds()
}

function fitMap(): void {
  if (!map) {
    return
  }

  if (props.site && position.value) {
    const bounds = siteBounds()
    bounds?.extend([position.value.latitude, position.value.longitude])
    if (bounds?.isValid()) {
      map.fitBounds(bounds.pad(0.25), { maxZoom: 18 })
      hasFitted = true
      return
    }
  }

  if (props.site) {
    map.setView([props.site.latitude, props.site.longitude], 17)
    hasFitted = true
    return
  }

  if (position.value) {
    map.setView([position.value.latitude, position.value.longitude], 17)
    hasFitted = true
  }
}

function drawSite(): void {
  if (!map) {
    return
  }

  if (siteCircle) {
    map.removeLayer(siteCircle)
    siteCircle = null
  }
  if (siteCenter) {
    map.removeLayer(siteCenter)
    siteCenter = null
  }

  if (!props.site) {
    return
  }

  siteCircle = L.circle([props.site.latitude, props.site.longitude], {
    radius: props.site.radius_meters,
    color: '#00C2FF',
    weight: 2,
    fillColor: '#00C2FF',
    fillOpacity: 0.15,
    dashArray: '8 6'
  }).addTo(map)

  siteCenter = L.circleMarker([props.site.latitude, props.site.longitude], {
    radius: 7,
    color: '#0284c7',
    weight: 2,
    fillColor: '#00C2FF',
    fillOpacity: 1
  })
    .bindTooltip(`${props.site.name} (${props.site.radius_meters.toFixed(1)} m radius)`)
    .addTo(map)
}

function drawPosition(): void {
  if (!map) {
    return
  }

  if (!position.value) {
    return
  }

  const point = L.latLng(position.value.latitude, position.value.longitude)
  emit('position', point.lat, point.lng)

  if (!internMarker) {
    internMarker = L.circleMarker(point, {
      radius: 8,
      color: '#10b981',
      weight: 3,
      fillColor: '#34d399',
      fillOpacity: 1
    })
      .bindTooltip('Your live GPS position')
      .addTo(map)
  } else {
    internMarker.setLatLng(point)
  }

  if (!accuracyCircle) {
    accuracyCircle = L.circle(point, {
      radius: position.value.accuracy ?? 0,
      color: '#34d399',
      weight: 1,
      fillColor: '#6ee7b7',
      fillOpacity: 0.08
    }).addTo(map)
  } else {
    accuracyCircle.setLatLng(point)
    accuracyCircle.setRadius(position.value.accuracy ?? 0)
  }

  if (props.site) {
    const center = L.latLng(props.site.latitude, props.site.longitude)
    if (!distanceLine) {
      distanceLine = L.polyline([point, center], {
        color: inside.value ? '#10b981' : '#f87171',
        weight: 2,
        dashArray: '4 6'
      }).addTo(map)
    } else {
      distanceLine.setLatLngs([point, center])
      distanceLine.setStyle({
        color: inside.value ? '#10b981' : '#f87171'
      })
    }
  } else if (distanceLine) {
    map.removeLayer(distanceLine)
    distanceLine = null
  }
}

watch(
  () => props.site,
  () => {
    drawSite()
    drawPosition()
    if (map && !hasFitted) {
      fitMap()
    }
  },
  { deep: true }
)

watch(
  position,
  () => {
    drawPosition()
    if (map && !hasFitted) {
      fitMap()
    }
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
  }).setView([14.5995, 120.9842], 13)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map)

  drawSite()
  drawPosition()
  fitMap()

  window.setTimeout(() => map?.invalidateSize(), 150)
  void start().catch(() => undefined)
})

onBeforeUnmount(() => {
  if (map) {
    map.remove()
    map = null
  }
  siteCircle = null
  siteCenter = null
  accuracyCircle = null
  internMarker = null
  distanceLine = null
})
</script>

<style scoped>
.font-aileron {
  font-family: 'Aileron', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
}

.geofence-map-wrapper {
  position: relative;
  width: 100%;
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.geofence-map {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.map-status {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  z-index: 500;
  pointer-events: none;
}

.status-grid-hud {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 3px 14px;
  max-width: 300px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(4, 9, 22, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  font-size: 11.5px;
  color: #cbd5e1;
}

.status-note-hud,
.status-error-hud {
  max-width: 320px;
  margin-top: 6px;
  padding: 8px 10px;
  border-radius: 12px;
  background: rgba(4, 9, 22, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 11.5px;
  color: #cbd5e1;
}

.status-error-hud {
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}

.map-legend-hud {
  position: absolute;
  left: 10px;
  bottom: 10px;
  z-index: 500;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  padding: 7px 12px;
  border-radius: 12px;
  background: rgba(4, 9, 22, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  font-size: 10.5px;
  color: #cbd5e1;
  pointer-events: none;
}

.map-legend-hud span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}

.dot-site {
  background: #00C2FF;
  border: 1.5px solid #0284c7;
}

.dot-intern {
  background: #34d399;
  border: 1.5px solid #10b981;
}

.line {
  width: 16px;
  height: 0;
  border-top: 2px dashed #00C2FF;
  display: inline-block;
}

.badge-pill {
  display: inline-flex !important;
  align-items: center !important;
  padding: 4px 10px !important;
  border-radius: 9999px !important;
  font-size: 10.5px !important;
  font-weight: 800 !important;
}

.badge-pill-success {
  background: rgba(16, 185, 129, 0.2) !important;
  color: #34d399 !important;
  border: 1px solid rgba(16, 185, 129, 0.4) !important;
}

.badge-pill-danger {
  background: rgba(239, 68, 68, 0.2) !important;
  color: #f87171 !important;
  border: 1px solid rgba(239, 68, 68, 0.4) !important;
}

.badge-pill-amber {
  background: rgba(245, 158, 11, 0.2) !important;
  color: #fbbf24 !important;
  border: 1px solid rgba(245, 158, 11, 0.4) !important;
}
</style>