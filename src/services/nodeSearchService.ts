import { ComfyNodeDef } from "@/types/apiTypes";
import { getNodeSource } from "@/types/nodeSource";
import Fuse, { IFuseOptions, FuseSearchOptions } from "fuse.js";
import _ from "lodash";

export type NodeFilterType = {
  name: string;
  displayText: string;
  invokeSequences: string[];
  getData: (node: ComfyNodeDef) => string[];
};

type NodeFilterValue = string;
export type NodeSearchResult = {
  type: "nodeDef" | "filterType" | "filterValue";
  value: NodeFilterType | ComfyNodeDef | NodeFilterValue;
};

export type NodeFilter = {
  type: NodeFilterType;
  value: NodeFilterValue;
};

export class NodeSearchService {
  public static readonly SUPPORTED_NODE_FILTER_TYPES: NodeFilterType[] = [
    {
      name: "InputTypeFilter",
      displayText: "Node with input type",
      invokeSequences: ["input", "i"],
      getData: (node: ComfyNodeDef) => {
        const inputs = {
          ...(node.input.required || {}),
          ...(node.input.optional || {}),
        };
        return Object.values(inputs).map((input) => {
          const [inputType, inputSpec] = input;
          return typeof inputType === "string" ? inputType : "COMBO";
        });
      },
    },
    {
      name: "OutputTypeFilter",
      displayText: "Node with output type",
      invokeSequences: ["output", "o"],
      getData: (node: ComfyNodeDef) => {
        const outputs = node.output;
        return outputs.map((output) => {
          return typeof output === "string" ? output : output[0];
        });
      },
    },
    {
      name: "NodeSourceFilter",
      displayText: "Node from source",
      invokeSequences: ["source", "s"],
      getData: (node: ComfyNodeDef) => [
        getNodeSource(node.python_module).displayText,
      ],
    },
    {
      name: "NodeCategoryFilter",
      displayText: "Node in category",
      invokeSequences: ["category", "c"],
      getData: (node: ComfyNodeDef) => [node.category],
    },
  ];

  private static instance: NodeSearchService;
  private fuse: Fuse<ComfyNodeDef>;
  private filterOptionsFuse: Record<string, Fuse<string>>;
  public readonly nodes: ComfyNodeDef[];
  public readonly filterOptions: Record<string, NodeFilterValue[]>;

  private constructor(data: ComfyNodeDef[]) {
    const options: IFuseOptions<ComfyNodeDef> = {
      keys: ["name", "display_name", "description"],
      includeScore: true,
      threshold: 0.6,
      shouldSort: true,
    };
    const index = Fuse.createIndex(options.keys, data);
    this.fuse = new Fuse(data, options, index);
    this.nodes = data;
    this.filterOptions = {};
    this.filterOptionsFuse = {};
    NodeSearchService.SUPPORTED_NODE_FILTER_TYPES.forEach((filterType) => {
      const filterOptionsRecord = data.reduce(
        (acc: Record<string, string>, node) => {
          const nodeData = filterType.getData(node);
          return {
            ...acc,
            ...nodeData.reduce((acc, data) => {
              acc[data] = data;
              return acc;
            }, {}),
          };
        },
        {}
      );
      const filterOptions: string[] = Object.values(filterOptionsRecord);
      const options: IFuseOptions<string> = {
        includeScore: true,
        threshold: 0.6,
        shouldSort: true,
      };

      this.filterOptionsFuse[filterType.name] = new Fuse(
        filterOptions,
        options
      );
      this.filterOptions[filterType.name] = filterOptions;
    });
  }

  public static getInstance(data?: ComfyNodeDef[]): NodeSearchService {
    if (!NodeSearchService.instance) {
      if (!data) {
        throw new Error(
          "NodeSearchService requires initial data for instantiation."
        );
      }
      NodeSearchService.instance = new NodeSearchService(data);
    }
    return NodeSearchService.instance;
  }

  public endsWithFilterStartSequence(query: string): boolean {
    return query.endsWith(":");
  }

  public searchNode(
    query: string,
    filters: NodeFilter[] = [],
    options?: FuseSearchOptions
  ): ComfyNodeDef[] {
    const matchedNodes =
      query !== undefined && query !== ""
        ? this.fuse.search(query).map((result) => result.item)
        : this.nodes;

    const results = matchedNodes.filter((node) => {
      return _.every(filters, (filter) => {
        return filter.type.getData(node).includes(filter.value);
      });
    });

    return options?.limit ? results.slice(0, options.limit) : results;
  }

  /**
   * Searches for available options for a filter based on the given invoke sequence and query.
   * @param invokeSeq - The invoke sequence to filter by.
   * @param query - The search query.
   * @param options - Optional search options.
   * @returns An array of FuseResult objects containing the available filter options.
   */
  public searchFilter(
    query: string,
    nodeFilterType: NodeFilterType,
    options?: FuseSearchOptions
  ): string[] {
    const fuse = this.filterOptionsFuse[nodeFilterType.name];
    return fuse.search(query, options).map((result) => result.item);
  }
}
