import { describe, expect, it } from 'vitest'

import {
  agentTabFilename,
  buildOpenTabsSnapshot,
  uniqueCloudWorkflowIdsByName,
  workflowIdForTab
} from './agentWorkflowTabs'

type Tab = Parameters<typeof workflowIdForTab>[0]['tab']

function tab(
  filename: string,
  path = `workflows/${filename}.json`,
  isTemporary = false
): Tab {
  return { filename, path, isTemporary }
}

describe('agent workflow tabs', () => {
  it('indexes only uniquely named cloud workflows', () => {
    expect(
      uniqueCloudWorkflowIdsByName([
        { id: 'wf-current', name: 'current' },
        { id: 'wf-duck-a', name: 'duck' },
        { id: 'wf-duck-b', name: 'duck' },
        { id: 'wf-nameless' }
      ])
    ).toEqual(new Map([['current', 'wf-current']]))
  })

  it('resolves a unique saved tab by cloud name and otherwise uses its binding', () => {
    const current = tab('current')
    const duplicate = tab('current', 'workflows/archive/current.json')
    const draft = tab('draft', 'workflows/draft.json', true)
    const cloudIdsByName = new Map([
      ['current', 'wf-current'],
      ['draft', 'wf-draft']
    ])

    expect(
      workflowIdForTab({
        tab: current,
        openTabs: [current],
        cloudIdsByName
      })
    ).toBe('wf-current')
    expect(
      workflowIdForTab({
        tab: current,
        openTabs: [current, duplicate],
        cloudIdsByName
      })
    ).toBeUndefined()
    expect(
      workflowIdForTab({
        tab: draft,
        openTabs: [draft],
        cloudIdsByName,
        boundWorkflowId: 'wf-bound-draft'
      })
    ).toBe('wf-bound-draft')
  })

  it('builds a snapshot from resolved tabs and omits unresolved active tabs', () => {
    const current = tab('current')
    const background = tab('background')
    const scratch = tab('scratch', 'workflows/scratch.json', true)
    const ids = new Map<Tab, string>([
      [current, 'wf-current'],
      [background, 'wf-background']
    ])
    const workflowIdFor = (candidate: Tab) => ids.get(candidate)

    expect(
      buildOpenTabsSnapshot({
        openTabs: [current, background, scratch],
        activeTab: current,
        detached: false,
        workflowIdFor
      })
    ).toEqual({
      open_tabs: [
        { workflow_id: 'wf-current', name: 'current' },
        { workflow_id: 'wf-background', name: 'background' }
      ],
      current_tab: 'wf-current'
    })
    expect(
      buildOpenTabsSnapshot({
        openTabs: [current, scratch],
        activeTab: scratch,
        detached: false,
        workflowIdFor
      })
    ).toEqual({
      open_tabs: [{ workflow_id: 'wf-current', name: 'current' }],
      current_tab: undefined
    })
    expect(
      buildOpenTabsSnapshot({
        openTabs: [scratch],
        activeTab: scratch,
        detached: false,
        workflowIdFor
      })
    ).toBeUndefined()
  })

  it.for([
    ['a/b', 'a-b.json'],
    ['folder\\name', 'folder-name.json'],
    ['workflow.json', 'workflow.json'],
    [' .hidden', 'hidden.json'],
    [`${'a'.repeat(79)}💩b`, `${'a'.repeat(79)}💩.json`],
    ['  ', undefined],
    [undefined, undefined]
  ])('sanitizes an agent tab name %#', ([name, expected]) => {
    expect(agentTabFilename(name)).toBe(expected)
  })
})
