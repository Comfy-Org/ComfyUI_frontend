'use client'

import { Button, toast } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

const hasErrorMessage = (body: unknown): body is { error: string } =>
  typeof body === 'object' &&
  body !== null &&
  'error' in body &&
  typeof (body as { error: unknown }).error === 'string'

/**
 * Admin dashboard button that triggers a production website redeploy by POSTing
 * to the server-side `/api/rebuild-website` endpoint (which holds the Vercel
 * Deploy Hook secret). Rendered via `admin.components.beforeDashboard`.
 *
 * Triggering a production deploy from one click is too easy to do by accident,
 * so the first click only arms the button and the second fires the rebuild.
 */
export const RebuildSiteButton = () => {
  const [isRebuilding, setIsRebuilding] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [lastTriggeredAt, setLastTriggeredAt] = useState<Date | null>(null)

  useEffect(() => {
    if (!isConfirming) {
      return
    }
    const timeout = setTimeout(() => setIsConfirming(false), 5000)
    return () => clearTimeout(timeout)
  }, [isConfirming])

  const handleClick = async () => {
    if (!isConfirming) {
      setIsConfirming(true)
      return
    }
    setIsConfirming(false)
    setIsRebuilding(true)
    try {
      const response = await fetch('/api/rebuild-website', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        toast.success('Website rebuild triggered.')
        setLastTriggeredAt(new Date())
        return
      }
      const body: unknown = await response.json().catch(() => null)
      toast.error(hasErrorMessage(body) ? body.error : 'Failed to trigger website rebuild.')
    } catch {
      toast.error('Failed to reach the server.')
    } finally {
      setIsRebuilding(false)
    }
  }

  const label = isRebuilding
    ? 'Rebuilding…'
    : isConfirming
      ? 'Click again to confirm'
      : 'Rebuild site'

  return (
    <div style={{ marginBottom: '1rem' }}>
      <Button buttonStyle="secondary" disabled={isRebuilding} onClick={handleClick}>
        {label}
      </Button>
      {lastTriggeredAt && (
        <span style={{ marginLeft: '0.75rem' }}>
          Rebuild triggered at {lastTriggeredAt.toLocaleTimeString()} — the deploy takes a few
          minutes to go live.
        </span>
      )}
    </div>
  )
}
