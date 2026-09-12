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

function remapGraph(graph: Record<string, unknown>, opId: string, scope: string, definitionIds: Map<string, string>): void {
  const nodes = graph["nodes"] as WorkflowNode[];
  const links = (graph["links"] as unknown[] | undefined) ?? [];
  const nodeIds = new Map<unknown, string>();
  const linkIds = new Map<unknown, string>();
  for (const node of nodes) nodeIds.set(node.id, derivedId(opId, scope, "node", node.id));
  for (const link of links) {
    if (Array.isArray(link)) linkIds.set(link[0], derivedId(opId, scope, "link", link[0]));
    else if (typeof link === "object" && link !== null) {
      const record = link as { id?: unknown };
      linkIds.set(record.id, derivedId(opId, scope, "link", record.id));
    }
  }

  for (const node of nodes) {
    node.id = nodeIds.get(node.id)!;
    if (definitionIds.has(node.type)) node.type = definitionIds.get(node.type)!;
    if (Array.isArray(node.inputs)) {
      for (const input of node.inputs) {
        if (typeof input === "object" && input !== null && "link" in input) {
          const record = input as { link?: unknown };
          if (linkIds.has(record.link)) record.link = linkIds.get(record.link);
        }
      }
    }
    if (Array.isArray(node.outputs)) {
      for (const output of node.outputs) {
        if (typeof output === "object" && output !== null && Array.isArray((output as { links?: unknown }).links)) {
          const record = output as { links: unknown[] };
          record.links = record.links.map((id) => linkIds.get(id) ?? id);
        }
      }
    }
  }
  graph["links"] = links.map((link) => {
    if (Array.isArray(link)) {
      link[0] = linkIds.get(link[0]) ?? link[0];
      link[1] = nodeIds.get(link[1]) ?? link[1];
      link[3] = nodeIds.get(link[3]) ?? link[3];
    } else if (typeof link === "object" && link !== null) {
      const record = link as { id?: unknown; origin_id?: unknown; target_id?: unknown };
      record.id = linkIds.get(record.id) ?? record.id;
      record.origin_id = nodeIds.get(record.origin_id) ?? record.origin_id;
      record.target_id = nodeIds.get(record.target_id) ?? record.target_id;
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
  const definitionIds = new Map<string, string>();
  const collect = (definitions: Array<Record<string, unknown>>, scope: string): void => {
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
    for (const definition of definitions) {
      const original = String(definition["id"]);
      definition["id"] = definitionIds.get(original)!;
      remapGraph(definition, opId, `${scope}/definition:${encodeURIComponent(JSON.stringify(original))}`, definitionIds);
      const nested = (definition["definitions"] as { subgraphs?: Array<Record<string, unknown>> } | undefined)?.subgraphs ?? [];
      rewrite(nested, `${scope}/definition:${encodeURIComponent(JSON.stringify(original))}`);
    }
  };
  remapGraph(out, opId, "root", definitionIds);
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
