import { execFile, spawnSync } from 'node:child_process'
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, it, onTestFinished } from 'vitest'
import { parse } from 'yaml'
import { z } from 'zod'

import { resolveNpmDistTag } from './resolve-npm-dist-tag'

it.for([
  { version: '1.57.7', requestedTag: 'latest', expected: 'backport' },
  { version: '1.60.1', requestedTag: 'latest', expected: 'latest' },
  { version: '1.100.0', requestedTag: 'latest', expected: 'latest' },
  { version: '1.9.9', requestedTag: 'latest', expected: 'backport' },
  { version: '1.61.0-rc.1', requestedTag: 'latest', expected: 'next' },
  { version: '1.57.7', requestedTag: 'custom', expected: 'custom' }
])('$version requested on $requestedTag publishes to $expected', (row) => {
  expect(
    resolveNpmDistTag({
      ...row,
      versions: ['1.57.6', '1.61.0-rc.1', '1.60.0']
    })
  ).toBe(row.expected)
})

async function runAgainstRegistry(status: number, body: unknown) {
  const root = mkdtempSync(join(tmpdir(), 'npm-dist-tag-'))
  onTestFinished(() => rmSync(root, { recursive: true, force: true }))
  const server = createServer((_request, response) => {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  })
  onTestFinished(() => new Promise<void>((done) => server.close(() => done())))
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  expect(address).not.toBeNull()
  if (!address || typeof address === 'string') {
    throw new Error('Registry must listen on a TCP port')
  }
  const output = join(root, 'output')
  await promisify(execFile)(
    process.execPath,
    ['--import', 'tsx', resolve('scripts/cicd/resolve-npm-dist-tag.ts')],
    {
      env: {
        ...process.env,
        NAME: 'publish-test-fixture',
        VERSION: '1.57.7',
        DIST_TAG: 'latest',
        GITHUB_OUTPUT: output,
        npm_config_registry: `http://127.0.0.1:${address.port}`,
        npm_config_fetch_retries: '0'
      }
    }
  )
  return readFileSync(output, 'utf8')
}

it('uses published versions even when the registry latest tag has regressed', async () => {
  expect(
    await runAgainstRegistry(200, {
      name: 'publish-test-fixture',
      'dist-tags': { latest: '1.57.6' },
      versions: {
        '1.57.6': { name: 'publish-test-fixture', version: '1.57.6' },
        '1.60.0': { name: 'publish-test-fixture', version: '1.60.0' }
      }
    })
  ).toBe('tag=backport\n')
})

it('allows the first publication when npm returns E404', async () => {
  expect(await runAgainstRegistry(404, { error: 'not_found' })).toBe(
    'tag=latest\n'
  )
})

it('fails closed when the registry is unavailable', async () => {
  await expect(
    runAgainstRegistry(503, { error: 'unavailable' })
  ).rejects.toThrow('Registry lookup failed')
})

const publishers = readdirSync('.github/workflows')
  .filter((file) => /\.ya?ml$/.test(file))
  .map((file) => ({
    file,
    source: readFileSync(join('.github/workflows', file), 'utf8')
  }))
  .filter(({ source }) => /\b(?:pnpm|npm) publish\b/.test(source))

const stepsSchema = z.array(
  z.object({
    name: z.string().optional(),
    id: z.string().optional(),
    run: z.string().optional(),
    env: z.record(z.string(), z.string()).optional()
  })
)

it.for(publishers)(
  '$file publishes only with a guarded tag in a per-package queue',
  ({ source }) => {
    const workflow = z
      .object({
        concurrency: z.object({
          group: z.string(),
          'cancel-in-progress': z.literal(false),
          queue: z.literal('max')
        }),
        jobs: z.record(z.string(), z.object({ steps: stepsSchema }))
      })
      .parse(parse(source))
    expect(workflow.concurrency.group).not.toMatch(
      /inputs\.(?:version|dist_tag)/
    )
    const steps = Object.values(workflow.jobs).flatMap((job) => job.steps)
    const publish = steps.find((step) =>
      /\b(?:pnpm|npm) publish\b/.test(step.run ?? '')
    )
    expect(publish?.env?.DIST_TAG).toBe('${{ steps.dist_tag.outputs.tag }}')
    expect(steps.find((step) => step.id === 'dist_tag')?.run).toBe(
      'pnpm exec tsx scripts/cicd/resolve-npm-dist-tag.ts'
    )
  }
)

it.for([
  {
    name: 'missing',
    filename: 'unrelated.txt',
    content: 'unrelated',
    files: ['index.d.ts'],
    accepted: false
  },
  {
    name: 'empty',
    filename: 'index.d.ts',
    content: '',
    files: ['index.d.ts'],
    accepted: false
  },
  {
    name: 'excluded',
    filename: 'index.d.ts',
    content: 'export type Value = string',
    files: ['other.d.ts'],
    accepted: false
  },
  {
    name: 'valid',
    filename: 'index.d.ts',
    content: 'export type Value = string',
    files: ['index.d.ts'],
    accepted: true
  }
])(
  'checks the packed types package: $name',
  ({ filename, content, files, accepted }) => {
    const root = mkdtempSync(join(tmpdir(), 'types-package-'))
    onTestFinished(() => rmSync(root, { recursive: true, force: true }))
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'types-test-fixture',
        version: '1.0.0',
        files
      })
    )
    writeFileSync(join(root, filename), content)
    const workflow = z
      .object({
        jobs: z.record(z.string(), z.object({ steps: stepsSchema }))
      })
      .parse(
        parse(readFileSync('.github/workflows/release-npm-types.yaml', 'utf8'))
      )
    const guard = Object.values(workflow.jobs)
      .flatMap((job) => job.steps)
      .find(
        (step) =>
          step.name === 'Verify declarations are included in the package'
      )
    const script = z.string().parse(guard?.run)
    const result = spawnSync('bash', ['-c', script], {
      cwd: root,
      encoding: 'utf8'
    })
    expect(result.status === 0).toBe(accepted)
  }
)
