import assert from 'node:assert/strict'
import test from 'node:test'

import {
  alreadyApprovedCurrentHead,
  changedPaths,
  hasActiveChangeRequest,
  hasCompleteChangedFileList,
  hasHoldLabel,
  isSameRepository,
  isWebsiteOnly,
  parseApprovedAuthors,
  targetsDefaultBranch
} from './website-auto-approve.mjs'

void test('requires complete changed-file enumeration', () => {
  const files = [{ filename: 'apps/website/a.astro' }]
  assert.equal(hasCompleteChangedFileList(files, 1), true)
  assert.equal(hasCompleteChangedFileList(files, 2), false)
  assert.equal(hasCompleteChangedFileList(files, undefined), false)
})

void test('parses and normalizes the explicit author allowlist', () => {
  assert.deepEqual(
    parseApprovedAuthors('["bertfy", "BERTFY", ""]'),
    new Set(['bertfy'])
  )
  assert.throws(() => parseApprovedAuthors('bertfy'), /must be JSON/)
  assert.throws(
    () => parseApprovedAuthors('{"bertfy":true}'),
    /must be a JSON array/
  )
})

void test('requires a non-empty website-only path set', () => {
  assert.equal(isWebsiteOnly(['apps/website/src/pages/index.astro']), true)
  assert.equal(
    isWebsiteOnly([
      'apps/website/src/pages/index.astro',
      'apps/website/public/hero.webp'
    ]),
    true
  )
  assert.equal(isWebsiteOnly([]), false)
  assert.equal(
    isWebsiteOnly(['apps/website/src/pages/index.astro', 'pnpm-lock.yaml']),
    false
  )
  assert.equal(isWebsiteOnly(['apps/website-evil/file.ts']), false)
})

void test('a rename must stay inside the website on both sides', () => {
  assert.deepEqual(
    changedPaths([
      {
        status: 'renamed',
        previous_filename: 'apps/website/old.astro',
        filename: 'apps/website/new.astro'
      }
    ]),
    ['apps/website/new.astro', 'apps/website/old.astro']
  )
  const crossBoundaryRename = changedPaths([
    {
      status: 'renamed',
      previous_filename: 'src/sensitive.ts',
      filename: 'apps/website/sensitive.ts'
    }
  ])
  assert.equal(isWebsiteOnly(crossBoundaryRename), false)
  assert.equal(
    changedPaths([{ status: 'renamed', filename: 'apps/website/new.astro' }]),
    null
  )
})

void test('a copied file retains both paths for boundary evaluation', () => {
  assert.deepEqual(
    changedPaths([
      {
        status: 'copied',
        previous_filename: 'src/sensitive.ts',
        filename: 'apps/website/sensitive.ts'
      }
    ]),
    ['apps/website/sensitive.ts', 'src/sensitive.ts']
  )
})

void test('the explicit hold label stops fast-lane approval', () => {
  assert.equal(hasHoldLabel({ labels: [] }), false)
  assert.equal(
    hasHoldLabel({ labels: [{ name: 'website-fast-lane:hold' }] }),
    true
  )
  assert.equal(
    hasHoldLabel({ labels: [{ name: 'WEBSITE-FAST-LANE:HOLD' }] }),
    true
  )
})

void test('only each non-app reviewer latest state can actively block', () => {
  assert.equal(
    hasActiveChangeRequest([
      {
        state: 'CHANGES_REQUESTED',
        user: { login: 'coderabbitai[bot]', type: 'Bot' }
      },
      {
        state: 'CHANGES_REQUESTED',
        user: { login: 'DrJKL', type: 'User' }
      },
      { state: 'APPROVED', user: { login: 'DrJKL', type: 'User' } }
    ]),
    false
  )
  assert.equal(
    hasActiveChangeRequest([
      {
        state: 'CHANGES_REQUESTED',
        user: { login: 'webreviewer-bot', type: 'User' }
      }
    ]),
    true
  )
})

void test('fork pull requests are not eligible', () => {
  assert.equal(
    isSameRepository(
      { head: { repo: { full_name: 'Comfy-Org/ComfyUI_frontend' } } },
      'comfy-org/comfyui_frontend'
    ),
    true
  )
  assert.equal(
    isSameRepository(
      { head: { repo: { full_name: 'bertfy/ComfyUI_frontend' } } },
      'Comfy-Org/ComfyUI_frontend'
    ),
    false
  )
  assert.equal(
    isSameRepository({ head: { repo: null } }, 'Comfy-Org/ComfyUI_frontend'),
    false
  )
})

void test('only pull requests targeting the default branch are eligible', () => {
  assert.equal(
    targetsDefaultBranch(
      {
        base: {
          ref: 'main',
          repo: { full_name: 'Comfy-Org/ComfyUI_frontend' }
        }
      },
      'comfy-org/comfyui_frontend',
      'main'
    ),
    true
  )
  assert.equal(
    targetsDefaultBranch(
      {
        base: {
          ref: 'release',
          repo: { full_name: 'Comfy-Org/ComfyUI_frontend' }
        }
      },
      'Comfy-Org/ComfyUI_frontend',
      'main'
    ),
    false
  )
})

void test('idempotency is scoped to the bot and exact head commit', () => {
  const reviews = [
    { state: 'APPROVED', commit_id: 'old', user: { login: 'webreviewer-bot' } },
    { state: 'APPROVED', commit_id: 'head', user: { login: 'someone-else' } },
    {
      state: 'CHANGES_REQUESTED',
      commit_id: 'head',
      user: { login: 'webreviewer-bot' }
    }
  ]
  assert.equal(
    alreadyApprovedCurrentHead(reviews, 'webreviewer-bot', 'head'),
    false
  )
  reviews.push({
    state: 'APPROVED',
    commit_id: 'head',
    user: { login: 'WebReviewer-Bot' }
  })
  assert.equal(
    alreadyApprovedCurrentHead(reviews, 'webreviewer-bot', 'head'),
    true
  )
})
