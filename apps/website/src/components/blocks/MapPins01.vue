<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import type * as Leaflet from 'leaflet'
import type { HTMLAttributes } from 'vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

import 'leaflet/dist/leaflet.css'
import worldCountriesUrl from '../../assets/world-countries.json?url'

export type MapPinMarker = {
  id: string
  coords: { lat: number; lng: number }
  label: string
}

const {
  markers,
  ariaLabel,
  class: className
} = defineProps<{
  markers: MapPinMarker[]
  ariaLabel?: string
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{ select: [id: string] }>()

type WorldGeoJson = NonNullable<Parameters<typeof Leaflet.geoJSON>[0]>

const container = ref<HTMLElement | null>(null)

// Leaflet touches window at import time, so it only loads in the browser
// (onMounted) and stays out of the SSR bundle.
let leaflet: typeof Leaflet | null = null
let map: Leaflet.Map | null = null
let pinLayer: Leaflet.LayerGroup | null = null

const OCEAN = '#211927'
const COUNTRY_FILL = '#2a2330'
const COUNTRY_BORDER = '#3b3242'
const PIN_FILL = '#f0efed'
const CLUSTER_FILL = '#f2ff59'
const CLUSTER_TEXT = '#211927'

function pinHtml(count: number): string {
  if (count === 1) {
    return `<div style="width:8px;height:8px;border-radius:9999px;background:${PIN_FILL};box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`
  }
  return `<div style="display:flex;align-items:center;justify-content:center;width:31px;height:31px;border-radius:10px;background:${CLUSTER_FILL};color:${CLUSTER_TEXT};font-weight:600;font-size:14px;box-shadow:0 1px 6px rgba(0,0,0,0.4)">${count}</div>`
}

/** Cluster by on-screen pixel distance at the current zoom. */
function rebuildPins() {
  const L = leaflet
  if (!L || !map || !pinLayer) return
  pinLayer.clearLayers()
  const clusters: { point: Leaflet.Point; items: MapPinMarker[] }[] = []
  for (const item of markers) {
    const point = map.latLngToContainerPoint([item.coords.lat, item.coords.lng])
    const hit = clusters.find((c) => c.point.distanceTo(point) < 48)
    if (hit) hit.items.push(item)
    else clusters.push({ point, items: [item] })
  }
  for (const cluster of clusters) {
    const size = cluster.items.length > 1 ? 31 : 8
    const marker = L.marker(map.containerPointToLatLng(cluster.point), {
      icon: L.divIcon({
        html: pinHtml(cluster.items.length),
        className: '',
        iconSize: [size, size]
      }),
      title: cluster.items.length === 1 ? cluster.items[0].label : undefined,
      alt: cluster.items.map((item) => item.label).join(', ')
    })
    if (cluster.items.length > 1) {
      marker.on('click', () => {
        map?.flyToBounds(
          L.latLngBounds(
            cluster.items.map((item) => [item.coords.lat, item.coords.lng])
          ),
          { padding: [60, 60], maxZoom: 7 }
        )
      })
    } else {
      marker.on('click', () => emit('select', cluster.items[0].id))
    }
    marker.addTo(pinLayer)
  }
}

onMounted(async () => {
  if (!container.value) return
  const [L, geoJson] = await Promise.all([
    import('leaflet'),
    fetch(worldCountriesUrl).then((res) => res.json() as Promise<WorldGeoJson>)
  ])
  leaflet = L
  map = L.map(container.value, {
    center: [30, 10],
    zoom: 2,
    minZoom: 2,
    // The committed basemap is intentionally low-res; past this zoom the
    // country shapes read as noise.
    maxZoom: 7,
    zoomControl: true,
    scrollWheelZoom: false,
    attributionControl: false,
    worldCopyJump: true
  })
  L.geoJSON(geoJson, {
    style: {
      color: COUNTRY_BORDER,
      weight: 0.5,
      fillColor: COUNTRY_FILL,
      fillOpacity: 1
    }
  }).addTo(map)
  pinLayer = L.layerGroup().addTo(map)
  rebuildPins()
  map.on('zoomend moveend', rebuildPins)
})

watch(
  () => markers,
  () => rebuildPins()
)

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <!-- `isolate`: Leaflet's panes carry z-index 400-700, so without a stacking
  context here they paint over any portaled overlay on the page (the directory's
  SAVE THE DATE? menu sits right beside the map). -->
  <div
    role="region"
    :aria-label="ariaLabel"
    :class="cn('relative isolate h-140 overflow-hidden rounded-3xl', className)"
    :style="{ background: OCEAN }"
  >
    <div
      ref="container"
      class="absolute inset-0"
      :style="{ background: OCEAN }"
    />
  </div>
</template>

<!-- Leaflet renders its own DOM, unreachable by Tailwind classes on our
template — the scoped block reskins its zoom control to the site palette. -->
<style scoped>
:deep(.leaflet-bar) {
  border: none;
}

:deep(.leaflet-bar a) {
  border-color: rgb(255 255 255 / 0.1);
  background-color: #2a2330;
  color: #f0efed;
}

:deep(.leaflet-bar a:hover),
:deep(.leaflet-bar a:focus) {
  background-color: #3b3242;
  color: #f2ff59;
}

:deep(.leaflet-bar a.leaflet-disabled) {
  background-color: #2a2330;
  color: rgb(240 239 237 / 0.3);
}
</style>
