import { render, screen } from '@testing-library/vue'
import { assert, describe, expect, it } from 'vitest'

import { workflowDetailsBySlug } from '../../config/workshop-workflow-content'
import WorkflowPage from './WorkflowPage.vue'

const model = workflowDetailsBySlug.get('workflows/animate-reference-sheet')
assert(model, 'the catalogue no longer carries the fixture workflow')
const template = model.workflow.template
assert(template, 'the fixture workflow no longer carries a template')

const mount = () =>
  render(WorkflowPage, {
    props: { model },
    global: { stubs: { WorkflowPlayground: true } }
  })

describe('WorkflowPage', () => {
  it('credits the template and leaves the models to the Details tab', () => {
    mount()

    const hero = screen.getByTestId('workflow-hero')
    expect(hero).toHaveTextContent(model.name)
    expect(hero).toHaveTextContent(`Template by ${template.author}`)
    for (const name of template.models) expect(hero).not.toHaveTextContent(name)
  })
})
