import { describe, expect, it } from 'vitest'

import { hubWorkflowName } from './hub-models'
import hubWorkflowNames from './hub-workflow-names.json' with { type: 'json' }
import type { HubWorkflowsRouting } from './hub-workflows-manifest'
import {
  buildHubWorkflowsManifest,
  hubWorkflowsManifestSchema
} from './hub-workflows-manifest'
import { hubWorkflowsRouting } from './hub-workflows-routing'
import { workflowModels } from './workshop-workflow-content'

const pages = ['remove-background', 'change-material']
const build = (routing: Partial<HubWorkflowsRouting>) =>
  buildHubWorkflowsManifest(pages, {
    defaultOwner: 'workflows-site',
    legacyRedirects: {},
    ...routing
  })

describe('hub workflows manifest', () => {
  it('lists the pages sorted in the versioned shape the router reads', () => {
    expect(
      build({
        legacyRedirects: {
          '/workflows/change-material/': '/hub/workflows/change-material/'
        }
      })
    ).toEqual({
      version: 1,
      defaultOwner: 'workflows-site',
      pages: ['change-material', 'remove-background'],
      legacyRedirects: {
        '/workflows/change-material/': '/hub/workflows/change-material/'
      }
    })
  })

  it('lists exactly the workflow pages the site builds', () => {
    expect(
      buildHubWorkflowsManifest(hubWorkflowNames, hubWorkflowsRouting).pages
    ).toEqual(workflowModels.map(({ slug }) => hubWorkflowName(slug)).sort())
  })

  it.for<[string, Record<string, string>]>([
    ['a wildcard', { '/workflows/*': '/hub/workflows/change-material/' }],
    ['a prefix', { '/workflows/': '/hub/workflows/change-material/' }],
    [
      'a path without its trailing slash',
      { '/workflows/change-material': '/hub/workflows/change-material/' }
    ],
    ['a nested path', { '/workflows/a/b/': '/hub/workflows/change-material/' }],
    [
      'a target the site does not build',
      { '/workflows/change-material/': '/hub/workflows/missing/' }
    ],
    [
      'a target outside /hub/workflows',
      { '/workflows/change-material/': '/hub/models/change-material/' }
    ]
  ])('rejects a legacy redirect with %s', ([, legacyRedirects]) => {
    expect(() => build({ legacyRedirects })).toThrow()
  })

  it('rejects an unknown default owner', () => {
    expect(
      hubWorkflowsManifestSchema.safeParse({
        version: 1,
        defaultOwner: 'everyone',
        pages: [...pages].sort(),
        legacyRedirects: {}
      }).success
    ).toBe(false)
  })
})
