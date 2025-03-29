import { FuseSearchOptions } from 'fuse.js'

import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { FuseFilter, FuseFilterWithValue, FuseSearch } from '@/utils/fuseUtil'

export class NodeSearchService {
  public readonly nodeFuseSearch: FuseSearch<ComfyNodeDefImpl>
  public readonly inputTypeFilter: FuseFilter<ComfyNodeDefImpl, string>
  public readonly outputTypeFilter: FuseFilter<ComfyNodeDefImpl, string>
  public readonly nodeCategoryFilter: FuseFilter<ComfyNodeDefImpl, string>
  public readonly nodeSourceFilter: FuseFilter<ComfyNodeDefImpl, string>

  constructor(data: ComfyNodeDefImpl[]) {
    this.nodeFuseSearch = new FuseSearch(data, {
      fuseOptions: {
        keys: ['name', 'display_name'],
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

    this.inputTypeFilter = new FuseFilter<ComfyNodeDefImpl, string>(data, {
      id: 'input',
      name: 'Input Type',
      invokeSequence: 'i',
      getItemOptions: (node) =>
        Object.values(node.inputs).map((input) => input.type),
      fuseOptions
    })

    this.outputTypeFilter = new FuseFilter<ComfyNodeDefImpl, string>(data, {
      id: 'output',
      name: 'Output Type',
      invokeSequence: 'o',
      getItemOptions: (node) => node.outputs.map((output) => output.type),
      fuseOptions
    })

    this.nodeCategoryFilter = new FuseFilter<ComfyNodeDefImpl, string>(data, {
      id: 'category',
      name: 'Category',
      invokeSequence: 'c',
      getItemOptions: (node) => [node.category],
      fuseOptions
    })

    this.nodeSourceFilter = new FuseFilter<ComfyNodeDefImpl, string>(data, {
      id: 'source',
      name: 'Source',
      invokeSequence: 's',
      getItemOptions: (node) => [node.nodeSource.displayText],
      fuseOptions
    })
  }

  public searchNode(
    query: string,
    filters: FuseFilterWithValue<ComfyNodeDefImpl, string>[] = [],
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
        return filterDef.matches(node, value, { wildcard })
      })
    })

    return options?.limit ? results.slice(0, options.limit) : results
  }

  get nodeFilters(): FuseFilter<ComfyNodeDefImpl, string>[] {
    return [
      this.inputTypeFilter,
      this.outputTypeFilter,
      this.nodeCategoryFilter,
      this.nodeSourceFilter
    ]
  }
}
