import type { FuseSearchOptions } from 'fuse.js'

import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import type { FuseFilterWithValue } from '@/utils/fuseUtil'
import { FuseFilter, FuseSearch } from '@/utils/fuseUtil'

export class NodeSearchService {
  public readonly nodeFuseSearch: FuseSearch<ComfyNodeDefImpl>
  public readonly inputTypeFilter: FuseFilter<ComfyNodeDefImpl>
  public readonly outputTypeFilter: FuseFilter<ComfyNodeDefImpl>
  public readonly nodeCategoryFilter: FuseFilter<ComfyNodeDefImpl>
  public readonly nodeSourceFilter: FuseFilter<ComfyNodeDefImpl>

  constructor(data: ComfyNodeDefImpl[]) {
    this.nodeFuseSearch = new FuseSearch(data, {
      fuseOptions: {
        keys: ['name', 'display_name', 'search_aliases'],
        includeScore: true,
        threshold: 0.3,
        shouldSort: false,
        useExtendedSearch: true
      },
      createIndex: true,
      advancedScoring: true
    })

    const fuseOptions = {
      includeScore: true,
      threshold: 0.3,
      shouldSort: true
    }

    this.inputTypeFilter = new FuseFilter<ComfyNodeDefImpl>(data, {
      id: 'input',
      name: 'Input Type',
      invokeSequence: 'i',
      getItemOptions: (node) => node.inputTypes,
      fuseOptions
    })

    this.outputTypeFilter = new FuseFilter<ComfyNodeDefImpl>(data, {
      id: 'output',
      name: 'Output Type',
      invokeSequence: 'o',
      getItemOptions: (node) =>
        node.outputs.flatMap((output) => output.type.split(',')),
      fuseOptions
    })

    this.nodeCategoryFilter = new FuseFilter<ComfyNodeDefImpl>(data, {
      id: 'category',
      name: 'Category',
      invokeSequence: 'c',
      getItemOptions: (node) => [node.category],
      fuseOptions
    })

    this.nodeSourceFilter = new FuseFilter<ComfyNodeDefImpl>(data, {
      id: 'source',
      name: 'Source',
      invokeSequence: 's',
      getItemOptions: (node) => [node.nodeSource.displayText],
      fuseOptions
    })
  }

  public searchNode(
    query: string,
    filters: FuseFilterWithValue<ComfyNodeDefImpl>[] = [],
    options?: FuseSearchOptions,
    extraOptions: {
      matchWildcards?: boolean
    } = {}
  ): ComfyNodeDefImpl[] {
    const { matchWildcards = true } = extraOptions
    const wildcard = matchWildcards ? '*' : undefined
    const matchedNodes = this.nodeFuseSearch.search(query)

    const results = matchedNodes.filter((node) => {
      return filters.every((filterAndValue) => {
        const { filterDef, value } = filterAndValue
        return filterDef.matches(node, value)
      })
    })
    if (matchWildcards) {
      const alreadyValid = new Set(results.map((result) => result.name))
      results.push(
        ...matchedNodes
          .filter((node) => !alreadyValid.has(node.name))
          .filter((node) => {
            return filters.every((filterAndValue) => {
              const { filterDef, value } = filterAndValue
              return filterDef.matches(node, value, { wildcard })
            })
          })
      )
    }

    return options?.limit ? results.slice(0, options.limit) : results
  }

  get nodeFilters(): FuseFilter<ComfyNodeDefImpl>[] {
    return [
      this.inputTypeFilter,
      this.outputTypeFilter,
      this.nodeCategoryFilter,
      this.nodeSourceFilter
    ]
  }
}
