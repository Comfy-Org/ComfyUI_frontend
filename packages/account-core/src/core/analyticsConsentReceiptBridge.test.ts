import { expect, test } from 'vitest'
import { createAnalyticsConsentReceiptBridge } from './analyticsConsentReceiptBridge'

function setup(overrides = {}) {
  const states: boolean[] = []
  const calls: string[] = []
  const transport = {
    grant: async () => {
      calls.push('grant')
    },
    revoke: async () => {
      calls.push('revoke')
    }
  }
  const bridge = createAnalyticsConsentReceiptBridge(
    {
      enabled: true,
      policyVersion: 'v1',
      noticeDigest: 'sha256:notice',
      ...overrides
    },
    transport,
    (value) => {
      states.push(value)
    }
  )
  return { bridge, states, calls, transport }
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

test('disabled or unconfigured performs no writes or enrollment', async () => {
  for (const config of [
    { enabled: false },
    { policyVersion: '' },
    { noticeDigest: ' ' },
    { noticeDigest: 'é'.repeat(129) }
  ]) {
    const { bridge, states, calls } = setup(config)
    expectEqual(await bridge.update(true), false)
    expectEqual(calls, [])
    expectTruthy(states.every((value) => !value))
  }
})

test('grant waits for server acknowledgment with configured receipt', async () => {
  const { bridge, states, transport } = setup()
  const gate = deferred()
  transport.grant = async (receipt?: unknown) => {
    expectEqual(receipt, {
      accepted: true,
      service: 'posthog',
      policy_version: 'v1',
      notice_digest: 'sha256:notice'
    })
    await gate.promise
  }
  const pending = bridge.update(true)
  await Promise.resolve()
  expectEqual(states.at(-1), false)
  gate.resolve()
  expectEqual(await pending, true)
  expectEqual(states.at(-1), true)
})

test('revocation immediately disables and serializes after in-flight grant', async () => {
  const { bridge, states, calls, transport } = setup()
  const gate = deferred()
  transport.grant = async () => {
    calls.push('grant')
    await gate.promise
  }
  const grant = bridge.update(true)
  await Promise.resolve()
  const revoke = bridge.update(false)
  expectEqual(states.at(-1), false)
  gate.resolve()
  expectEqual(await grant, false)
  await revoke
  expectEqual(calls, ['grant', 'revoke'])
  expectTruthy(states.every((value) => !value))
})

test('failed revoke must succeed before any later grant', async () => {
  const { bridge, calls, transport } = setup()
  let fail = true
  transport.revoke = async () => {
    calls.push('revoke')
    if (fail) throw Error('offline')
  }
  expectEqual(await bridge.update(false), false)
  expectEqual(await bridge.update(true), false)
  expectEqual(calls, ['revoke', 'revoke'])
  fail = false
  expectEqual(await bridge.update(true), true)
  expectEqual(calls, ['revoke', 'revoke', 'revoke', 'grant'])
})

test('unknown consent revokes rather than inferring opt-in', async () => {
  const { bridge, calls } = setup()
  await bridge.update(undefined)
  expectEqual(calls, ['revoke'])
})

test('enabled transport can revoke while grant policy is unavailable', async () => {
  const { bridge, calls, states } = setup({ noticeDigest: '' })
  expectEqual(await bridge.update(false), false)
  expectEqual(calls, ['revoke'])
  expectTruthy(states.every((value) => !value))
})

test('failed grant never enrolls', async () => {
  const { bridge, states, transport } = setup()
  transport.grant = async () => {
    throw Error('offline')
  }
  expectEqual(await bridge.update(true), false)
  expectTruthy(states.every((value) => !value))
})

test('explicit transport refusal cannot grant or clear pending revocation', async () => {
  const states: boolean[] = []
  let revokeAllowed = false
  let grants = 0
  const bridge = createAnalyticsConsentReceiptBridge(
    { enabled: true, policyVersion: 'v1', noticeDigest: 'notice' },
    {
      grant: async () => {
        grants++
        return false
      },
      revoke: async () => revokeAllowed
    },
    (value) => states.push(value)
  )
  expectEqual(await bridge.update(false), false)
  expectEqual(await bridge.update(true), false)
  expectEqual(grants, 0)
  revokeAllowed = true
  expectEqual(await bridge.update(true), false)
  expectEqual(grants, 1)
  expectTruthy(states.every((value) => !value))
})

test('disposal prevents stale acknowledgment from enrolling another session', async () => {
  const { bridge, states, transport } = setup()
  const gate = deferred()
  transport.grant = async () => gate.promise
  const pending = bridge.update(true)
  await Promise.resolve()
  bridge.dispose()
  gate.resolve()
  expectEqual(await pending, false)
  expectEqual(await bridge.update(true), false)
  expectTruthy(states.every((value) => !value))
})

test('revoke then regrant always records revocation first', async () => {
  const { bridge, calls } = setup()
  const revoke = bridge.update(false)
  const grant = bridge.update(true)
  await revoke
  await grant
  expectEqual(calls, ['revoke', 'grant'])
})

function expectEqual(actual: unknown, expected: unknown) {
  expect(actual).toEqual(expected)
}
function expectTruthy(value: boolean) {
  expect(value).toBe(true)
}
