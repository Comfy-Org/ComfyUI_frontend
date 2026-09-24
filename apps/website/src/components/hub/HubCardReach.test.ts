import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'

import type { WorkflowReach } from '../../lib/hub/workflow-reach'
import HubCardReach from './HubCardReach.vue'

const mount = (reach: WorkflowReach | undefined) =>
  render(HubCardReach, { props: { reach } })

describe('HubCardReach', () => {
  // Twenty-six of the launch thirty run on the shared endpoint with nothing
  // to install. A mark on all of them would mark nothing, so only the few
  // that ask for something speak up.
  it.for([
    { reach: undefined },
    { reach: 'cloud' as const },
    { reach: 'here' as const }
  ])('says nothing for $reach', ({ reach }) => {
    mount(reach)

    expect(screen.queryByTestId('hub-card-reach')).toBeNull()
  })

  // Every workflow has custom nodes, so saying so marks nothing. What sets
  // this one apart is where it runs, which is the product it runs on.
  it('names where a workflow runs when Cloud cannot run it', () => {
    mount('endpoint')

    expect(screen.getByTestId('hub-card-reach').textContent).toContain(
      'Comfy API'
    )
  })

  it('keeps the product\u2019s name in either language', () => {
    render(HubCardReach, { props: { reach: 'endpoint', locale: 'zh-CN' } })

    expect(screen.getByTestId('hub-card-reach').textContent).toContain(
      'Comfy API'
    )
  })
})
