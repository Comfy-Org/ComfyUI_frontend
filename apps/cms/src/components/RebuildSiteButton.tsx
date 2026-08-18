'use client'

import { Button, toast } from '@payloadcms/ui'
import { useState } from 'react'

/**
 * Admin dashboard button that triggers a production website redeploy by POSTing
 * to the server-side `/api/rebuild-website` endpoint (which holds the Vercel
 * Deploy Hook secret). Rendered via `admin.components.beforeDashboard`.
 */
export const RebuildSiteButton = () => {
  const [isRebuilding, setIsRebuilding] = useState(false)

  const handleClick = async () => {
    setIsRebuilding(true)
    try {
      const response = await fetch('/api/rebuild-website', {
        method: 'POST',
        credentials: 'include',
      })
      if (response.ok) {
        toast.success('Website rebuild triggered.')
        return
      }
      const body = (await response.json().catch(() => null)) as {
        error?: string
      } | null
      toast.error(body?.error ?? 'Failed to trigger website rebuild.')
    } catch {
      toast.error('Failed to reach the server.')
    } finally {
      setIsRebuilding(false)
    }
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <Button buttonStyle="secondary" disabled={isRebuilding} onClick={handleClick}>
        {isRebuilding ? 'Rebuilding…' : 'Rebuild site'}
      </Button>
    </div>
  )
}
