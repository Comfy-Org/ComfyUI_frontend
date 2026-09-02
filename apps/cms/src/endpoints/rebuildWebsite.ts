import type { Endpoint, PayloadRequest } from 'payload'

/**
 * `POST /api/rebuild-website` — triggers a production website redeploy by POSTing
 * the Vercel Deploy Hook. The hook URL is a secret held server-side
 * (`WEBSITE_DEPLOY_HOOK_URL`) and never reaches the browser. Gated to users with
 * the `admin` role — a `website-preview` API key must not be able to trigger
 * production deploys. Backs the "Rebuild site" admin button.
 */
export const rebuildWebsiteEndpoint: Endpoint = {
  path: '/rebuild-website',
  method: 'post',
  handler: async (req: PayloadRequest): Promise<Response> => {
    if (!req.user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (req.user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 })
    }

    const hookUrl = process.env.WEBSITE_DEPLOY_HOOK_URL
    if (!hookUrl) {
      req.payload.logger.error('WEBSITE_DEPLOY_HOOK_URL is not set; cannot trigger website rebuild')
      return Response.json({ error: 'Deploy hook is not configured' }, { status: 500 })
    }

    try {
      const response = await fetch(hookUrl, { method: 'POST' })
      if (!response.ok) {
        return Response.json({ error: `Deploy hook responded ${response.status}` }, { status: 502 })
      }
      req.payload.logger.info({ user: req.user.id }, 'Website rebuild triggered via deploy hook')
      return Response.json({ ok: true })
    } catch (error) {
      // Log a classification, never the error object: fetch failures carry the
      // request url on `cause`, which would put the secret deploy hook in logs.
      req.payload.logger.error(
        { reason: error instanceof Error ? error.name : 'UnknownError' },
        'Failed to reach the deploy hook',
      )
      return Response.json({ error: 'Failed to reach the deploy hook' }, { status: 502 })
    }
  },
}
