import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setCrdtDebugEnabled } from './crdtDebugGate'
import { wireLog } from './crdtLog'
import { clearDevEvents, devEvents } from './devPanelLog'

describe('crdtLog', () => {
  beforeEach(() => {
    setCrdtDebugEnabled(true)
    clearDevEvents()
  })

  it('keeps warnings visible when the debug instrument is opted out', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    setCrdtDebugEnabled(false)

    wireLog.warn('schema_error', 'schema rejected')

    expect(warn).toHaveBeenCalledWith(
      '%c[crdt:wire]%c schema_error — schema rejected',
      'color:#7dd3fc',
      ''
    )
    expect(devEvents.value).toHaveLength(0)
  })
})
