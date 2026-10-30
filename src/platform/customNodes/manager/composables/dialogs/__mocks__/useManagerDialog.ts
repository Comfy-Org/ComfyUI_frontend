import { vi } from 'vitest'

const managerDialog = {
  show: vi.fn(),
  hide: vi.fn(),
  openManager: vi.fn(async () => {})
}

export const useManagerDialog = vi.fn(() => managerDialog)
