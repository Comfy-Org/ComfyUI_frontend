import { fromAny } from '@total-typescript/shoehorn'
import { render, screen, within } from '@testing-library/vue'
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
  }
  const markers: Array<{
    title: string | undefined
    click: (() => void) | undefined
  }> = []
  const flyToBoundsCalls: unknown[] = []
  const fitBoundsCalls: unknown[] = []
  const moveendCallbacks: Array<() => void> = []
  const popups: Array<{ latLng: unknown; content: HTMLElement }> = []
  const closePopupCalls: number[] = []
  // Real leaflet fires `movestart` synchronously inside flyToBounds/fitBounds
  // whenever the view actually changes; set false to fake a fly with nowhere
  // to go (bounds already framed), which fires neither movestart nor moveend.
  const flyState = { moves: true }
  return {
    FakePoint,
    markers,
    flyToBoundsCalls,
    fitBoundsCalls,
    moveendCallbacks,
    popups,
    closePopupCalls,
    flyState
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
    moveendCallbacks,
    popups,
    closePopupCalls,
    flyState
  } = leafletState
  const movestartCallbacks: Array<() => void> = []
  const noteMoveIfAny = () => {
    if (flyState.moves) for (const handler of movestartCallbacks) handler()
  }
  const fakeMap = {
    latLngToContainerPoint: ([lat, lng]: [number, number]) =>
      new FakePoint(lng, lat),
    containerPointToLatLng: (point: InstanceType<typeof FakePoint>) => ({
      lat: point.y,
      lng: point.x
    }),
    on: (event: string, handler: () => void) => {
      if (event === 'movestart') movestartCallbacks.push(handler)
      return fakeMap
    },
    once: (_event: string, handler: () => void) => {
      moveendCallbacks.push(handler)
      return fakeMap
    },
    off: (_event: string, handler: () => void) => {
      for (const callbacks of [moveendCallbacks, movestartCallbacks]) {
        const index = callbacks.indexOf(handler)
        if (index !== -1) callbacks.splice(index, 1)
      }
      return fakeMap
    },
    flyToBounds: (...args: unknown[]) => {
      flyToBoundsCalls.push(args)
      noteMoveIfAny()
      return fakeMap
    },
    fitBounds: (...args: unknown[]) => {
      fitBoundsCalls.push(args)
      noteMoveIfAny()
      return fakeMap
    },
    closePopup: () => {
      closePopupCalls.push(1)
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
  const popup = () => {
    const content: HTMLElement = document.createElement('div')
    const record = {
      latLng: undefined as unknown,
      content,
      setLatLng(latLng: unknown) {
        record.latLng = latLng
        return record
      },
      setContent(content: HTMLElement) {
        record.content = content
        return record
      },
      openOn() {
        popups.push(record)
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
    popup,
    latLngBounds: (coords: Array<[number, number]>) => coords
  }
  // The fake covers only the surface MapPins01 touches, so it cannot satisfy
  // leaflet's full module type without this widening.
  return fromAny<typeof Leaflet, unknown>({ default: fake })
})

// One pixel per degree: the first two pins sit 10px apart (clustered), the
// third 500px away (a leaf pin of its own).
const markers: MapPinMarker[] = [
  {
    id: 'paris',
    coords: { lat: 0, lng: 0 },
    label: 'Paris',
    meta: 'Jul 4 · Paris, France'
  },
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
    leafletState.popups.splice(0)
    leafletState.closePopupCalls.splice(0)
    leafletState.flyState.moves = true
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

  it('opens an event-list popup for a still-coincident cluster and selects on an entry click', async () => {
    const { emitted } = render(MapPins01, {
      props: {
        markers,
        regionLabel: 'Event map',
        popupTitle: (count: number) => `${count} events here`
      }
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
    // 10px apart — coincident — and the popup opens with both events.
    leafletState.moveendCallbacks[0]()

    expect(leafletState.popups).toHaveLength(1)
    const popup = within(leafletState.popups[0].content)
    expect(popup.getByText('2 events here')).toBeTruthy()
    expect(popup.getByText('Jul 4 · Paris, France')).toBeTruthy()

    const lyonEntry = popup.getByRole('button', { name: 'Lyon' })
    lyonEntry.click()
    expect(emitted('select')).toEqual([['lyon']])
    expect(leafletState.closePopupCalls).toHaveLength(1)
  })

  it('opens the popup immediately when the fly has nowhere to go', async () => {
    leafletState.flyState.moves = false
    render(MapPins01, {
      props: { markers, regionLabel: 'Event map' }
    })
    await waitForPins(2)

    leafletState.markers
      .find((marker) => marker.title === 'Paris, Lyon')
      ?.click?.()

    // No movestart and no moveend will ever fire, so waiting on the landing
    // would leave the badge a dead end; the popup opens synchronously.
    expect(leafletState.popups).toHaveLength(1)
    expect(leafletState.moveendCallbacks).toHaveLength(0)
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

    expect(leafletState.popups).toHaveLength(1)
    const popup = within(leafletState.popups[0].content)
    expect(popup.getByRole('button', { name: 'Tokyo' })).toBeTruthy()
    expect(popup.getByRole('button', { name: 'Osaka' })).toBeTruthy()
    expect(popup.queryByRole('button', { name: /Paris/ })).toBeNull()
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
    // The listener is in place before the synchronous jump, so the popup
    // still opens.
    expect(leafletState.moveendCallbacks).toHaveLength(1)
    leafletState.moveendCallbacks[0]()
    expect(leafletState.popups).toHaveLength(1)
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
