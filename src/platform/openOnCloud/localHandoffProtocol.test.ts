import { describe, expect, it } from 'vitest'

import { isLocalOrigin } from '@/platform/openOnCloud/localHandoffProtocol'

describe(isLocalOrigin, () => {
  it.for([
    { origin: 'http://localhost:8188', local: true },
    { origin: 'http://127.0.0.1:8000', local: true },
    { origin: 'http://[::1]:8188', local: true },
    { origin: 'http://192.168.1.20:8188', local: true },
    { origin: 'http://10.0.0.5:8188', local: true },
    { origin: 'http://172.20.0.2:8188', local: true },
    { origin: 'https://studio.local', local: true },
    { origin: 'http://172.32.0.2:8188', local: false },
    { origin: 'https://evil.example', local: false },
    { origin: 'https://localhost.evil.example', local: false },
    { origin: 'file://', local: false },
    { origin: 'null', local: false }
  ])('$origin is local: $local', ({ origin, local }) => {
    expect(isLocalOrigin(origin)).toBe(local)
  })
})
