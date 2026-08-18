/**
 * Answers POST /auth/token locally — the one endpoint billingMockHarness
 * leaves to a real backend. Install BEFORE the harness so its fetch patch
 * falls through to this shim for unmatched routes.
 */
export function installTokenShim(): void {
  const origFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    if (!url.includes('/auth/token')) return origFetch(input, init)

    const body = init?.body ? JSON.parse(String(init.body)) : {}
    const cfg = JSON.parse(
      localStorage.getItem('comfyBillingMock') || '{}'
    ) as { role?: string }
    const team = Boolean(body.workspace_id)
    return new Response(
      JSON.stringify({
        token: 'states-site-workspace-token',
        expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        workspace: team
          ? { id: body.workspace_id, name: 'My Team', type: 'team' }
          : { id: 'ws-personal', name: 'Personal', type: 'personal' },
        role: team && cfg.role !== 'owner' ? 'member' : 'owner',
        permissions: []
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
