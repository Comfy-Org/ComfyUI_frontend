/**
 * Agent-readiness probe for a deployed comfy.org website origin. The
 * negotiation checks exercise Vercel Edge Middleware, so point this at a
 * deployment (preview or production), not `astro preview`.
 *
 *   pnpm agent:check https://<deployment>.vercel.app
 */

const base = process.argv[2]?.replace(/\/$/, '')
if (!base) {
  console.error('Usage: pnpm agent:check <baseUrl>')
  process.exit(2)
}

let failures = 0

function report(name: string, ok: boolean, detail?: string) {
  process.stdout.write(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : ` — ${detail}`}\n`
  )
  if (!ok) failures++
}

async function probe(path: string, init?: RequestInit) {
  const res = await fetch(`${base}${path}`, { redirect: 'manual', ...init })
  const body = init?.method === 'HEAD' ? '' : await res.text()
  return { res, body }
}

const md = { headers: { accept: 'text/markdown' } }

{
  const { res } = await probe('/some-path-that-does-not-exist')
  report(
    '404 status for unknown paths',
    res.status === 404,
    `got ${res.status}`
  )
}
{
  const { res, body } = await probe('/nonexistent-agent-check', md)
  report(
    '404 markdown body for agents',
    res.status === 404 &&
      (res.headers.get('content-type') ?? '').includes('text/markdown') &&
      body.includes('llms.txt'),
    `status ${res.status}, type ${res.headers.get('content-type')}`
  )
}
for (const path of ['/', '/api']) {
  const { res, body } = await probe(path, md)
  report(
    `markdown negotiation on ${path}`,
    res.status === 200 &&
      (res.headers.get('content-type') ?? '').includes('text/markdown') &&
      (res.headers.get('vary') ?? '').includes('Accept') &&
      body.startsWith('# '),
    `status ${res.status}, type ${res.headers.get('content-type')}, vary ${res.headers.get('vary')}`
  )
}
{
  const { res } = await probe('/', { headers: { accept: 'text/html' } })
  report(
    'html negotiation keeps Vary: Accept',
    (res.headers.get('content-type') ?? '').includes('text/html') &&
      (res.headers.get('vary') ?? '').includes('Accept'),
    `type ${res.headers.get('content-type')}, vary ${res.headers.get('vary')}`
  )
}
{
  const { res } = await probe('/', {
    headers: { accept: 'text/html, text/markdown;q=0.5' }
  })
  report(
    'q-values honored (html preferred)',
    (res.headers.get('content-type') ?? '').includes('text/html'),
    `type ${res.headers.get('content-type')}`
  )
}
{
  const { res } = await probe('/', { headers: { accept: 'application/pdf' } })
  report('406 for unsupported Accept', res.status === 406, `got ${res.status}`)
}
for (const path of ['/index.md', '/api.md', '/404.md']) {
  const { res } = await probe(path)
  report(
    `twin ${path} served as markdown`,
    res.status === 200 &&
      (res.headers.get('content-type') ?? '').includes('text/markdown'),
    `status ${res.status}, type ${res.headers.get('content-type')}`
  )
}
for (const path of ['/openapi.json', '/api/openapi.json']) {
  const { res, body } = await probe(path)
  let ok = res.status === 200
  if (ok) {
    try {
      const spec = JSON.parse(body)
      ok = Boolean(spec.openapi) && Object.keys(spec.paths ?? {}).length > 100
    } catch {
      ok = false
    }
  }
  report(`OpenAPI spec at ${path}`, ok, `status ${res.status}`)
}
for (const [path, target] of [
  ['/developers', '/api'],
  ['/docs', 'https://docs.comfy.org/']
]) {
  const { res } = await probe(path)
  report(
    `${path} redirects to ${target}`,
    res.status >= 300 &&
      res.status < 400 &&
      (res.headers.get('location') ?? '').includes(target),
    `status ${res.status}, location ${res.headers.get('location')}`
  )
}
{
  const { res, body } = await probe('/llms.txt')
  report(
    'llms.txt lists developer surfaces',
    res.status === 200 &&
      body.includes('/openapi.json') &&
      body.includes('text/markdown'),
    `status ${res.status}`
  )
}

process.stdout.write(
  failures === 0 ? '\nAll checks passed.\n' : `\n${failures} failed.\n`
)
process.exit(failures === 0 ? 0 : 1)

export {}
