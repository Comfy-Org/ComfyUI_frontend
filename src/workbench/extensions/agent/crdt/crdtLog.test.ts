import { beforeEach, describe, expect, it } from 'vitest'

import { setCrdtDebugEnabled } from './crdtDebugGate'
import { wireLog } from './crdtLog'
import { clearDevEvents, devEvents } from './devPanelLog'

describe('crdtLog', () => {
  beforeEach(() => {
    setCrdtDebugEnabled(true)
    clearDevEvents()
  })

  it('keeps warnings visible when the debug instrument is opted out', () => {
    setCrdtDebugEnabled(false)

    wireLog.warn('schema_error', 'schema rejected')

    expect(console.warn).toHaveBeenCalledWith(
      '%c[crdt:wire]%c schema_error — schema rejected',
      'color:#7dd3fc',
      ''
    )
    expect(devEvents.value).toHaveLength(0)
  })
})
