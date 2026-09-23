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

  it('names what a workflow needs before anyone can call it', () => {
    mount('endpoint')

    expect(screen.getByTestId('hub-card-reach').textContent).toContain(
      'Custom nodes'
    )
  })

  it('says it in the reader\u2019s language', () => {
    render(HubCardReach, { props: { reach: 'endpoint', locale: 'zh-CN' } })

    expect(screen.getByTestId('hub-card-reach').textContent).toContain(
      '自定义节点'
    )
  })
})
