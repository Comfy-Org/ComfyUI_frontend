import { FuseSearchOptions, IFuseOptions } from 'fuse.js'
import _ from 'lodash'

import { ComfyNodeDefImpl } from '@/stores/nodeDefStore'
import { FuseSearch } from '@/utils/fuseUtil'

export type SearchAuxScore = number[]
export type FilterAndValue<T = string> = [NodeFilter<T>, T]

export class NodeFilter<T = string> {
  public readonly fuseSearch: FuseSearch<T>
  public readonly id: string
  public readonly name: string
  public readonly invokeSequence: string
  public readonly getNodeOptions: (node: ComfyNodeDefImpl) => T[]

  constructor(
    nodeDefs: ComfyNodeDefImpl[],
    options: {
      id: string
      name: string
      invokeSequence: string
      getNodeOptions: (node: ComfyNodeDefImpl) => T[]
      fuseOptions?: IFuseOptions<T>
    }
  ) {
    this.fuseSearch = new FuseSearch(this.getAllNodeOptions(nodeDefs), {
      fuseOptions: options.fuseOptions
    })

    this.id = options.id
    this.name = options.name
    this.invokeSequence = options.invokeSequence
    this.getNodeOptions = options.getNodeOptions
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

    const fuseOptions = {
      includeScore: true,
      threshold: 0.3,
      shouldSort: true
    }

    this.inputTypeFilter = new NodeFilter<string>(data, {
      id: 'input',
      name: 'Input Type',
      invokeSequence: 'i',
      getNodeOptions: (node) =>
        Object.values(node.inputs).map((input) => input.type),
      fuseOptions
    })

    this.outputTypeFilter = new NodeFilter<string>(data, {
      id: 'output',
      name: 'Output Type',
      invokeSequence: 'o',
      getNodeOptions: (node) => node.outputs.map((output) => output.type),
      fuseOptions
    })

    this.nodeCategoryFilter = new NodeFilter<string>(data, {
      id: 'category',
      name: 'Category',
      invokeSequence: 'c',
      getNodeOptions: (node) => [node.category],
      fuseOptions
    })

    this.nodeSourceFilter = new NodeFilter<string>(data, {
      id: 'source',
      name: 'Source',
      invokeSequence: 's',
      getNodeOptions: (node) => [node.nodeSource.displayText],
      fuseOptions
    })
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
