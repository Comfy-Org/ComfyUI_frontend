import { beforeEach, describe, expect, it, vi } from 'vitest'

import { setCrdtDebugEnabled, setCrdtLogLevel } from './crdtDebugGate'
import { docLog, wireLog } from './crdtLog'
import { clearDevEvents, devEvents } from './devPanelLog'

describe('crdtLog', () => {
  beforeEach(() => {
    setCrdtDebugEnabled(true)
    clearDevEvents()
  })

  it('retains document detail below console verbosity and prints it once when enabled', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const logDocument = docLog.debug
    setCrdtLogLevel('info')
    logDocument('doc_effects', 'projection outcome', { committed: false })
    expect(debug).not.toHaveBeenCalled()
    expect(devEvents.value).toHaveLength(1)
    expect(devEvents.value[0]).toMatchObject({
      scope: 'doc',
      level: 'debug',
      detail: { committed: false }
    })

    setCrdtLogLevel('debug')
    logDocument('doc_effects', 'projection outcome', { committed: true })
    expect(debug).toHaveBeenCalledExactlyOnceWith(
      '%c[crdt:doc]%c doc_effects — projection outcome',
      'color:#a5b4fc',
      '',
      { committed: true }
    )
    expect(devEvents.value).toHaveLength(2)
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
