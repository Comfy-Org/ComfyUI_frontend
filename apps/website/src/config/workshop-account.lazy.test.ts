import { expect, it, onTestFinished, vi } from 'vitest'

import { workshopIdentity } from './workshop-account'

const firebaseEvaluated = vi.hoisted(() => vi.fn())

vi.mock(import('../scripts/posthog'))
vi.mock(import('./workshop-firebase'), async () => {
  firebaseEvaluated()
  return import('./__mocks__/workshop-firebase')
})

it('leaves the Firebase module unloaded until the identity is activated', async () => {
  onTestFinished(() => workshopIdentity.deactivate())
  expect(firebaseEvaluated).not.toHaveBeenCalled()
  await workshopIdentity.activate()
  expect(firebaseEvaluated).toHaveBeenCalledOnce()
})
