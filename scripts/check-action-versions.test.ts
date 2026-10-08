import { describe, expect, it } from 'vitest'

import { findVersionDrift } from './check-action-versions'

const V5 = 'caa296126883cff596d87d8935842f9db880ef25 # v5.1.0'
const V6 = '55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0'
const V7_0_1 = '3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1'

describe('findVersionDrift', () => {
  it.for([
    {
      name: 'sub-actions of one repo on different majors',
      uses: [`actions/cache/restore@${V6}`, `actions/cache/save@${V5}`],
      drifting: ['actions/cache']
    },
    {
      name: 'two commits of the same major',
      uses: [
        'pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6.0.10',
        'pnpm/action-setup@0ebf47130e4866e96fce0953f49152a61190b271 # v6.0.9'
      ],
      drifting: ['pnpm/action-setup']
    },
    {
      name: 'a floating major tag beside a commit pin of that major',
      uses: ['actions/checkout@v7', `actions/checkout@${V7_0_1}`],
      drifting: []
    },
    {
      name: 'a floating major tag beside a commit pin of another major',
      uses: ['actions/cache/restore@v5', `actions/cache/save@${V6}`],
      drifting: ['actions/cache']
    },
    {
      name: 'reusable workflows and local actions',
      uses: [
        'Comfy-Org/github-workflows/.github/workflows/a.yml@06f835f96accfd84d0a0929777d602837402608c',
        'Comfy-Org/github-workflows/.github/workflows/b.yml@ba2e67b68ddbf28c0d3af05a0213b12822a3bf68',
        './.github/actions/setup-frontend'
      ],
      drifting: []
    }
  ])('reports $name', ({ uses, drifting }) => {
    const files = uses.map((use, index) => ({
      path: `.github/workflows/w${index}.yaml`,
      contents: `jobs:\n  job:\n    steps:\n      - uses: ${use}\n`
    }))

    const report = findVersionDrift(files)

    expect(report.map((entry) => entry.split(' ')[0])).toEqual(drifting)
  })

  it('names each drifting use with its version and location', () => {
    const [entry] = findVersionDrift([
      {
        path: '.github/actions/a/action.yml',
        contents: `runs:\n  steps:\n    - name: Restore\n      uses: actions/cache/restore@${V6}\n`
      },
      {
        path: '.github/workflows/b.yaml',
        contents: `steps:\n  - uses: actions/cache/save@${V5}\n`
      }
    ])

    expect(entry).toBe(
      [
        'actions/cache is used at more than one version:',
        '  v6.1.0  .github/actions/a/action.yml:4',
        '  v5.1.0  .github/workflows/b.yaml:2'
      ].join('\n')
    )
  })
})
