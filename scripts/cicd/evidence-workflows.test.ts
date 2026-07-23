import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'

import { describe, expect, it, vi } from 'vitest'

function workflow(name: string): string {
  return readFileSync(resolve('.github/workflows', name), 'utf8')
}

function issueLabelScript(): string {
  const source = workflow('ci-issue-evidence.yaml')
  const marker = '          script: |\n'
  const scriptAndFollowingSteps = source.slice(
    source.indexOf(marker) + marker.length
  )
  return scriptAndFollowingSteps
    .split('\n      - name:')[0]
    .replace(/^ {12}/gm, '')
}

const automatedFrontendPrWorkflows = [
  'api-update-electron-api-types.yaml',
  'api-update-manager-api-types.yaml',
  'i18n-update-nodes.yaml',
  'release-version-bump.yaml',
  'release-website.yaml',
  'version-bump-desktop-ui.yaml',
  'weekly-docs-check.yaml'
]

describe('evidence workflows', () => {
  it('runs the trusted validator from the workflow commit', () => {
    const source = workflow('ci-pr-evidence.yaml')
    expect(source).toContain('ref: ${{ github.workflow_sha }}')
    expect(source).toContain('        assigned,\n        unassigned')
    expect(source).toContain(
      'COMFY_ORG_MEMBERS_READ_TOKEN: ${{ secrets.COMFY_ORG_MEMBERS_READ_TOKEN }}'
    )
    expect(source).toContain('node scripts/cicd/validate-maintainer.ts')
    expect(source).toContain('steps.maintainer.outputs.valid')
    expect(source).toContain("github.event_name == 'merge_group'")
    expect(source).toContain('node scripts/cicd/validate-merge-group.ts')
    expect(source).not.toContain('Evidence was validated before')
    expect(source).toContain('cancel-in-progress: true')
  })

  it('rechecks issue evidence and ownership when assignments change', () => {
    const source = workflow('ci-issue-evidence.yaml')
    expect(source).toContain('assigned, unassigned')
    expect(source).toContain('ref: ${{ github.workflow_sha }}')
    expect(source).toContain('blocked: needs-evidence')
    expect(source).toContain('blocked: needs-maintainer')
    expect(source).toContain('Fail blocked contribution')
    expect(source).toContain(
      'COMFY_ORG_MEMBERS_READ_TOKEN: ${{ secrets.COMFY_ORG_MEMBERS_READ_TOKEN }}'
    )
  })

  it.for(automatedFrontendPrWorkflows)(
    '%s generates a structurally complete evidence body',
    (name) => {
      const source = workflow(name)
      expect(source).toContain('## Reproduction or validation steps')
      expect(source).toContain('## Evidence type')
      expect(source).toContain('## Non-visual rationale')
      expect(source).toContain('## Test or log evidence')
    }
  )

  it('backports retain the validated source pull request evidence', () => {
    const source = workflow('pr-backport.yaml')
    expect(source).toContain('PR_SOURCE_BODY=')
    expect(source).toContain('## Source pull request evidence')
    expect(source).toContain('${PR_SOURCE_BODY}')
  })

  it('adds the issue label after another run wins the creation race', async () => {
    const addLabels = vi.fn()
    const github = {
      rest: {
        issues: {
          addLabels,
          createLabel: vi.fn().mockRejectedValue({
            response: { data: { errors: [{ code: 'already_exists' }] } },
            status: 422
          }),
          getLabel: vi.fn().mockRejectedValue({ status: 404 }),
          removeLabel: vi.fn()
        }
      }
    }

    await runInNewContext(`(async () => {${issueLabelScript()}})()`, {
      context: {
        issue: { number: 42 },
        repo: { owner: 'Comfy-Org', repo: 'ComfyUI_frontend' }
      },
      github,
      process: {
        env: { EVIDENCE_VALID: 'false', MAINTAINER_VALID: 'true' }
      }
    })

    expect(addLabels).toHaveBeenCalledWith({
      issue_number: 42,
      labels: ['blocked: needs-evidence'],
      owner: 'Comfy-Org',
      repo: 'ComfyUI_frontend'
    })
  })

  it('tracks missing maintainers separately from missing evidence', async () => {
    const addLabels = vi.fn()
    const removeLabel = vi.fn().mockRejectedValue({ status: 404 })
    const github = {
      rest: {
        issues: {
          addLabels,
          createLabel: vi.fn().mockResolvedValue({}),
          getLabel: vi.fn().mockResolvedValue({}),
          removeLabel
        }
      }
    }

    await runInNewContext(`(async () => {${issueLabelScript()}})()`, {
      context: {
        issue: { number: 42 },
        repo: { owner: 'Comfy-Org', repo: 'ComfyUI_frontend' }
      },
      github,
      process: {
        env: { EVIDENCE_VALID: 'true', MAINTAINER_VALID: 'false' }
      }
    })

    expect(removeLabel).toHaveBeenCalledWith({
      issue_number: 42,
      name: 'blocked: needs-evidence',
      owner: 'Comfy-Org',
      repo: 'ComfyUI_frontend'
    })
    expect(addLabels).toHaveBeenCalledWith({
      issue_number: 42,
      labels: ['blocked: needs-maintainer'],
      owner: 'Comfy-Org',
      repo: 'ComfyUI_frontend'
    })
  })
})
