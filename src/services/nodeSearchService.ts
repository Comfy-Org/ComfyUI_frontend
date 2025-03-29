import { FuseSearchOptions, IFuseOptions } from 'fuse.js'
import _ from 'lodash'

import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { FuseSearch } from '@/utils/fuseUtil'

export type SearchAuxScore = number[]
export type FilterAndValue<T = string> = [NodeFilter<T>, T]

export class NodeFilter<T = string> {
  public readonly fuseSearch: FuseSearch<T>

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly invokeSequence: string,
    public readonly longInvokeSequence: string,
    public readonly getNodeOptions: (node: ComfyNodeDefImpl) => T[],
    nodeDefs: ComfyNodeDefImpl[],
    options?: IFuseOptions<T>
  ) {
    this.fuseSearch = new FuseSearch(this.getAllNodeOptions(nodeDefs), {
      fuseOptions: options
    })
  }

  public getAllNodeOptions(nodeDefs: ComfyNodeDefImpl[]): T[] {
    const options = new Set<T>()
    for (const nodeDef of nodeDefs) {
      for (const option of this.getNodeOptions(nodeDef)) {
        options.add(option)
      }
    }
    return Array.from(options)
  }

  public matches(
    node: ComfyNodeDefImpl,
    value: T,
    extraOptions: {
      matchWildcards?: boolean
    } = {}
  ): boolean {
    const { matchWildcards = true } = extraOptions

    if (matchWildcards && value === '*') {
      return true
    }
    const options = this.getNodeOptions(node)
    return (
      options.includes(value) ||
      (matchWildcards && _.some(options, (option) => option === '*'))
    )
  }
}

export class NodeSearchService {
  public readonly nodeFuseSearch: FuseSearch<ComfyNodeDefImpl>
  public readonly inputTypeFilter: NodeFilter<string>
  public readonly outputTypeFilter: NodeFilter<string>
  public readonly nodeCategoryFilter: NodeFilter<string>
  public readonly nodeSourceFilter: NodeFilter<string>

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

    const filterSearchOptions = {
      includeScore: true,
      threshold: 0.3,
      shouldSort: true
    }

    this.inputTypeFilter = new NodeFilter<string>(
      /* id */ 'input',
      /* name */ 'Input Type',
      /* invokeSequence */ 'i',
      /* longInvokeSequence */ 'input',
      (node) => Object.values(node.inputs).map((input) => input.type),
      data,
      filterSearchOptions
    )

    this.outputTypeFilter = new NodeFilter<string>(
      /* id */ 'output',
      /* name */ 'Output Type',
      /* invokeSequence */ 'o',
      /* longInvokeSequence */ 'output',
      (node) => node.outputs.map((output) => output.type),
      data,
      filterSearchOptions
    )

    this.nodeCategoryFilter = new NodeFilter<string>(
      /* id */ 'category',
      /* name */ 'Category',
      /* invokeSequence */ 'c',
      /* longInvokeSequence */ 'category',
      (node) => [node.category],
      data,
      filterSearchOptions
    )

    this.nodeSourceFilter = new NodeFilter<string>(
      /* id */ 'source',
      /* name */ 'Source',
      /* invokeSequence */ 's',
      /* longInvokeSequence */ 'source',
      (node) => [node.nodeSource.displayText],
      data,
      filterSearchOptions
    )
  }

  public endsWithFilterStartSequence(query: string): boolean {
    return query.endsWith(':')
  }

  public searchNode(
    query: string,
    filters: FilterAndValue<string>[] = [],
    options?: FuseSearchOptions,
    extraOptions?: {
      matchWildcards?: boolean
    }
  ): ComfyNodeDefImpl[] {
    const matchedNodes = this.nodeFuseSearch.search(query)

    const results = matchedNodes.filter((node) => {
      return _.every(filters, (filterAndValue) => {
        const [filter, value] = filterAndValue
        return filter.matches(node, value, extraOptions)
      })
    })

    return options?.limit ? results.slice(0, options.limit) : results
  }

  get nodeFilters(): NodeFilter<string>[] {
    return [
      this.inputTypeFilter,
      this.outputTypeFilter,
      this.nodeCategoryFilter,
      this.nodeSourceFilter
    ]
  }
}
