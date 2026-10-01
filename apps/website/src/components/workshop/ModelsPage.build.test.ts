import { render } from '@testing-library/vue'
import { expect, it, vi } from 'vitest'

import { useWorkshopSession } from '../../config/workshop-session-state'
import ModelsPage from './ModelsPage.vue'

const build = vi.hoisted(() => ({ included: true }))

vi.mock(import('astro:env/client'), () => ({
  WORKSHOP_LOCAL_DEV: false,
  WORKSHOP_DEPLOY_ENV: '',
  WORKSHOP_RELEASE: 'test',
  get WORKSHOP_INCLUDED() {
    return build.included
  }
}))
vi.mock(import('../../config/workshop-session-state'))
vi.mock(import('../../scripts/posthog'))

it.for([
  { included: true, startsSession: true },
  { included: false, startsSession: false }
])(
  'a workflow page starts the Workshop session only in a build that includes Workshop (included: $included)',
  ({ included, startsSession }) => {
    build.included = included
    render(ModelsPage, {
      props: { slug: 'workflows/change-material', workflowId: 'wf-1' }
    })
    expect(vi.mocked(useWorkshopSession).mock.calls.length > 0).toBe(
      startsSession
    )
  }
)
