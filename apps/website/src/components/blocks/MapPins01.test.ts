// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import type * as Leaflet from 'leaflet'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MapPins01 from './MapPins01.vue'
import type { MapPinMarker } from './MapPins01.vue'

type FakeMarker = {
  title: string | undefined
  click: (() => void) | undefined
  on: (event: string, handler: () => void) => FakeMarker
  addTo: (layer: unknown) => FakeMarker
}

const leafletState = vi.hoisted(() => {
  class FakePoint {
    constructor(
      public x: number,
      public y: number
    ) {}
    distanceTo(other: FakePoint): number {
      return Math.hypot(this.x - other.x, this.y - other.y)
    }
    add(other: FakePoint): FakePoint {
      return new FakePoint(this.x + other.x, this.y + other.y)
    }
  }
  const markers: Array<{
    title: string | undefined
    click: (() => void) | undefined
  }> = []
  const flyToBoundsCalls: unknown[] = []
  const fitBoundsCalls: unknown[] = []
  const moveendCallbacks: Array<() => void> = []
  return {
    FakePoint,
    markers,
    flyToBoundsCalls,
    fitBoundsCalls,
    moveendCallbacks
  }
})

// The component's dynamic `import('leaflet')` resolves to this fake; the map
// projects one degree of longitude/latitude to one container pixel so the
// 48px cluster threshold is easy to reason about in test coordinates.
vi.mock(import('leaflet'), () => {
  const {
    FakePoint,
    markers,
    flyToBoundsCalls,
    fitBoundsCalls,
    moveendCallbacks
  } = leafletState
  const fakeMap = {
    latLngToContainerPoint: ([lat, lng]: [number, number]) =>
      new FakePoint(lng, lat),
    containerPointToLatLng: (point: InstanceType<typeof FakePoint>) => ({
      lat: point.y,
      lng: point.x
    }),
    on: () => fakeMap,
    once: (_event: string, handler: () => void) => {
      moveendCallbacks.push(handler)
      return fakeMap
    },
    off: (_event: string, handler: () => void) => {
      const index = moveendCallbacks.indexOf(handler)
      if (index !== -1) moveendCallbacks.splice(index, 1)
      return fakeMap
    },
    flyToBounds: (...args: unknown[]) => {
      flyToBoundsCalls.push(args)
      return fakeMap
    },
    fitBounds: (...args: unknown[]) => {
      fitBoundsCalls.push(args)
      return fakeMap
    },
    remove: () => undefined
  }
  const layerGroup = () => {
    const group = {
      addTo: () => group,
      clearLayers: () => markers.splice(0)
    }
    return group
  }
  const marker = (_latLng: unknown, options: { title?: string }) => {
    const record: FakeMarker = {
      title: options.title,
      click: undefined,
      on(_event, handler) {
        record.click = handler
        return record
      },
      addTo() {
        markers.push(record)
        return record
      }
    }
    return record
  }
  const fake = {
    map: () => fakeMap,
    marker,
    divIcon: (options: unknown) => options,
    geoJSON: () => ({ addTo: () => undefined }),
    layerGroup,
    point: (x: number, y: number) => new FakePoint(x, y),
    polyline: () => ({ addTo: () => undefined }),
    latLngBounds: (coords: Array<[number, number]>) => coords
  }
  // The fake covers only the surface MapPins01 touches, so it cannot satisfy
  // leaflet's full module type without this widening.
  return { default: fake } as unknown as typeof Leaflet
})

// One pixel per degree: the first two pins sit 10px apart (clustered), the
// third 500px away (a leaf pin of its own).
const markers: MapPinMarker[] = [
  { id: 'paris', coords: { lat: 0, lng: 0 }, label: 'Paris' },
  { id: 'lyon', coords: { lat: 0, lng: 10 }, label: 'Lyon' },
  { id: 'tokyo', coords: { lat: 0, lng: 500 }, label: 'Tokyo' }
]

let fetchSignal: AbortSignal | null | undefined

async function waitForPins(count: number) {
  await vi.waitFor(() => {
    expect(leafletState.markers).toHaveLength(count)
  })
}

describe('MapPins01', () => {
  beforeEach(() => {
    leafletState.markers.splice(0)
    leafletState.flyToBoundsCalls.splice(0)
    leafletState.fitBoundsCalls.splice(0)
    leafletState.moveendCallbacks.splice(0)
    fetchSignal = undefined
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        fetchSignal = init?.signal
        return new Response(
          JSON.stringify({ type: 'FeatureCollection', features: [] })
        )
      })
    )
  })

  it('names the region landmark with the given aria label', () => {
    render(MapPins01, { props: { markers, regionLabel: 'Event map' } })
    expect(screen.getByRole('region', { name: 'Event map' })).toBeTruthy()
  })

  it('clusters pixel-close pins, leaves distant ones single, and emits select on a leaf click', async () => {
    const { emitted } = render(MapPins01, {
      props: { markers, regionLabel: 'Event map' }
    })
    await waitForPins(2)

    const cluster = leafletState.markers.find(
      (marker) => marker.title === 'Paris, Lyon'
    )
    expect(cluster).toBeTruthy()

    const leaf = leafletState.markers.find((marker) => marker.title === 'Tokyo')
    expect(leaf).toBeTruthy()
    leaf?.click?.()
    expect(emitted('select')).toEqual([['tokyo']])
  })

  it('names cluster markers via the clusterLabel prop', async () => {
    render(MapPins01, {
      props: {
        markers,
        regionLabel: 'Event map',
        clusterLabel: (labels: string[]) => `${labels.length} cities`
      }
    })
    await waitForPins(2)

    expect(
      leafletState.markers.some((marker) => marker.title === '2 cities')
    ).toBe(true)
  })

  it('spiderfies a still-coincident cluster after flying in and selects on a leaf click', async () => {
    const { emitted } = render(MapPins01, {
      props: { markers, regionLabel: 'Event map' }
    })
    await waitForPins(2)

    const cluster = leafletState.markers.find(
      (marker) => marker.title === 'Paris, Lyon'
    )
    cluster?.click?.()

    // The click flies to the cluster's bounds and defers the coincidence
    // check to the fly's `moveend`.
    expect(leafletState.flyToBoundsCalls).toHaveLength(1)
    expect(leafletState.moveendCallbacks).toHaveLength(1)

    // The fake map never changes zoom, so once landed the pins are still
    // 10px apart — coincident — and the group fans into leaf pins.
    leafletState.moveendCallbacks[0]()

    const titles = leafletState.markers.map((marker) => marker.title)
    expect(titles.toSorted()).toEqual(['Lyon', 'Paris', 'Tokyo'])

    const lyon = leafletState.markers.find((marker) => marker.title === 'Lyon')
    lyon?.click?.()
    expect(emitted('select')).toEqual([['lyon']])
  })

  it('cancels an unfinished cluster check when another cluster is clicked', async () => {
    const twoClusters: MapPinMarker[] = [
      ...markers.slice(0, 2),
      { id: 'tokyo', coords: { lat: 0, lng: 500 }, label: 'Tokyo' },
      { id: 'osaka', coords: { lat: 0, lng: 510 }, label: 'Osaka' }
    ]
    render(MapPins01, {
      props: { markers: twoClusters, regionLabel: 'Event map' }
    })
    await waitForPins(2)

    leafletState.markers
      .find((marker) => marker.title === 'Paris, Lyon')
      ?.click?.()
    leafletState.markers
      .find((marker) => marker.title === 'Tokyo, Osaka')
      ?.click?.()

    expect(leafletState.moveendCallbacks).toHaveLength(1)
    leafletState.moveendCallbacks[0]()

    expect(
      leafletState.markers.map((marker) => marker.title).toSorted()
    ).toEqual(['Osaka', 'Paris, Lyon', 'Tokyo'])
  })

  it('jumps to the cluster instead of flying when reduced motion is preferred', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }))
    render(MapPins01, { props: { markers, regionLabel: 'Event map' } })
    await waitForPins(2)

    leafletState.markers
      .find((marker) => marker.title === 'Paris, Lyon')
      ?.click?.()

    expect(leafletState.flyToBoundsCalls).toHaveLength(0)
    expect(leafletState.fitBoundsCalls).toHaveLength(1)
    expect(leafletState.fitBoundsCalls[0]).toMatchObject([
      expect.anything(),
      { animate: false, maxZoom: 7 }
    ])
    // The listener is in place before the synchronous jump, so the spiderfy
    // still runs.
    expect(leafletState.moveendCallbacks).toHaveLength(1)
    leafletState.moveendCallbacks[0]()
    expect(
      leafletState.markers.map((marker) => marker.title).toSorted()
    ).toEqual(['Lyon', 'Paris', 'Tokyo'])
  })

  it('aborts the world-shape fetch when unmounted mid-setup', () => {
    const { unmount } = render(MapPins01, {
      props: { markers, regionLabel: 'Event map' }
    })
    expect(fetchSignal?.aborted).toBe(false)
    unmount()
    expect(fetchSignal?.aborted).toBe(true)
  })
})
