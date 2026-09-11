import { expect } from '@playwright/test'
import { Client as TemporalClient, Connection } from '@temporalio/client'
import { Client } from 'pg'
import { z } from 'zod'

import type { liveCloudBillingConfigSchema } from '@e2e/fixtures/utils/liveCloudBillingConfig'

const operationSchema = z.object({
  id: z.string(),
  type: z.literal('initial_subscription'),
  engine: z.literal('temporal'),
  phase: z.literal('awaiting_payment_method'),
  status: z.enum(['pending', 'failed']),
  metronome_commit_id: z.null(),
  to_subscription_id: z.string()
})
const sessionSchema = z.object({
  id: z.string().startsWith('cs_test_'),
  customer: z.string(),
  livemode: z.literal(false),
  status: z.enum(['open', 'expired'])
})

type Config = z.infer<typeof liveCloudBillingConfigSchema>

export async function withBillingCleanup(
  config: Config,
  workspaceId: string,
  run: () => Promise<void>
) {
  const db = new Client({
    connectionString: config.SMOKE_DB_DSN,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000
  })
  await db.connect()
  let connection: Connection | undefined
  try {
    const lock = await db.query(
      'SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS locked',
      [workspaceId]
    )
    expect(
      z.object({ locked: z.literal(true) }).parse(lock.rows[0]).locked,
      'Another billing test owns this workspace'
    ).toBe(true)
    const state = await db.query(
      `SELECT stripe_customer_id, billing_status, active_subscription_id
      FROM workspaces WHERE id=$1`,
      [workspaceId]
    )
    const workspace = z
      .object({
        stripe_customer_id: z.string().startsWith('cus_'),
        billing_status: z.literal('inactive'),
        active_subscription_id: z.null()
      })
      .parse(state.rows[0])
    const pending = await db.query(
      `SELECT id FROM billing_ops
      WHERE workspace_id=$1 AND status IN ('pending', 'paid_ungrantable')`,
      [workspaceId]
    )
    expect(
      pending.rows,
      'Workspace has pre-existing billing operations'
    ).toEqual([])
    const subscriptions = await db.query(
      `SELECT id FROM workspace_subscriptions
      WHERE workspace_id=$1 AND status <> 'ended'`,
      [workspaceId]
    )
    expect(
      subscriptions.rows,
      'Workspace has pre-existing subscriptions'
    ).toEqual([])

    async function stripe(path: string, method = 'GET'): Promise<unknown> {
      const response = await fetch(`https://api.stripe.com/v1/${path}`, {
        method,
        headers: { Authorization: `Bearer ${config.SMOKE_STRIPE_TEST_KEY}` },
        signal: AbortSignal.timeout(15_000)
      })
      expect(response.status, `Stripe ${method} ${path.split('?')[0]}`).toBe(
        200
      )
      return response.json()
    }
    z.object({
      id: z.literal(workspace.stripe_customer_id),
      livemode: z.literal(false)
    }).parse(await stripe(`customers/${workspace.stripe_customer_id}`))
    connection = await Connection.connect({
      address: config.TEMPORAL_ADDRESS,
      ...(config.TEMPORAL_API_KEY
        ? { apiKey: config.TEMPORAL_API_KEY, tls: true }
        : {})
    })
    const temporal = new TemporalClient({
      connection,
      namespace: config.TEMPORAL_NAMESPACE
    })
    await temporal.workflowService.describeNamespace({
      namespace: config.TEMPORAL_NAMESPACE
    })
    const before = await db.query(
      'SELECT id FROM billing_ops WHERE workspace_id=$1',
      [workspaceId]
    )
    const ids = z
      .array(z.object({ id: z.string() }))
      .parse(before.rows)
      .map(({ id }) => id)
    const startedAt = Math.floor(Date.now() / 1000)
    async function cleanup() {
      const sessions = z
        .object({ data: z.array(sessionSchema), has_more: z.literal(false) })
        .parse(
          await stripe(
            `checkout/sessions?customer=${workspace.stripe_customer_id}&created[gte]=${startedAt}&limit=100`
          )
        )
      for (const session of sessions.data) {
        expect(session.customer).toBe(workspace.stripe_customer_id)
        if (session.status === 'open') {
          expect(
            sessionSchema.parse(
              await stripe(`checkout/sessions/${session.id}/expire`, 'POST')
            ).status
          ).toBe('expired')
        }
      }
      const created = await db.query(
        `SELECT id, type, engine, phase, status, metronome_commit_id, to_subscription_id
        FROM billing_ops WHERE workspace_id=$1 AND NOT (id = ANY($2::varchar[]))`,
        [workspaceId, ids]
      )
      const operations = z.array(operationSchema).parse(created.rows)
      for (const operation of operations) {
        const workflow = temporal.workflow.getHandle(operation.id)
        if (operation.status === 'pending') {
          await workflow.signal('subscription_checkout_abandoned', {})
        }
        await expect
          .poll(async () => (await workflow.describe()).status.name, {
            timeout: 60_000
          })
          .toBe('FAILED')
        const ended = await db.query(
          `SELECT o.status AS operation_status, s.status AS subscription_status
          FROM billing_ops o JOIN workspace_subscriptions s ON s.id=o.to_subscription_id
          WHERE o.id=$1 AND o.workspace_id=$2`,
          [operation.id, workspaceId]
        )
        z.object({
          operation_status: z.literal('failed'),
          subscription_status: z.literal('ended')
        }).parse(ended.rows[0])
      }
      if (operations.length > 0) {
        await db.query('BEGIN')
        try {
          const restored = await db.query(
            `UPDATE workspaces SET billing_status='inactive', update_time=NOW()
            WHERE id=$1 AND active_subscription_id IS NULL
              AND billing_status IN ('inactive', 'awaiting_payment_method')
              AND NOT EXISTS (SELECT 1 FROM billing_ops WHERE workspace_id=$1 AND status IN ('pending', 'paid_ungrantable'))
              AND NOT EXISTS (SELECT 1 FROM workspace_subscriptions WHERE workspace_id=$1 AND status <> 'ended')
            RETURNING id`,
            [workspaceId]
          )
          expect(
            restored.rowCount,
            'Refusing cleanup of unexpected billing state'
          ).toBe(1)
          await db.query(
            `INSERT INTO billing_outboxes (create_time, update_time, event_type, workspace_id, processed)
            VALUES (NOW(), NOW(), 'projection_dirty', $1, false)`,
            [workspaceId]
          )
          await db.query('COMMIT')
        } catch (error) {
          await db.query('ROLLBACK')
          throw error
        }
      }
    }
    try {
      await run()
    } finally {
      await cleanup()
    }
  } finally {
    await Promise.all([connection?.close(), db.end()])
  }
}
