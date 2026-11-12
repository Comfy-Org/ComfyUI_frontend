import { describe, expect, it } from 'vitest'

import type { DeploymentCompatibilityMark } from '@/platform/workspace/composables/useDeploymentCompatibility'

import { sectionRows } from './useDeploymentRows'

const runs: DeploymentCompatibilityMark = { kind: 'runs' }
const missing: DeploymentCompatibilityMark = {
  kind: 'missing',
  nodeTypes: ['Image Saver']
}
const unknown: DeploymentCompatibilityMark = { kind: 'unknown' }

describe('sectionRows', () => {
  it.for([
    {
      when: 'no row is checked',
      marks: { cloud: null, a: null, b: null },
      picked: 'b',
      sections: [['runOn', ['b', 'cloud', 'a']]]
    },
    {
      when: 'the check leaves out a row',
      marks: { cloud: runs, a: missing, b: null },
      picked: 'cloud',
      sections: [['runOn', ['cloud', 'a', 'b']]]
    },
    {
      when: 'every row runs the workflow',
      marks: { cloud: runs, a: runs, b: runs },
      picked: 'a',
      sections: [['runOn', ['a', 'cloud', 'b']]]
    },
    {
      when: 'no row runs the workflow',
      marks: { cloud: missing, a: unknown, b: missing },
      picked: 'cloud',
      sections: [['runOn', ['cloud', 'a', 'b']]]
    },
    {
      when: 'the marks disagree',
      marks: { cloud: missing, a: runs, b: unknown },
      picked: 'cloud',
      sections: [
        ['current', ['cloud']],
        ['compatible', ['a']],
        ['incompatible', ['b']]
      ]
    },
    {
      when: 'the picked row is the only one that runs the workflow',
      marks: { cloud: missing, a: runs, b: missing },
      picked: 'a',
      sections: [
        ['current', ['a']],
        ['incompatible', ['cloud', 'b']]
      ]
    },
    {
      when: 'the picked row is not listed',
      marks: { cloud: missing, a: runs },
      picked: 'gone',
      sections: [
        ['compatible', ['a']],
        ['incompatible', ['cloud']]
      ]
    }
  ] satisfies {
    when: string
    marks: Record<string, DeploymentCompatibilityMark | null>
    picked: string
    sections: [string, string[]][]
  }[])('sections the rows when $when', ({ marks, picked, sections }) => {
    const rows = Object.entries(marks).map(([value, mark]) => ({
      value,
      mark
    }))

    expect(
      sectionRows(rows, picked).map((section) => [
        section.key,
        section.rows.map((row) => row.value)
      ])
    ).toEqual(sections)
  })
})
