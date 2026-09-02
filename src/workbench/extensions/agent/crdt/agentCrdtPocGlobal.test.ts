import { afterEach, describe, expect, it } from 'vitest'

import { installAgentCrdtPocGlobal } from './agentCrdtPocGlobal'

type PocWindow = Window & {
  __agentCrdtPoc?: object
}

const pocWindow = window as PocWindow

describe('installAgentCrdtPocGlobal', () => {
  afterEach(() => {
    delete pocWindow.__agentCrdtPoc
  })

  it('only removes the value installed by that mount', () => {
    const mountA = { tabId: 'a' }
    const mountB = { tabId: 'b' }

    const teardownA = installAgentCrdtPocGlobal(mountA)
    expect(pocWindow.__agentCrdtPoc).toBe(mountA)

    const teardownB = installAgentCrdtPocGlobal(mountB)
    expect(pocWindow.__agentCrdtPoc).toBe(mountB)

    teardownA()
    expect(pocWindow.__agentCrdtPoc).toBe(mountB)

    teardownB()
    expect(pocWindow.__agentCrdtPoc).toBeUndefined()
  })
})
