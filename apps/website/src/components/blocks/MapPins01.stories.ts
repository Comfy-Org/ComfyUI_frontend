import type { Meta, StoryObj } from '@storybook/vue3-vite'

import MapPins01 from './MapPins01.vue'
import type { MapPinMarker } from './MapPins01.vue'

const worldMarkers: MapPinMarker[] = [
  {
    id: 'la',
    coords: { lat: 34.02, lng: -118.4 },
    label: 'LA Meetup'
  },
  {
    id: 'sf',
    coords: { lat: 37.77, lng: -122.42 },
    label: 'SF Community Meetup'
  },
  {
    id: 'nyc',
    coords: { lat: 40.71, lng: -74.01 },
    label: 'NYC Hack Night'
  },
  {
    id: 'montreal',
    coords: { lat: 45.51, lng: -73.57 },
    label: 'Montréal Workshop'
  },
  {
    id: 'sao-paulo',
    coords: { lat: -23.55, lng: -46.63 },
    label: 'São Paulo Hack Weekend'
  },
  {
    id: 'london',
    coords: { lat: 51.51, lng: -0.13 },
    label: 'Comfy Cloud Jam — London'
  },
  {
    id: 'paris',
    coords: { lat: 48.86, lng: 2.35 },
    label: 'Paris Hack Night'
  },
  {
    id: 'bengaluru',
    coords: { lat: 12.97, lng: 77.59 },
    label: 'Students Build With Comfy — Bengaluru'
  },
  {
    id: 'tokyo',
    coords: { lat: 35.68, lng: 139.69 },
    label: 'Tokyo Creators Meetup'
  }
]

const meta: Meta<typeof MapPins01> = {
  title: 'Website/Blocks/MapPins01',
  component: MapPins01,
  tags: ['autodocs'],
  args: {
    ariaLabel: 'Events around the world',
    markers: worldMarkers
  }
}

export default meta
type Story = StoryObj<typeof meta>

/** West-coast pair clusters at world zoom; zooming in splits it. */
export const Default: Story = {}

export const SingleMarker: Story = {
  args: {
    markers: [
      {
        id: 'montreal',
        coords: { lat: 45.51, lng: -73.57 },
        label: 'Montréal Workshop'
      }
    ]
  }
}

export const Empty: Story = { args: { markers: [] } }
