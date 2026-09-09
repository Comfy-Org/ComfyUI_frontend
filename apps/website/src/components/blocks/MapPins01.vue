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
  regionLabel,
  clusterLabel = (labels: string[]) => labels.join(', '),
  class: className
} = defineProps<{
  markers: MapPinMarker[]
  /** Names the `role="region"` landmark — WAI-ARIA requires one. */
  regionLabel: string
  /** Accessible name for a cluster badge, built from its pins' labels. */
  clusterLabel?: (labels: string[]) => string
  class?: HTMLAttributes['class']
}>()

const emit = defineEmits<{ select: [id: string] }>()

type WorldGeoJson = NonNullable<Parameters<typeof Leaflet.geoJSON>[0]>

type LeafletModule = typeof Leaflet & { default?: typeof Leaflet }

const container = ref<HTMLElement | null>(null)

// Leaflet touches window at import time, so it only loads in the browser
// (onMounted) and stays out of the SSR bundle.
let leaflet: typeof Leaflet | null = null
let map: Leaflet.Map | null = null
let pinLayer: Leaflet.LayerGroup | null = null

// Aborts the world-shape fetch and stops `mountMap` from touching the cleared
// template ref when the component unmounts mid-setup.
const disposal = new AbortController()

// The palette comes from the site theme tokens in `global.css`. The divIcon
// HTML resolves `var()` like any inline style, but Leaflet writes its vector
// colors into SVG presentation attributes, where `var()` never resolves — so
// those are read into concrete values once the container is in the DOM.
const PIN_FILL = 'var(--color-primary-warm-white)'
let countryFill = ''
let countryBorder = ''
let legStroke = ''

function pinHtml(count: number): string {
  if (count === 1) {
    return `<div style="width:8px;height:8px;border-radius:9999px;background:${PIN_FILL};box-shadow:0 1px 4px rgba(0,0,0,0.5)"></div>`
  }
  return `<div style="display:flex;align-items:center;justify-content:center;width:31px;height:31px;border-radius:10px;background:var(--color-primary-comfy-yellow);color:var(--color-primary-comfy-ink);font-weight:600;font-size:14px;box-shadow:0 1px 6px rgba(0,0,0,0.4)">${count}</div>`
}

// Events that share (near-)identical coordinates project to the same pixel at
// every zoom, so their cluster badge can never split by zooming alone. Once a
// click on such a badge is confirmed still-coincident after flying in, its
// ids move here and `rebuildPins` fans them into a small ring of individually
// clickable pins instead of re-clustering them.
const spiderfiedIds = ref<Set<string>>(new Set())

type PixelGroup = { point: Leaflet.Point; items: MapPinMarker[] }

function groupByPixelDistance(map: Leaflet.Map, items: MapPinMarker[]) {
  const groups: PixelGroup[] = []
  for (const item of items) {
    const point = map.latLngToContainerPoint([item.coords.lat, item.coords.lng])
    const hit = groups.find((group) => group.point.distanceTo(point) < 48)
    if (hit) hit.items.push(item)
    else groups.push({ point, items: [item] })
  }
  return groups
}

function addLeafMarker(
  L: typeof Leaflet,
  point: Leaflet.Point,
  item: MapPinMarker
) {
  if (!map || !pinLayer) return
  const marker = L.marker(map.containerPointToLatLng(point), {
    icon: L.divIcon({ html: pinHtml(1), className: '', iconSize: [8, 8] }),
    title: item.label,
    alt: item.label
  })
  marker.on('click', () => emit('select', item.id))
  marker.addTo(pinLayer)
}

function addClusterMarker(L: typeof Leaflet, cluster: PixelGroup) {
  if (!map || !pinLayer) return
  const marker = L.marker(map.containerPointToLatLng(cluster.point), {
    icon: L.divIcon({
      html: pinHtml(cluster.items.length),
      className: '',
      iconSize: [31, 31]
    }),
    // `alt` names only `<img>` icons; a divIcon renders a `<div>`, which
    // Leaflet names via the `title` attribute instead.
    title: clusterLabel(cluster.items.map((item) => item.label))
  })
  marker.on('click', () => onClusterClick(cluster.items))
  marker.addTo(pinLayer)
}

/** Fans a still-coincident group into a ring of leaf pins around its shared
 * point, connected by thin legs so the spiderfy reads as one expanded pin. */
function addSpiderfiedGroup(L: typeof Leaflet, group: PixelGroup) {
  if (!map || !pinLayer) return
  const { point, items } = group
  const radius = Math.max(28, Math.round((items.length * 14) / (2 * Math.PI)))
  items.forEach((item, index) => {
    const angle = (2 * Math.PI * index) / items.length - Math.PI / 2
    const legEnd = point.add(
      L.point(Math.cos(angle) * radius, Math.sin(angle) * radius)
    )
    L.polyline(
      [map!.containerPointToLatLng(point), map!.containerPointToLatLng(legEnd)],
      { color: legStroke, weight: 1, opacity: 0.35, interactive: false }
    ).addTo(pinLayer!)
    addLeafMarker(L, legEnd, item)
  })
}

/** Flies to the cluster's bounds, then checks whether its members are still
 * pixel-coincident at the landed zoom (capped by `maxZoom`) — if so, flying
 * in further can never separate them, so spiderfy instead. */
function onClusterClick(items: MapPinMarker[]) {
  const L = leaflet
  if (!L || !map) return
  const bounds = L.latLngBounds(
    items.map((item) => [item.coords.lat, item.coords.lng])
  )
  map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 7 })
  map.once('moveend', () => {
    if (!map) return
    const anchor = map.latLngToContainerPoint([
      items[0].coords.lat,
      items[0].coords.lng
    ])
    const stillCoincident = items.every(
      (item) =>
        map!
          .latLngToContainerPoint([item.coords.lat, item.coords.lng])
          .distanceTo(anchor) < 48
    )
    if (!stillCoincident) return
    for (const item of items) spiderfiedIds.value.add(item.id)
    rebuildPins()
  })
}

/** Cluster by on-screen pixel distance at the current zoom. */
function rebuildPins() {
  const L = leaflet
  if (!L || !map || !pinLayer) return
  pinLayer.clearLayers()

  const clusterable = markers.filter(
    (item) => !spiderfiedIds.value.has(item.id)
  )
  for (const group of groupByPixelDistance(map, clusterable)) {
    if (group.items.length > 1) addClusterMarker(L, group)
    else addLeafMarker(L, group.point, group.items[0])
  }

  const spiderfied = markers.filter((item) => spiderfiedIds.value.has(item.id))
  for (const group of groupByPixelDistance(map, spiderfied)) {
    addSpiderfiedGroup(L, group)
  }
}

onMounted(async () => {
  await mountMap().catch((error: unknown) => {
    if (disposal.signal.aborted) return
    // Without this the map just stays blank: an async onMounted that throws
    // surfaces only as an unhandled rejection, if at all.
    console.error('[MapPins01] failed to initialise the map', error)
  })
})

async function mountMap() {
  if (!container.value) return
  const styles = getComputedStyle(container.value)
  countryFill = styles.getPropertyValue('--color-site-map-land').trim()
  countryBorder = styles.getPropertyValue('--color-site-map-land-border').trim()
  legStroke = styles.getPropertyValue('--color-primary-warm-white').trim()
  const [imported, geoJson] = await Promise.all([
    import('leaflet') as Promise<LeafletModule>,
    fetch(worldCountriesUrl, { signal: disposal.signal }).then(
      (res) => res.json() as Promise<WorldGeoJson>
    )
  ])
  // Vue clears the template ref if the component unmounts while the imports
  // above are in flight; `L.map(null)` would then throw and stay blank.
  if (disposal.signal.aborted || !container.value) return
  // `leaflet` publishes only a UMD build — no "module" or "exports" entry — so
  // the bundler's CJS interop hangs the whole namespace off `default`. The
  // named exports its types promise are not there at runtime.
  const L = imported.default ?? imported
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
      color: countryBorder,
      weight: 0.75,
      fillColor: countryFill,
      fillOpacity: 1
    }
  }).addTo(map)
  pinLayer = L.layerGroup().addTo(map)
  rebuildPins()
  map.on('zoomend moveend', rebuildPins)
}

watch(
  () => markers,
  () => {
    spiderfiedIds.value = new Set()
    rebuildPins()
  }
)

onBeforeUnmount(() => {
  disposal.abort()
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
    :aria-label="regionLabel"
    :class="
      cn(
        'bg-site-map-ocean relative isolate h-140 overflow-hidden rounded-3xl',
        className
      )
    "
  >
    <div ref="container" class="bg-site-map-ocean absolute inset-0" />
  </div>
</template>

<!-- Leaflet renders its own DOM, unreachable by Tailwind classes on our
template — the scoped block reskins its zoom control to the site palette. -->
<style scoped>
:deep(.leaflet-bar) {
  border: none;
}

:deep(.leaflet-bar a) {
  border-color: var(--color-transparency-white-t8);
  background-color: var(--color-primary-comfy-ink-light);
  color: var(--color-primary-warm-white);
}

:deep(.leaflet-bar a:hover),
:deep(.leaflet-bar a:focus) {
  background-color: color-mix(
    in srgb,
    var(--color-primary-comfy-ink-light) 88%,
    white 12%
  );
  color: var(--color-primary-comfy-yellow);
}

:deep(.leaflet-bar a.leaflet-disabled) {
  background-color: var(--color-primary-comfy-ink-light);
  color: color-mix(in srgb, var(--color-primary-warm-white) 30%, transparent);
}
</style>
