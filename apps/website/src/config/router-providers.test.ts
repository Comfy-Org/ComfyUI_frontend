import { describe, expect, it } from 'vitest'

import routerCatalogSnapshotJson from '../data/router-catalog.snapshot.json' with { type: 'json' }
import { readRouterCatalogSnapshot } from './router-catalog-snapshot'
import {
  ROUTER_CATALOG_MODEL_COUNT,
  ROUTER_CATALOG_PROVENANCE,
  ROUTER_COMFY_ONLY_PREVIEW,
  ROUTER_PROVIDER_COVERAGE,
  ROUTER_SERVING_PROVIDERS
} from './router-providers'

const DOCS_ORIGIN = 'https://docs.comfy.org'
const snapshot = readRouterCatalogSnapshot(routerCatalogSnapshotJson)

function docsPathOf(docsUrl: string): string {
  return docsUrl.slice(DOCS_ORIGIN.length)
}

describe('Router provider coverage', () => {
  it('lists each model once, alphabetically', () => {
    const names = ROUTER_PROVIDER_COVERAGE.map((row) => row.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(new Set(names).size).toBe(names.length)
  })

  it('pins the catalog to a Comfy-Org/docs commit', () => {
    expect(ROUTER_CATALOG_PROVENANCE).toEqual({
      sourceRepo: snapshot.sourceRepo,
      sourceCommit: snapshot.sourceCommit
    })
    expect(snapshot.sourceCommit).toMatch(/^[0-9a-f]{40}$/)
  })

  it("matches each model's alternate providers in the pinned catalog", () => {
    const altById = new Map(
      snapshot.providerCoverage.rows.map((row) => [
        row.id,
        [...row.altProviders]
      ])
    )
    expect(
      ROUTER_PROVIDER_COVERAGE.map((row) => altById.get(row.modelId)?.sort())
    ).toEqual(ROUTER_PROVIDER_COVERAGE.map((row) => [...row.providers].sort()))
  })

  it('lists every model the pinned docs show with an alternate provider', () => {
    expect(snapshot.providerCoverage.providers).toEqual(
      ROUTER_SERVING_PROVIDERS.map((provider) => provider.name)
    )
    expect(
      snapshot.providerCoverage.rows.every((row) => row.comfy === '✓')
    ).toBe(true)
    const byDocsUrl = (a: { docsUrl: string }, b: { docsUrl: string }) =>
      a.docsUrl.localeCompare(b.docsUrl)
    expect(
      snapshot.providerCoverage.rows
        .map((row) => ({
          docsUrl: `${DOCS_ORIGIN}${row.docsPath}`,
          name: row.name
        }))
        .sort(byDocsUrl)
    ).toEqual(
      ROUTER_PROVIDER_COVERAGE.map((row) => ({
        docsUrl: row.docsUrl,
        name: row.docsName ?? row.name
      })).sort(byDocsUrl)
    )
    const catalog = new Map(
      snapshot.models.map((model) => [model.docsPath, model.id])
    )
    for (const row of ROUTER_PROVIDER_COVERAGE) {
      expect(catalog.get(docsPathOf(row.docsUrl))).toBe(row.modelId)
    }
  })

  it('counts the models the pinned catalog lists', () => {
    expect(new Set(snapshot.models.map((model) => model.docsPath)).size).toBe(
      snapshot.models.length
    )
    expect(
      snapshot.models.every((model) =>
        /^\/development\/comfy-router\/models\/[\w.-]+\/[\w.-]+\/code$/.test(
          model.docsPath
        )
      )
    ).toBe(true)
    expect(ROUTER_CATALOG_MODEL_COUNT).toBe(snapshot.models.length)
  })

  it('previews catalog models that only Comfy serves', () => {
    const catalog = new Map(
      snapshot.models.map((model) => [model.docsPath, model.name])
    )
    const covered = new Set(
      snapshot.providerCoverage.rows.map((row) => row.docsPath)
    )
    for (const { name, docsUrl } of ROUTER_COMFY_ONLY_PREVIEW) {
      const docsPath = docsPathOf(docsUrl)
      expect(catalog.get(docsPath)).toBe(name)
      expect(covered.has(docsPath)).toBe(false)
    }
  })
})
