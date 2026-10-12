import type { WorkflowJSON, WorkflowNode } from "./types.js";
import { sha256Hex } from "./digest.js";

function derivedId(opId: string, scope: string, kind: string, original: unknown): string {
  return `insert:${opId}:${scope}:${kind}:${encodeURIComponent(JSON.stringify(original))}`;
}

function derivedDefinitionId(opId: string, scope: string, original: unknown): string {
  const hex = sha256Hex(derivedId(opId, scope, "definition", original));
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * A newly derived link id must be a real `number` — ComfyUI_frontend's
 * `LinkId` is `number & { __brand }`, unlike `NodeId` (`string | number`), so
 * the string form `derivedId` gives every other kind cannot satisfy it
 * (ComfyUI_frontend#18458).
 *
 * `derivedLinkId` folds the digest into the FULL safe-integer range
 * (`[1, Number.MAX_SAFE_INTEGER]`, i.e. `[1, 2^53 - 1]`) rather than the
 * narrower 52-bit window an earlier revision used, so the mint spends every
 * bit of entropy `LinkId`'s numeric type can safely hold (ADR-033 amendment,
 * review discussion on PR #245). 32 hex characters (128 bits) are taken from
 * the digest before the modulus is applied so the reduction to 53 bits stays
 * close to uniform; sha256Hex's 64-character output has plenty to spare.
 */
const LINK_ID_HEX_DIGITS = 32; // 128 bits, folded down to 53 by SAFE_INTEGER_MODULUS below.

/** `2^53 - 1` as a `BigInt`, i.e. `Number.MAX_SAFE_INTEGER` — every candidate lands in `[1, MAX_SAFE_INTEGER]`. */
const SAFE_INTEGER_MODULUS = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * Mint a numeric id for a link `insert_workflow` carries — PURELY as a
 * function of the op's own content (`opId`, `scope`, `original`), with NO
 * document-state dependency (ADR-033 amendment, superseding the
 * document-verified retry mint the original revision of this PR shipped).
 *
 * Christian Byrne's review of the original revision (PR #245, inline on this
 * file) found that the retry-against-`taken` design made link identity
 * depend on LOCAL ARRIVAL ORDER: if two link seeds shared the same first
 * candidate, applying them A-then-B minted A the natural candidate and B the
 * next one, while applying B-then-A minted B the natural candidate and A the
 * next one — two replicas that apply the same op set in different orders
 * could project genuinely different link ids for the same logical links,
 * which is exactly the class of bug KA-4 (deterministic/idempotent
 * projection) and KA-2 (order-independent identity) exist to rule out.
 *
 * The fix removes the retry (and the document read it required) entirely:
 * the SAME op, applied to ANY document state, in ANY order relative to any
 * other op, always derives the SAME numeric id — because nothing but the
 * op's own fields feeds the hash. This restores ADR-031's "producers do not
 * inspect document state or remap ids" for links too, at the cost of the
 * "checked collision-free against this document" property the retry design
 * offered: two derived ids (or a derived id and something already persisted)
 * can now coincide, with probability bounded by the ~53 bits of entropy
 * below (see the KA-5 row in `docs/decisions/EXCEPTIONS.md` for the exact
 * figure and why it is an accepted residual risk rather than a defect).
 * `applier.ts`'s existing `acceptsLink` still catches a REALIZED collision
 * against an already-persisted link at apply time (the same LWW-gated check
 * every other `insert_workflow` id kind already goes through) — that check
 * is ordinary id-collision handling this package has always had, not new
 * state-dependence introduced here, and it resolves by the op-order-
 * independent `[base_version, actor, op_id]` stamp comparison, not by
 * arrival order.
 */
function derivedLinkId(opId: string, scope: string, original: unknown): number {
  return numericId(derivedId(opId, scope, "link", original));
}

/**
 * Fold a string seed into `[1, Number.MAX_SAFE_INTEGER]`: 128 bits of its
 * sha256 reduced modulo `2^53 - 1`. Pure, so every replica derives the same
 * number for the same seed.
 */
export function numericId(seed: string): number {
  const hex = sha256Hex(seed).slice(0, LINK_ID_HEX_DIGITS);
  return Number((BigInt(`0x${hex}`) % SAFE_INTEGER_MODULUS) + 1n);
}

/**
 * A group id must be a `number`: ComfyUI_frontend's workflow schema declares
 * `groups[].id` as `z.number()` at the root and inside
 * `definitions.subgraphs[].groups`, and refuses the whole workflow otherwise.
 * Groups therefore take the links' numeric derivation, seeded with the string
 * `derivedId` they used to carry verbatim — which is also what lets
 * `project.ts` read a document that still stores that string
 * (`projectGroupId`) as the same number.
 */
function derivedGroupId(opId: string, scope: string, original: unknown): number {
  return numericId(derivedId(opId, scope, "group", original));
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

/**
 * Litegraph's synthetic subgraph IO node ids. A subgraph definition's interior
 * link reaches the definition's own promoted inputs (`-10`, the input node) and
 * exposed outputs (`-20`, the output node) through these sentinels, which are
 * deliberately NOT members of the definition's `nodes` array — see the z-image
 * turbo template in `test/definition-links-roundtrip.test.ts`. Treating them as
 * missing endpoints dropped every promoted-widget link an inserted definition
 * carried.
 */
const SUBGRAPH_INPUT_NODE_ID = "-10";
const SUBGRAPH_OUTPUT_NODE_ID = "-20";

function isSubgraphIoNodeId(id: unknown): boolean {
  const key = normalizedId(id);
  return key === SUBGRAPH_INPUT_NODE_ID || key === SUBGRAPH_OUTPUT_NODE_ID;
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

function remapInputs(inputs: unknown, linkIds: Map<string, number>, droppedLinkIds: Set<string>): void {
  if (!Array.isArray(inputs)) return;
  for (const input of inputs) {
    if (typeof input !== "object" || input === null || !("link" in input)) continue;
    const record = input as { link?: unknown };
    if (record.link === null || record.link === undefined) continue;
    const id = normalizedId(record.link);
    if (droppedLinkIds.has(id)) record.link = null;
    else if (linkIds.has(id)) record.link = linkIds.get(id);
  }
}

/**
 * Rewrite one array-of-link-ids field carried by each entry of `records`:
 * `links` on a node's output slots, `linkIds` on a definition's own promoted
 * input / exposed output declarations. A dropped id is removed from the array
 * (the array form of what `remapInputs` does by nulling a scalar `.link`); an
 * id that is neither dropped nor remapped passes through untouched.
 */
function remapLinkIdArray(
  records: unknown,
  field: string,
  linkIds: Map<string, number>,
  droppedLinkIds: Set<string>,
): void {
  if (!Array.isArray(records)) return;
  for (const entry of records) {
    if (typeof entry !== "object" || entry === null || !Array.isArray((entry as Record<string, unknown>)[field])) continue;
    const record = entry as Record<string, unknown>;
    record[field] = (record[field] as unknown[])
      .filter((id) => !droppedLinkIds.has(normalizedId(id)))
      .map((id) => linkIds.get(normalizedId(id)) ?? id);
  }
}

/** A proxyWidgets entry owner of `-1` addresses the instance itself. */
const PROXY_INSTANCE_SENTINEL = "-1";

/**
 * Rewrite a subgraph instance's `properties.proxyWidgets` entries, which name
 * the promoted widget's interior node by its raw id (`["27", "text"]`), through
 * that definition's interior id map. `-1` (the instance itself) and ids the
 * definition does not hold pass through untouched.
 */
function remapProxyWidgets(node: WorkflowNode, interiorIds: Map<string, string> | undefined): void {
  const properties = (node as { properties?: unknown }).properties;
  if (interiorIds === undefined || typeof properties !== "object" || properties === null) return;
  const proxy = (properties as { proxyWidgets?: unknown }).proxyWidgets;
  if (!Array.isArray(proxy)) return;
  for (const entry of proxy) {
    if (!Array.isArray(entry) || entry.length < 1) continue;
    // `-1` is the instance sentinel, never an interior node — even when the
    // definition holds an interior node whose own id is -1.
    if (normalizedId(entry[0]) === PROXY_INSTANCE_SENTINEL) continue;
    const remapped = interiorIds.get(normalizedId(entry[0]));
    if (remapped !== undefined) entry[0] = remapped;
  }
}

function remapGraph(
  graph: Record<string, unknown>,
  opId: string,
  scope: string,
  definitionIds: Map<string, string>,
  dropDanglingLinks: boolean,
  isDefinitionInterior = false,
  interiorNodeIds: (definitionId: string) => Map<string, string> | undefined = () => undefined,
): void {
  const nodes = graph["nodes"] as WorkflowNode[];
  const nodeIds = new Map<string, string>();
  const linkIds = new Map<string, number>();
  // Numeric and string aliases normalized by validation name the same node.
  for (const node of nodes) nodeIds.set(normalizedId(node.id), derivedId(opId, scope, "node", node.id));
  const droppedLinkIds = new Set<string>();
  const hasNode = (id: unknown): boolean =>
    nodeIds.has(normalizedId(id)) || (isDefinitionInterior && isSubgraphIoNodeId(id));
  const links = ((graph["links"] as unknown[] | undefined) ?? []).filter((link) => {
    const dropped = dropDanglingLinks && linkHasMissingEndpoint(link, hasNode);
    if (dropped) droppedLinkIds.add(normalizedId(linkId(link)));
    return !dropped;
  });
  for (const link of links) {
    const id = linkId(link);
    linkIds.set(normalizedId(id), derivedLinkId(opId, scope, id));
  }

  for (const node of nodes) {
    node.id = nodeIds.get(normalizedId(node.id))!;
    if (definitionIds.has(node.type)) {
      remapProxyWidgets(node, interiorNodeIds(node.type));
      node.type = definitionIds.get(node.type)!;
    }
    remapInputs(node.inputs, linkIds, droppedLinkIds);
    remapLinkIdArray(node.outputs, "links", linkIds, droppedLinkIds);
  }
  // A subgraph definition's OWN promoted-input / exposed-output declarations
  // name their interior links in `linkIds`. Leaving them at the pre-remap ids
  // resolved against nothing, so every declared input read back as unpromoted.
  remapLinkIdArray(graph["inputs"], "linkIds", linkIds, droppedLinkIds);
  remapLinkIdArray(graph["outputs"], "linkIds", linkIds, droppedLinkIds);
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
        if (record.id !== undefined) record.id = derivedGroupId(opId, scope, record.id);
      }
      return group;
    });
  }
}

/**
 * Deterministically remap every id carried by an insertion op, including
 * nested definition graphs.
 *
 * Every id this function derives — node, link, group, and definition — is a
 * PURE function of (`opId`, `scope`, `kind`, `original`) alone (ADR-031,
 * amended for links by the ADR-033 revision on PR #245). No document, no
 * caller-supplied reservation set, and no state from any other call factors
 * into the result: the same `(wf, opId)` pair always produces byte-identical
 * output, on any replica, regardless of what else that replica's document
 * holds or what order concurrent ops arrive in. This is what makes the
 * result safe to compute before touching the target document at all —
 * `applier.ts` calls this once per `insert_workflow` application with no
 * document in scope yet.
 */
export function remapInsertedWorkflowIds(wf: WorkflowJSON, opId: string): WorkflowJSON {
  const out = structuredClone(wf) as WorkflowJSON & Record<string, unknown>;
  out.links ??= [];
  out.groups ??= [];
  const subgraphs = (out.definitions?.subgraphs ?? []) as Array<Record<string, unknown>>;
  const definitionIdsByScope = new Map<string, Map<string, string>>();
  // Interior node id maps keyed by definition scope, computed before any
  // rewrite so an instance's proxyWidgets can follow its interior nodes.
  const interiorNodeIdsByScope = new Map<string, Map<string, string>>();
  const definitionScopeOf = (scope: string, original: string): string =>
    `${scope}/definition:${encodeURIComponent(JSON.stringify(original))}`;
  const collect = (definitions: Array<Record<string, unknown>>, scope: string): void => {
    const definitionIds = new Map<string, string>();
    definitionIdsByScope.set(scope, definitionIds);
    for (const definition of definitions) {
      const original = String(definition["id"]);
      const remapped = derivedDefinitionId(opId, scope, original);
      definitionIds.set(original, remapped);
      const definitionScope = definitionScopeOf(scope, original);
      const interior = new Map<string, string>();
      for (const node of (definition["nodes"] as WorkflowNode[] | undefined) ?? []) {
        interior.set(normalizedId(node.id), derivedId(opId, definitionScope, "node", node.id));
      }
      interiorNodeIdsByScope.set(definitionScope, interior);
      const nested = (definition["definitions"] as { subgraphs?: Array<Record<string, unknown>> } | undefined)?.subgraphs ?? [];
      collect(nested, definitionScope);
    }
  };
  collect(subgraphs, "root");
  /**
   * A definition's interior node can name, by its `type`, a definition
   * genuinely NESTED inside this one (JSON `definitions.subgraphs` — the
   * `childScope`) or — the shape litegraph's own serializer actually
   * produces — a definition this op carries as a FLAT SIBLING of this one:
   * `LGraph.asSerialisable()` never nests a definition inside another
   * definition's own `definitions.subgraphs`. It walks every USED subgraph
   * reachable from the root, however deeply an instance sits, into the
   * single top-level `out.definitions.subgraphs` list it emits alongside
   * the root graph (`findUsedSubgraphIds`), so an interior node that is
   * itself a subgraph instance names a definition that is this
   * definition's SIBLING (the `siblingScope` this definition itself was
   * collected under), not one nested under it.
   *
   * Check the nested scope first, so two definitions nested under different
   * parents that happen to share a raw id (see
   * "scopes repeated nested definition ids to their sibling definition
   * paths") stay distinct, then fall back to the sibling scope. Before this
   * fallback, an interior node that was itself a subgraph instance kept its
   * un-remapped, un-registered blueprint id and materialized as a plain,
   * widget-less node.
   */
  const definitionIdsAt = (childScope: string, siblingScope: string): Map<string, string> => {
    const sibling = definitionIdsByScope.get(siblingScope) ?? new Map<string, string>();
    const child = definitionIdsByScope.get(childScope) ?? new Map<string, string>();
    return child.size === 0 ? sibling : new Map([...sibling, ...child]);
  };
  const interiorNodeIdsAt =
    (childScope: string, siblingScope: string) =>
    (definitionId: string): Map<string, string> | undefined =>
      interiorNodeIdsByScope.get(definitionScopeOf(childScope, definitionId)) ??
      interiorNodeIdsByScope.get(definitionScopeOf(siblingScope, definitionId));
  const rewrite = (definitions: Array<Record<string, unknown>>, scope: string): void => {
    const definitionIds = definitionIdsByScope.get(scope)!;
    for (const definition of definitions) {
      const original = String(definition["id"]);
      definition["id"] = definitionIds.get(original)!;
      const definitionScope = definitionScopeOf(scope, original);
      remapGraph(
        definition,
        opId,
        definitionScope,
        definitionIdsAt(definitionScope, scope),
        true,
        true,
        interiorNodeIdsAt(definitionScope, scope),
      );
      const nested = (definition["definitions"] as { subgraphs?: Array<Record<string, unknown>> } | undefined)?.subgraphs ?? [];
      rewrite(nested, definitionScope);
    }
  };
  remapGraph(
    out,
    opId,
    "root",
    definitionIdsByScope.get("root")!,
    true,
    false,
    interiorNodeIdsAt("root", "root"),
  );
  rewrite(subgraphs, "root");
  return out;
}
