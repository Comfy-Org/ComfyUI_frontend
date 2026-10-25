import { vi } from 'vitest'

import type * as realFeatures from '@/config/workshop-features'

const features: typeof realFeatures = {
  createBillingSdkTopupReader: vi.fn(() => async () => false),
  readBillingSdkTopupEnabled: vi.fn(async () => false)
}

export const { createBillingSdkTopupReader, readBillingSdkTopupEnabled } =
  features
