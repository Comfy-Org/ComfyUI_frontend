import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { Plugin } from 'vite'

/**
 * Dev-only Vite plugin: accept POSTs to /__agent-log and append each
 * JSONL line to a per-session file under ./tmp/agent-logs/.
 *
 * Filename: ./tmp/agent-logs/<YYYY-MM-DD>-<sessionId>.jsonl
 *   - <sessionId> is the 8-char id assigned in the browser logger and
 *     attached to every entry. One file per page load makes individual
 *     conversations trivially diff-able and grep-able without sifting
 *     through a daily mixed log.
 *   - Entries without a sessionId fall back to '<date>-orphan.jsonl' so
 *     unattributed lines don't get silently dropped.
 *
 * GET /__agent-log → returns the directory + a 1-line summary of recent
 * session files (debugging aid).
 *
 * No-op in production builds (apply: 'serve'). Same origin as the Vite
 * dev server so the browser-side logger can POST with a simple fetch().
 */
export function agentLogPlugin(): Plugin {
  const LOG_DIR = join(process.cwd(), 'tmp', 'agent-logs')

  return {
    name: 'agent-log',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__agent-log', (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ dir: LOG_DIR, mode: 'per-session' }))
          return
        }

        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }

        const chunks: Buffer[] = []
        req.on('data', (c: Buffer) => chunks.push(c))
        req.on('end', () => {
          try {
            if (!existsSync(LOG_DIR)) {
              mkdirSync(LOG_DIR, { recursive: true })
            }
            const date = new Date().toISOString().slice(0, 10)
            const body = Buffer.concat(chunks).toString('utf8')

            // Group lines by sessionId so a single batch carrying multiple
            // sessions (rare but possible) lands in the right files.
            const buckets = new Map<string, string[]>()
            for (const raw of body.split('\n')) {
              const line = raw.trim()
              if (!line) continue
              let sessionId = 'orphan'
              try {
                const parsed = JSON.parse(line) as { sessionId?: string }
                if (
                  parsed.sessionId &&
                  /^[A-Za-z0-9-]{1,64}$/.test(parsed.sessionId)
                ) {
                  sessionId = parsed.sessionId
                }
              } catch {
                // Keep raw text in the orphan bucket; don't drop it.
              }
              const arr = buckets.get(sessionId) ?? []
              arr.push(line)
              buckets.set(sessionId, arr)
            }

            for (const [sessionId, lines] of buckets) {
              const file = join(LOG_DIR, `${date}-${sessionId}.jsonl`)
              appendFileSync(file, lines.join('\n') + '\n', 'utf8')
            }
            res.statusCode = 204
            res.end()
          } catch (err) {
            res.statusCode = 500
            res.end(err instanceof Error ? err.message : String(err))
          }
        })
      })
    }
  }
}
