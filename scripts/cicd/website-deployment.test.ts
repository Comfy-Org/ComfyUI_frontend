import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const SCRIPT = path.join(import.meta.dirname, 'website-deployment.sh')
const SHA = 'a'.repeat(40)
const PROJECT = 'prj_website'
const DEPLOYMENT = 'dpl_new'

const ownIdentity = { sha: SHA, runId: '7', runAttempt: '2' }

const fakeCurl = `#!/usr/bin/env bash
for url; do :; done
printf '%s\\n' "$url" >> "$FAKE_DIR/calls.log"
case $url in
  https://api.vercel.com/v4/aliases/*) file=alias.json ;;
  https://api.vercel.com/v13/deployments/*) file=deployment.json ;;
  */__build.json*) host=\${url#https://}; file=identity-\${host%%/*}.json ;;
  https://comfy.org/) exit 0 ;;
esac
[[ -n \${file:-} && -f $FAKE_DIR/$file ]] || exit 22
cat "$FAKE_DIR/$file"
`

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'website-deployment-'))
  fs.mkdirSync(path.join(dir, 'bin'))
  fs.mkdirSync(path.join(dir, 'apps/website/public'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'bin/curl'), fakeCurl, { mode: 0o755 })
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

function serve(responses: Record<string, unknown>) {
  for (const [file, body] of Object.entries(responses)) {
    fs.writeFileSync(path.join(dir, file), JSON.stringify(body))
  }
}

function run(...args: string[]) {
  const result = spawnSync('bash', [SCRIPT, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      PATH: `${path.join(dir, 'bin')}:${process.env.PATH ?? ''}`,
      FAKE_DIR: dir,
      GITHUB_REPOSITORY: 'Comfy-Org/ComfyUI_frontend',
      GITHUB_RUN_ID: '7',
      GITHUB_RUN_ATTEMPT: '2',
      VERCEL_ORG_ID: 'team_comfy',
      VERCEL_PROJECT_ID: PROJECT,
      VERCEL_TOKEN: 'token'
    }
  })
  const log = path.join(dir, 'calls.log')
  return {
    status: result.status,
    stdout: result.stdout.trim(),
    calls: fs.existsSync(log)
      ? fs.readFileSync(log, 'utf8').trim().split('\n')
      : []
  }
}

describe('website deployment identity', () => {
  it('writes the build identity for the current run', () => {
    expect(run('write-build-identity', SHA).status).toBe(0)

    expect(
      JSON.parse(
        fs.readFileSync(
          path.join(dir, 'apps/website/public/__build.json'),
          'utf8'
        )
      )
    ).toMatchObject({
      repository: 'Comfy-Org/ComfyUI_frontend',
      ...ownIdentity
    })
  })

  it.for([
    {
      name: 'the URL of its own deployment',
      args: [DEPLOYMENT, 'url'],
      deployment: { id: DEPLOYMENT, projectId: PROJECT, url: 'new.vercel.app' },
      expected: 'new.vercel.app'
    },
    {
      name: 'the id of its own deployment host',
      args: ['new.vercel.app', 'id'],
      deployment: { id: DEPLOYMENT, project: { id: PROJECT } },
      expected: DEPLOYMENT
    },
    {
      name: 'nothing for another project',
      args: [DEPLOYMENT, 'url'],
      deployment: { id: DEPLOYMENT, projectId: 'prj_other', url: 'x' },
      expected: undefined
    },
    {
      name: 'nothing for a different deployment id',
      args: [DEPLOYMENT, 'url'],
      deployment: { id: 'dpl_other', projectId: PROJECT, url: 'x' },
      expected: undefined
    }
  ])('resolves $name', ({ args, deployment, expected }) => {
    serve({ 'deployment.json': deployment })

    const result = run('deployment', ...args)

    expect(result.status === 0 ? result.stdout : undefined).toBe(expected)
  })

  it.for([
    {
      name: 'a matching preview',
      args: ['--host', 'https://new.vercel.app/'],
      identity: { sha: SHA },
      ok: true
    },
    {
      name: 'a preview serving another commit',
      args: ['--host', 'new.vercel.app'],
      identity: { sha: 'b'.repeat(40) },
      ok: false
    },
    {
      name: 'a staged build from this run',
      args: ['--host', 'new.vercel.app', '--this-run'],
      identity: ownIdentity,
      ok: true
    },
    {
      name: 'a staged build from an earlier attempt',
      args: ['--host', 'new.vercel.app', '--this-run'],
      identity: { ...ownIdentity, runAttempt: '1' },
      ok: false
    },
    {
      name: 'a canonical host on the expected deployment',
      args: ['--canonical-deployment', DEPLOYMENT],
      identity: { sha: SHA },
      ok: true
    },
    {
      name: 'a canonical host aliased to another deployment',
      args: ['--canonical-deployment', 'dpl_old'],
      identity: { sha: SHA },
      ok: false
    }
  ])('verifies $name: $ok', ({ args, identity, ok }) => {
    serve({
      'identity-new.vercel.app.json': identity,
      'identity-comfy.org.json': identity,
      'alias.json': { deploymentId: DEPLOYMENT }
    })

    const result = run('verify-identity', '--sha', SHA, ...args)

    expect(result.status === 0).toBe(ok)
  })

  it('retries until the attempts are exhausted', () => {
    serve({ 'identity-new.vercel.app.json': { sha: 'b'.repeat(40) } })

    const result = run(
      'verify-identity',
      '--host',
      'new.vercel.app',
      '--sha',
      SHA,
      '--attempts',
      '3'
    )

    expect(result.status).toBe(1)
    expect(result.calls).toHaveLength(3)
  })

  it('reads the deployment aliased to comfy.org', () => {
    serve({ 'alias.json': { deploymentId: 'dpl_live' } })

    expect(run('alias-deployment-id').stdout).toBe('dpl_live')
  })

  it('reports an empty marker SHA when the deployment has no identity', () => {
    expect(run('marker-sha', 'old.vercel.app').stdout).toBe('')
  })
})
