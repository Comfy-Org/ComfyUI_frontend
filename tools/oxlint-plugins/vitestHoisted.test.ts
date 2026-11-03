import { RuleTester } from 'oxlint/plugins-dev'
import { describe, it } from 'vitest'

import { noUnreadHoistedMockState } from './vitestHoisted'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({
  languageOptions: { parserOptions: { lang: 'ts' } }
}).run('no-unread-hoisted-mock-state', noUnreadHoistedMockState, {
  valid: [
    {
      name: 'hoisted values read by vi.mock and vi.doMock factories',
      code: `
const { fetchUser } = vi.hoisted(() => ({ fetchUser: vi.fn() }))
const state = vi.hoisted(() => ({ ready: false }))
vi.mock(import('./api'), () => ({ fetchUser }))
vi.doMock('./store', () => ({ useStore: () => state }))
fetchUser.mockResolvedValue(null)
`
    },
    {
      name: 'hoisted state read by a hoisted factory passed to vi.mock by name',
      code: `
const state = vi.hoisted(() => ({ fn: vi.fn() }))
const make = vi.hoisted(() => () => ({ fn: state.fn }))
vi.mock('./x', make)
`
    }
  ],
  invalid: [
    {
      name: 'hoisted state only configured by tests',
      code: `
const { mockSubscription } = vi.hoisted(() => ({ mockSubscription: { value: null } }))
vi.mock(import('./billing'))
mockSubscription.value = { active: true }
`,
      errors: [{ messageId: 'unreadHoisted' }]
    },
    {
      name: 'only the binding no factory reads',
      code: `
const { onMounted, onUnmounted } = vi.hoisted(() => ({ onMounted: vi.fn(), onUnmounted: vi.fn() }))
vi.mock('./banner', () => ({ onMounted }))
expect(onUnmounted).not.toHaveBeenCalled()
`,
      errors: [{ messageId: 'unreadHoisted' }]
    }
  ]
})
