import type { WorkflowJSON, WorkflowNode } from "./types.js";
import { sha256Hex } from "./digest.js";

export interface RemapWorkflowIdsOptions {
  nodeIdStart: number;
  linkIdStart: number;
}

function derivedId(opId: string, scope: string, kind: string, original: unknown): string {
  return `insert:${opId}:${scope}:${kind}:${encodeURIComponent(JSON.stringify(original))}`;
}

function derivedDefinitionId(opId: string, scope: string, original: unknown): string {
  const hex = sha256Hex(derivedId(opId, scope, "definition", original));
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function linkEndpoints(link: unknown): [unknown, unknown] | undefined {
  if (Array.isArray(link) && link[1] !== undefined && link[3] !== undefined) return [link[1], link[3]];
  if (typeof link === "object" && link !== null) {
    const record = link as { origin_id?: unknown; target_id?: unknown };
    if (record.origin_id !== undefined && record.target_id !== undefined) return [record.origin_id, record.target_id];
  }
  return undefined;
}

function normalizedId(id: unknown): string {
  return typeof id === "string" ? id : String(id);
}

function linkId(link: unknown): unknown {
  if (Array.isArray(link)) return link[0];
  if (typeof link === "object" && link !== null) return (link as { id?: unknown }).id;
  return undefined;
}

export function linkHasMissingEndpoint(link: unknown, hasNode: (id: unknown) => boolean): boolean {
  const endpoints = linkEndpoints(link);
  return endpoints !== undefined && (!hasNode(endpoints[0]) || !hasNode(endpoints[1]));
}

function remapGraph(
  graph: Record<string, unknown>,
  opId: string,
  scope: string,
  definitionIds: Map<string, string>,
  dropDanglingLinks: boolean,
): void {
  const nodes = graph["nodes"] as WorkflowNode[];
  const nodeIds = new Map<string, string>();
  const linkIds = new Map<string, string>();
  // Numeric and string aliases normalized by validation name the same node.
  for (const node of nodes) nodeIds.set(normalizedId(node.id), derivedId(opId, scope, "node", node.id));
  const droppedLinkIds = new Set<string>();
  const links = ((graph["links"] as unknown[] | undefined) ?? []).filter((link) => {
    const dropped = dropDanglingLinks && linkHasMissingEndpoint(link, (id) => nodeIds.has(normalizedId(id)));
    if (dropped) droppedLinkIds.add(normalizedId(linkId(link)));
    return !dropped;
  });
  for (const link of links) {
    const id = linkId(link);
    linkIds.set(normalizedId(id), derivedId(opId, scope, "link", id));
  }

  for (const node of nodes) {
    node.id = nodeIds.get(normalizedId(node.id))!;
    if (definitionIds.has(node.type)) node.type = definitionIds.get(node.type)!;
    if (Array.isArray(node.inputs)) {
      for (const input of node.inputs) {
        if (typeof input === "object" && input !== null && "link" in input) {
          const record = input as { link?: unknown };
          const id = normalizedId(record.link);
          if (droppedLinkIds.has(id)) record.link = null;
          else if (linkIds.has(id)) record.link = linkIds.get(id);
        }
      }
    }
    if (Array.isArray(node.outputs)) {
      for (const output of node.outputs) {
        if (typeof output === "object" && output !== null && Array.isArray((output as { links?: unknown }).links)) {
          const record = output as { links: unknown[] };
          record.links = record.links
            .filter((id) => !droppedLinkIds.has(normalizedId(id)))
            .map((id) => linkIds.get(normalizedId(id)) ?? id);
        }
      }
    }
  }
  graph["links"] = links.map((link) => {
    if (Array.isArray(link)) {
      link[0] = linkIds.get(normalizedId(link[0])) ?? link[0];
      link[1] = nodeIds.get(normalizedId(link[1])) ?? link[1];
      link[3] = nodeIds.get(normalizedId(link[3])) ?? link[3];
    } else if (typeof link === "object" && link !== null) {
      const record = link as { id?: unknown; origin_id?: unknown; target_id?: unknown };
      record.id = linkIds.get(normalizedId(record.id)) ?? record.id;
      record.origin_id = nodeIds.get(normalizedId(record.origin_id)) ?? record.origin_id;
      record.target_id = nodeIds.get(normalizedId(record.target_id)) ?? record.target_id;
    }
    return link;
  });
  if (Array.isArray(graph["groups"])) {
    graph["groups"] = (graph["groups"] as unknown[]).map((group) => {
      if (typeof group === "object" && group !== null && !Array.isArray(group)) {
        const record = group as { id?: unknown };
        if (record.id !== undefined) record.id = derivedId(opId, scope, "group", record.id);
      }
      return group;
    });
  }
}

/** Deterministically remap every id carried by an insertion op, including nested definition graphs. */
export function remapInsertedWorkflowIds(wf: WorkflowJSON, opId: string): WorkflowJSON {
  const out = structuredClone(wf) as WorkflowJSON & Record<string, unknown>;
  out.links ??= [];
  out.groups ??= [];
  const subgraphs = (out.definitions?.subgraphs ?? []) as Array<Record<string, unknown>>;
  const definitionIdsByScope = new Map<string, Map<string, string>>();
  const collect = (definitions: Array<Record<string, unknown>>, scope: string): void => {
    const definitionIds = new Map<string, string>();
    definitionIdsByScope.set(scope, definitionIds);
    for (const definition of definitions) {
      const original = String(definition["id"]);
      const remapped = derivedDefinitionId(opId, scope, original);
      definitionIds.set(original, remapped);
      const nested = (definition["definitions"] as { subgraphs?: Array<Record<string, unknown>> } | undefined)?.subgraphs ?? [];
      collect(nested, `${scope}/definition:${encodeURIComponent(JSON.stringify(original))}`);
    }
  };
  collect(subgraphs, "root");
  const rewrite = (definitions: Array<Record<string, unknown>>, scope: string): void => {
    const definitionIds = definitionIdsByScope.get(scope)!;
    for (const definition of definitions) {
      const original = String(definition["id"]);
      definition["id"] = definitionIds.get(original)!;
      const definitionScope = `${scope}/definition:${encodeURIComponent(JSON.stringify(original))}`;
      remapGraph(definition, opId, definitionScope, definitionIdsByScope.get(definitionScope)!, true);
      const nested = (definition["definitions"] as { subgraphs?: Array<Record<string, unknown>> } | undefined)?.subgraphs ?? [];
      rewrite(nested, definitionScope);
    }
  };
  remapGraph(out, opId, "root", definitionIdsByScope.get("root")!, true);
  rewrite(subgraphs, "root");
  return out;
}

/** Remap only the top-level graph namespace; definition interiors are independent graphs. */
export function remapWorkflowIds(wf: WorkflowJSON, opts: RemapWorkflowIdsOptions): WorkflowJSON {
  const out = structuredClone(wf);
  const nodeIds = new Map<unknown, number>();
  const linkIds = new Map<unknown, number>();

  out.nodes.forEach((node, index) => nodeIds.set(node.id, opts.nodeIdStart + index));
  out.links.forEach((link, index) => {
    if (Array.isArray(link)) linkIds.set(link[0], opts.linkIdStart + index);
  });

  out.nodes = out.nodes.map((node): WorkflowNode => {
    const remapped = node as WorkflowNode;
    remapped.id = nodeIds.get(node.id)!;
    if (Array.isArray(remapped.inputs)) {
      for (const input of remapped.inputs) {
        if (typeof input === "object" && input !== null && "link" in input) {
          const record = input as { link?: unknown };
          if (linkIds.has(record.link)) record.link = linkIds.get(record.link);
        }
      }
    }
    if (Array.isArray(remapped.outputs)) {
      for (const output of remapped.outputs) {
        if (typeof output === "object" && output !== null && Array.isArray((output as { links?: unknown }).links)) {
          const record = output as { links: unknown[] };
          record.links = record.links.map((id) => linkIds.get(id) ?? id);
        }
      }
    }
    return remapped;
  });

  out.links = out.links.map((link) => {
    if (!Array.isArray(link)) return link;
    link[0] = linkIds.get(link[0]) ?? link[0];
    link[1] = nodeIds.get(link[1]) ?? link[1];
    link[3] = nodeIds.get(link[3]) ?? link[3];
    return link;
  });
  return out;
}
