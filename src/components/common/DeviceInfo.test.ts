import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { DeviceStats } from '@/schemas/apiSchema'

import DeviceInfo from './DeviceInfo.vue'

function createDevice(overrides: Partial<DeviceStats> = {}): DeviceStats {
  return {
    name: 'cuda:0 NVIDIA RTX',
    type: 'cuda',
    index: 0,
    vram_total: 1024,
    vram_free: 512,
    torch_vram_total: 2048,
    torch_vram_free: 256,
    ...overrides
  }
}

function renderDeviceInfo(device: DeviceStats) {
  return render(DeviceInfo, { props: { device } })
}

describe('DeviceInfo', () => {
  it('renders device name and type as-is', () => {
    renderDeviceInfo(createDevice())

    expect(screen.getByText('cuda:0 NVIDIA RTX')).toBeTruthy()
    expect(screen.getByText('cuda')).toBeTruthy()
  })

  it('formats vram fields as human-readable sizes', () => {
    renderDeviceInfo(
      createDevice({
        vram_total: 1024,
        vram_free: 0,
        torch_vram_total: 1048576,
        torch_vram_free: 1073741824
      })
    )

    expect(screen.getByText('1 KB')).toBeTruthy()
    expect(screen.getByText('0 B')).toBeTruthy()
    expect(screen.getByText('1 MB')).toBeTruthy()
    expect(screen.getByText('1 GB')).toBeTruthy()
  })
})
