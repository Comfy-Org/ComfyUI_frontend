import type {
  TestWorkflowCollections,
  TestWorkflowImportMetadata,
  TestWorkflowSummary
} from '@comfyorg/ingest-types/test-workflows'
import type { Page, Request } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import { TestIds } from '@e2e/fixtures/selectors'

export type TestWorkflowLibraryProbeInput = {
  collection: TestWorkflowCollections['collections'][number]
  entry: Pick<TestWorkflowSummary, 'name' | 'workflow_sha256' | 'node_count'>
  nodes: readonly Pick<ISerialisedNode, 'id' | 'type'>[]
  nodeTypes: TestWorkflowImportMetadata['node_types']
  tag?: TestWorkflowImportMetadata['tags'][number]
  unsupported?: boolean
}

export async function probeTestWorkflowLibrary(
  page: Page,
  input: TestWorkflowLibraryProbeInput
) {
  const requests: {
    path: string
    original: boolean
    cursor: boolean
    limit: string | null
  }[] = []
  let promptPosts = 0
  function observe(request: Request) {
    const url = new URL(request.url())
    if (request.method() === 'POST' && url.pathname === '/api/prompt')
      promptPosts += 1
    if (!url.pathname.startsWith('/api/test-workflow-library/')) return
    requests.push({
      path: url.pathname,
      original: url.searchParams.get('include_workflow') === 'true',
      cursor: Boolean(url.searchParams.get('cursor')),
      limit: url.searchParams.get('limit')
    })
  }
  page.on('request', observe)
  try {
    const originalNodes = await page.evaluate(() =>
      window
        .app!.rootGraph.nodes.map(({ id, type, last_serialization }) => ({
          id: String(id),
          type: last_serialization?.type ?? type
        }))
        .toSorted((a, b) => a.id.localeCompare(b.id))
    )
    const workflows = page.getByTestId(TestIds.sidebar.workflows)
    if (!(await workflows.isVisible()))
      await page.getByTestId(TestIds.sidebar.tabButton('workflows')).click()
    const entryButton = workflows.getByRole('button', {
      name: 'Test Workflow Library',
      exact: true
    })
    await expect(entryButton).toBeVisible()
    await expect(entryButton).toHaveText('Test Workflow Library')
    await entryButton.click()
    const library = page.getByTestId(TestIds.testWorkflowLibrary.root)
    await expect(library).toBeVisible()
    const collection = library.getByRole('combobox', { name: 'Collection' })
    const collectionName = `${input.collection.id} (${input.collection.count})`
    await expect(collection).toBeEnabled()
    if ((await collection.innerText()).trim() !== collectionName) {
      await collection.click()
      await page
        .getByRole('option', { name: collectionName, exact: true })
        .click()
    }
    await expect(
      library.getByRole('button', { name: 'Search', exact: true })
    ).toBeEnabled()
    if (input.collection.count > 24) {
      const next = library.getByRole('button', {
        name: 'Next page',
        exact: true
      })
      await expect(next).toBeEnabled()
      await next.click()
      await expect.poll(() => requests.some(({ cursor }) => cursor)).toBe(true)
      const first = library.getByRole('button', {
        name: 'Back to first page',
        exact: true
      })
      await expect(first).toBeEnabled()
      await first.click()
      await expect(first).toBeEnabled()
    }
    const search = library.getByRole('combobox', {
      name: 'Search test workflows'
    })
    await search.fill(input.entry.name)
    await library.getByRole('button', { name: 'Search', exact: true }).click()
    const selected = library.getByTestId(
      TestIds.testWorkflowLibrary.entry(input.entry.workflow_sha256)
    )
    await expect(selected).toBeVisible()
    if (input.tag) {
      await library.getByRole('combobox', { name: 'Tags', exact: true }).click()
      await page.getByRole('option', { name: input.tag, exact: true }).click()
      await library.getByRole('button', { name: 'Search', exact: true }).click()
      await expect(selected).toBeVisible()
    }
    await selected.click()
    await expect(selected).toHaveAttribute('aria-pressed', 'true')
    await expect(
      library.getByRole('heading', { name: input.entry.name, exact: true })
    ).toBeVisible()
    for (const type of input.nodeTypes)
      await expect(library.getByText(type, { exact: true })).toBeVisible()
    await expect(
      library.getByRole('button', {
        name: 'MagicPatch conversion',
        exact: true
      })
    ).toBeDisabled()
    expect(requests.filter(({ original }) => original)).toHaveLength(0)
    const beforeOpen = await page.evaluate(() =>
      window
        .app!.rootGraph.nodes.map(({ id, type, last_serialization }) => ({
          id: String(id),
          type: last_serialization?.type ?? type
        }))
        .toSorted((a, b) => a.id.localeCompare(b.id))
    )
    expect(beforeOpen).toEqual(originalNodes)
    await library
      .getByRole('button', { name: 'Open original graph', exact: true })
      .click()
    await expect(library).toBeHidden()
    const expectedNodes = input.nodes
      .map(({ id, type }) => ({ id: String(id), type }))
      .toSorted((a, b) => a.id.localeCompare(b.id))
    await expect
      .poll(() =>
        page.evaluate(() =>
          window
            .app!.rootGraph.nodes.map(({ id, type, last_serialization }) => ({
              id: String(id),
              type: last_serialization?.type ?? type
            }))
            .toSorted((a, b) => a.id.localeCompare(b.id))
        )
      )
      .toEqual(expectedNodes)
    expect(requests.filter(({ original }) => original)).toHaveLength(1)
    for (const { path, limit } of requests)
      if (path.endsWith('/entries')) expect(limit).toBe('24')
    expect(promptPosts).toBe(0)
    const missingNodeWarning = page.getByTestId(TestIds.dialogs.errorOverlay)
    if (input.unsupported) await expect(missingNodeWarning).toBeVisible()
    const missingNodeWarningVisible = await missingNodeWarning.isVisible()
    return {
      collection: input.collection.id,
      workflow_sha256: input.entry.workflow_sha256,
      loadedNodes: expectedNodes,
      originalRequests: requests.filter(({ original }) => original).length,
      paginated: requests.some(({ cursor }) => cursor),
      promptPosts,
      missingNodeWarningVisible,
      requests
    }
  } finally {
    page.off('request', observe)
  }
}
