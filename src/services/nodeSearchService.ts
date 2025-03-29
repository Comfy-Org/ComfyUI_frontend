import { FuseSearchOptions, IFuseOptions } from 'fuse.js'
import _ from 'lodash'

import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { FuseSearch } from '@/utils/fuseUtil'

export type SearchAuxScore = number[]

interface ExtraSearchOptions {
  matchWildcards?: boolean
}

export type FilterAndValue<T = string> = [NodeFilter<T>, T]

export class NodeFilter<FilterOptionT = string> {
  public readonly fuseSearch: FuseSearch<FilterOptionT>

  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly invokeSequence: string,
    public readonly longInvokeSequence: string,
    public readonly nodeOptions:
      | FilterOptionT[]
      | ((node: ComfyNodeDefImpl) => FilterOptionT[]),
    nodeDefs: ComfyNodeDefImpl[],
    options?: IFuseOptions<FilterOptionT>
  ) {
    this.fuseSearch = new FuseSearch(this.getAllNodeOptions(nodeDefs), {
      fuseOptions: options
    })
  }

  public getNodeOptions(node: ComfyNodeDefImpl): FilterOptionT[] {
    return this.nodeOptions instanceof Function
      ? this.nodeOptions(node)
      : this.nodeOptions
  }

  public getAllNodeOptions(nodeDefs: ComfyNodeDefImpl[]): FilterOptionT[] {
    // @ts-expect-error fixme ts strict error
    return [
      ...new Set(
        // @ts-expect-error fixme ts strict error
        nodeDefs.reduce((acc, nodeDef) => {
          return [...acc, ...this.getNodeOptions(nodeDef)]
        }, [])
      )
    ]
  }

  public matches(
    node: ComfyNodeDefImpl,
    value: FilterOptionT,
    extraOptions?: ExtraSearchOptions
  ): boolean {
    const matchWildcards = extraOptions?.matchWildcards !== false
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
  public readonly nodeFilters: NodeFilter<string>[]

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

    const inputTypeFilter = new NodeFilter<string>(
      /* id */ 'input',
      /* name */ 'Input Type',
      /* invokeSequence */ 'i',
      /* longInvokeSequence */ 'input',
      (node) => Object.values(node.inputs).map((input) => input.type),
      data,
      filterSearchOptions
    )

    const outputTypeFilter = new NodeFilter<string>(
      /* id */ 'output',
      /* name */ 'Output Type',
      /* invokeSequence */ 'o',
      /* longInvokeSequence */ 'output',
      (node) => node.outputs.map((output) => output.type),
      data,
      filterSearchOptions
    )

    const nodeCategoryFilter = new NodeFilter<string>(
      /* id */ 'category',
      /* name */ 'Category',
      /* invokeSequence */ 'c',
      /* longInvokeSequence */ 'category',
      (node) => [node.category],
      data,
      filterSearchOptions
    )

    const nodeSourceFilter = new NodeFilter<string>(
      /* id */ 'source',
      /* name */ 'Source',
      /* invokeSequence */ 's',
      /* longInvokeSequence */ 'source',
      (node) => [node.nodeSource.displayText],
      data,
      filterSearchOptions
    )

    this.nodeFilters = [
      inputTypeFilter,
      outputTypeFilter,
      nodeCategoryFilter,
      nodeSourceFilter
    ]
  }

  public endsWithFilterStartSequence(query: string): boolean {
    return query.endsWith(':')
  }

  public searchNode(
    query: string,
    filters: FilterAndValue<string>[] = [],
    options?: FuseSearchOptions,
    extraOptions?: ExtraSearchOptions
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

  public getFilterById(id: string): NodeFilter<string> | undefined {
    return this.nodeFilters.find((filter) => filter.id === id)
  }
}
