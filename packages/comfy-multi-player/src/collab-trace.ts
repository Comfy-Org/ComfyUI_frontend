/**
 * Versioned evidence contract for collaboration replay tooling.
 *
 * A trace records facts observed around the real applier. It is not a mutation
 * format and intentionally exposes no replay, merge, comparator, Yjs, or mint
 * API. Consumers render captured decisions; they must never recompute them.
 */
import { assertNever } from "./exhaustive.js";
import { compareStampKeys } from "./stamps.js";
import { FROZEN_OPS, WRITABLE_NODE_FIELDS, type Op, type StampKey } from "./types.js";

export const COLLAB_TRACE_SCHEMA = "comfy.collab-replay/v1" as const;
export type CollabTraceSchema = typeof COLLAB_TRACE_SCHEMA;

export interface TraceHash {
  algorithm: "sha256";
  encoding: "canonical-json-v1" | "yjs-state-vector" | "binary";
  value: string;
}

export interface TraceSource {
  cmp_sha: string;
  harness_sha: string;
  fixture_sha: string;
  catalog_sha: string;
  /** Optional adapters participating in this capture. */
  fe_sha?: string;
  cloud_sha?: string;
  dirty: boolean;
  node_version: string;
  yjs_version: string;
}

export interface TraceRun {
  trace_id: string;
  test: string;
  seed: number | string;
  source: TraceSource;
  workflow_id: string;
  lineage_id: string;
  ordering_scheme: string;
  projection_normalization: "workflow-projection/v1";
  counterexample_path?: readonly number[];
  input_hash?: TraceHash;
}

export type CausalKnowledge =
  | { status: "known"; parents: readonly CausalParent[] }
  | { status: "partial"; parents: readonly CausalParent[] }
  | { status: "unknown"; parents: readonly [] };

export interface CausalParent {
  op_id: string;
  relation: "observed-before" | "fixture-declared";
  evidence: "producer-observation" | "vector-reference" | "fixture";
}

export interface TraceTarget {
  kind: "conflict-register" | "affected-path" | "workflow";
  path: readonly (string | number)[];
  role: "conflict" | "effect" | "scope";
}

export type DecisionEvidence =
  | { kind: "lww-comparison"; winning_stamp: StampKey; losing_stamp: StampKey }
  | { kind: "dedupe"; original_op_id: string }
  | { kind: "rejection"; code: string; message: string; failing_index: number | null }
  | { kind: "none" };

export interface SemanticDiff {
  nodes_added: readonly (string | number)[];
  nodes_removed: readonly (string | number)[];
  nodes_changed: readonly (string | number)[];
  links_added: readonly (string | number)[];
  links_removed: readonly (string | number)[];
  links_changed: readonly (string | number)[];
}

export interface SemanticOpTraceStep {
  step_id: string;
  kind: "semantic-op";
  actor: string;
  op_id: string;
  /** Preserved verbatim. It must not be reconstructed from base_version. */
  stamp: readonly [number, string];
  base_version: number;
  arrival_index: number;
  causal: CausalKnowledge;
  observed_frontier?: Readonly<Record<string, number>>;
  verb: Op["op"];
  /** Complete mint-time payload, including defaults; never re-derived on replay. */
  payload: Op;
  before_projection_hash: TraceHash;
  after_projection_hash: TraceHash;
  semantic_diff: SemanticDiff;
  outcome: "applied" | "no-op" | "lww-dropped" | "rejected";
  reason_code: string;
  processed: boolean;
  consumed_op_id: boolean;
  targets: readonly TraceTarget[];
  decision_evidence: DecisionEvidence;
  batch?: { batch_id: string; index: number; size: number };
}

export interface RawUpdateDiagnostic {
  direction: "host-to-follower";
  byte_length: number;
  hash: TraceHash;
  attachment_ref?: string;
}

interface LifecycleBase {
  step_id: string;
  arrival_index: number;
  workflow_id: string;
  before_lineage_id: string;
  after_lineage_id: string;
  before_doc_id: string;
  after_doc_id: string;
  before_state_vector_hash: TraceHash;
  after_state_vector_hash: TraceHash;
  diagnostic?: RawUpdateDiagnostic;
}

export interface StateVectorReplayTraceStep extends LifecycleBase {
  kind: "state-vector-replay";
  same_document: true;
  reason: "seq-gap" | "reconnect";
  requested_from_seq?: number;
  resumed_at_seq?: number;
}

export interface DocResetTraceStep extends LifecycleBase {
  kind: "doc-reset";
  same_document: false;
  reset_seq: number;
  projectors_notified_before_replace: boolean;
}

export type CollabTraceStep = SemanticOpTraceStep | StateVectorReplayTraceStep | DocResetTraceStep;

export interface CollabReplayTraceV1 {
  schema: CollabTraceSchema;
  run: TraceRun;
  steps: readonly CollabTraceStep[];
  assertions: {
    converged: boolean;
    final_projection_hash: TraceHash;
    final_applied_op_ids_hash: TraceHash;
    failure_step_id: string | null;
  };
}

type UnknownRecord = Record<string, unknown>;

const HASH_ENCODINGS = ["canonical-json-v1", "yjs-state-vector", "binary"] as const;
const STEP_KINDS = ["semantic-op", "state-vector-replay", "doc-reset"] as const;
const OUTCOMES = ["applied", "no-op", "lww-dropped", "rejected"] as const;
const DECISION_KINDS = ["lww-comparison", "dedupe", "rejection", "none"] as const;
const OP_ID_PATTERN = /^[0-9a-f]{32}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

interface ValidatedBatchStep {
  context: string;
  batchId: string;
  index: number;
  size: number;
  outcome: SemanticOpTraceStep["outcome"];
  reasonCode: string;
  processed: boolean;
  failingIndex: number | null | undefined;
}

interface ValidatedSemanticStep {
  beforeHash: TraceHash;
  afterHash: TraceHash;
  batchStep: ValidatedBatchStep | undefined;
}

function invalid(context: string, message: string): never {
  throw new TypeError(`${context} ${message}`);
}

function asRecord(value: unknown, context: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) invalid(context, "must be an object");
  return value as UnknownRecord;
}

function required(record: UnknownRecord, key: string, context: string): unknown {
  if (!Object.hasOwn(record, key)) invalid(`${context}.${key}`, "is required");
  return record[key];
}

function asString(value: unknown, context: string): string {
  if (typeof value !== "string" || value.length === 0) invalid(context, "must be a non-empty string");
  return value;
}

function asBoolean(value: unknown, context: string): boolean {
  if (typeof value !== "boolean") invalid(context, "must be a boolean");
  return value;
}

function asInteger(value: unknown, context: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) invalid(context, `must be an integer >= ${minimum}`);
  return value as number;
}

function asOneOf<const T extends readonly string[]>(value: unknown, choices: T, context: string): T[number] {
  const candidate = asString(value, context);
  if (!choices.includes(candidate as T[number])) invalid(context, `has unsupported value '${candidate}'`);
  return candidate as T[number];
}

function asOpId(value: unknown, context: string): string {
  const opId = asString(value, context);
  if (!OP_ID_PATTERN.test(opId)) invalid(context, "has an invalid immutable op_id");
  return opId;
}

function asNodeId(value: unknown, context: string): string | number {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return value;
  return invalid(context, "must be a non-empty string or safe integer");
}

function asArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) invalid(context, "must be an array");
  return value;
}

function assertOptionalString(record: UnknownRecord, key: string, context: string): void {
  if (Object.hasOwn(record, key)) asString(record[key], `${context}.${key}`);
}

function assertOptionalInteger(record: UnknownRecord, key: string, context: string): void {
  if (Object.hasOwn(record, key)) asInteger(record[key], `${context}.${key}`);
}

function assertNodeIdArray(value: unknown, context: string): void {
  for (const [index, item] of asArray(value, context).entries()) asNodeId(item, `${context}[${index}]`);
}

function assertNumberArray(value: unknown, context: string): void {
  for (const [index, item] of asArray(value, context).entries()) {
    if (typeof item !== "number" || !Number.isFinite(item)) invalid(`${context}[${index}]`, "must be a finite number");
  }
}

function assertJsonValue(value: unknown, context: string, ancestors = new Set<object>()): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) invalid(context, "must be canonical JSON data");
    return;
  }
  if (typeof value !== "object") invalid(context, "must be canonical JSON data");
  if (ancestors.has(value)) invalid(context, "must be canonical JSON data without reference cycles");

  ancestors.add(value);
  if (Array.isArray(value)) {
    assertJsonArray(value, context, ancestors);
  } else {
    assertJsonObject(value, context, ancestors);
  }
  ancestors.delete(value);
}

function assertJsonArray(value: unknown[], context: string, ancestors: Set<object>): void {
  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) {
    invalid(context, "must be canonical JSON data without ignored array properties");
  }
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) invalid(`${context}[${index}]`, "must be canonical JSON data without sparse entries");
    assertJsonValue(value[index], `${context}[${index}]`, ancestors);
  }
}

function assertJsonObject(value: object, context: string, ancestors: Set<object>): void {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid(context, "must be a canonical JSON object");
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") invalid(context, "must be canonical JSON data without symbol keys");
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    if (!descriptor.enumerable || !("value" in descriptor)) invalid(`${context}.${key}`, "must be canonical JSON data without ignored or computed properties");
    assertJsonValue(descriptor.value, `${context}.${key}`, ancestors);
  }
}

function assertHash(value: unknown, context: string): TraceHash {
  const hash = asRecord(value, context);
  const algorithm = asOneOf(required(hash, "algorithm", context), ["sha256"] as const, `${context}.algorithm`);
  const encoding = asOneOf(required(hash, "encoding", context), HASH_ENCODINGS, `${context}.encoding`);
  const digest = asString(required(hash, "value", context), `${context}.value`);
  if (!SHA256_PATTERN.test(digest)) invalid(`${context}.value`, "must be a lowercase sha256 digest");
  return { algorithm, encoding, value: digest };
}

function assertHashWithEncoding(value: unknown, context: string, encoding: TraceHash["encoding"]): TraceHash {
  const hash = assertHash(value, context);
  if (hash.encoding !== encoding) invalid(`${context}.encoding`, `must be ${encoding}`);
  return hash;
}

function hashesMatch(left: TraceHash, right: TraceHash): boolean {
  return left.algorithm === right.algorithm && left.encoding === right.encoding && left.value === right.value;
}

function assertStamp(value: unknown, context: string): readonly [number, string] {
  const stamp = asArray(value, context);
  if (stamp.length !== 2) invalid(context, "must contain exactly [counter, actor]");
  return [asInteger(stamp[0], `${context}[0]`), asString(stamp[1], `${context}[1]`)];
}

function assertStampKey(value: unknown, context: string): StampKey {
  const stamp = asArray(value, context);
  if (stamp.length !== 3) invalid(context, "must contain exactly [counter, actor, op_id]");
  return [asInteger(stamp[0], `${context}[0]`), asString(stamp[1], `${context}[1]`), asOpId(stamp[2], `${context}[2]`)];
}

function assertSource(value: unknown, context: string): void {
  const source = asRecord(value, context);
  for (const key of ["cmp_sha", "harness_sha", "fixture_sha", "catalog_sha", "node_version", "yjs_version"] as const) {
    asString(required(source, key, context), `${context}.${key}`);
  }
  asBoolean(required(source, "dirty", context), `${context}.dirty`);
  assertOptionalString(source, "fe_sha", context);
  assertOptionalString(source, "cloud_sha", context);
}

function assertRun(value: unknown, context: string): { lineageId: string; workflowId: string } {
  const run = asRecord(value, context);
  asString(required(run, "trace_id", context), `${context}.trace_id`);
  asString(required(run, "test", context), `${context}.test`);
  const seed = required(run, "seed", context);
  if ((typeof seed !== "number" || !Number.isFinite(seed)) && (typeof seed !== "string" || seed.length === 0)) {
    invalid(`${context}.seed`, "must be a finite number or non-empty string");
  }
  assertSource(required(run, "source", context), `${context}.source`);
  const workflowId = asString(required(run, "workflow_id", context), `${context}.workflow_id`);
  const lineageId = asString(required(run, "lineage_id", context), `${context}.lineage_id`);
  asString(required(run, "ordering_scheme", context), `${context}.ordering_scheme`);
  asOneOf(required(run, "projection_normalization", context), ["workflow-projection/v1"] as const, `${context}.projection_normalization`);
  if (Object.hasOwn(run, "counterexample_path")) {
    for (const [index, item] of asArray(run["counterexample_path"], `${context}.counterexample_path`).entries()) {
      asInteger(item, `${context}.counterexample_path[${index}]`);
    }
  }
  if (Object.hasOwn(run, "input_hash")) assertHash(run["input_hash"], `${context}.input_hash`);
  return { lineageId, workflowId };
}

function assertOpPayload(value: unknown, context: string) {
  const payload = asRecord(value, context);
  assertJsonValue(payload, context);
  const op = asOneOf(required(payload, "op", context), FROZEN_OPS, `${context}.op`);
  const opId = asOpId(required(payload, "op_id", context), `${context}.op_id`);
  const actor = asString(required(payload, "actor", context), `${context}.actor`);
  const baseVersion = asInteger(required(payload, "base_version", context), `${context}.base_version`);
  const stamp = assertStamp(required(payload, "stamp", context), `${context}.stamp`);
  if (stamp[1] !== actor) invalid(`${context}.stamp`, "does not preserve semantic identity");

  function assertWorkflowInsertion(): void {
    const workflow = asRecord(required(payload, "workflow", context), `${context}.workflow`);
    asArray(required(workflow, "nodes", `${context}.workflow`), `${context}.workflow.nodes`);
    if (Object.hasOwn(workflow, "links")) asArray(workflow["links"], `${context}.workflow.links`);
    if (Object.hasOwn(workflow, "definitions")) {
      const definitions = asRecord(workflow["definitions"], `${context}.workflow.definitions`);
      if (Object.hasOwn(definitions, "subgraphs")) {
        asArray(definitions["subgraphs"], `${context}.workflow.definitions.subgraphs`);
      }
    }
  }
  function assertNodeAddition(): void {
    const nodeId = asNodeId(required(payload, "node_id", context), `${context}.node_id`);
    const classType = asString(required(payload, "class_type", context), `${context}.class_type`);
    assertNumberArray(required(payload, "pos", context), `${context}.pos`);
    const node = asRecord(required(payload, "node", context), `${context}.node`);
    if (String(asNodeId(required(node, "id", `${context}.node`), `${context}.node.id`)) !== String(nodeId)) invalid(`${context}.node.id`, "does not match node_id");
    if (asString(required(node, "type", `${context}.node`), `${context}.node.type`) !== classType) invalid(`${context}.node.type`, "does not match class_type");
    assertOptionalString(payload, "node_incarnation", context);
  }
  function assertConnection(): void {
    asNodeId(required(payload, "link_id", context), `${context}.link_id`);
    asNodeId(required(payload, "from_node", context), `${context}.from_node`);
    asInteger(required(payload, "from_slot", context), `${context}.from_slot`);
    asNodeId(required(payload, "to_node", context), `${context}.to_node`);
    asString(required(payload, "link_type", context), `${context}.link_type`);
    assertOptionalString(payload, "node_incarnation", context);
    const growValue = payload["grow"];
    if (growValue === undefined || growValue === null) {
      asInteger(required(payload, "to_slot", context), `${context}.to_slot`);
    } else {
      if (payload["to_slot"] !== undefined && payload["to_slot"] !== null) invalid(`${context}.to_slot`, "must be absent for a grow connect");
      const grow = asRecord(growValue, `${context}.grow`);
      asString(required(grow, "name", `${context}.grow`), `${context}.grow.name`);
      asString(required(grow, "type", `${context}.grow`), `${context}.grow.type`);
      assertOptionalString(grow, "widget", `${context}.grow`);
      if (Object.hasOwn(grow, "promoted")) asBoolean(grow["promoted"], `${context}.grow.promoted`);
      if (Object.hasOwn(grow, "inputcount")) {
        const inputcount = asRecord(grow["inputcount"], `${context}.grow.inputcount`);
        asString(required(inputcount, "widget", `${context}.grow.inputcount`), `${context}.grow.inputcount.widget`);
        required(inputcount, "value", `${context}.grow.inputcount`);
      }
    }
  }
  function assertPromotedWidgetWrite(): void {
    const promoted = asRecord(payload["promoted"], `${context}.promoted`);
    const valueIndex = asInteger(required(promoted, "value_index", `${context}.promoted`), `${context}.promoted.value_index`);
    const hostValues = asArray(required(promoted, "host_widgets_values", `${context}.promoted`), `${context}.promoted.host_widgets_values`);
    if (hostValues.length <= valueIndex) invalid(`${context}.promoted.host_widgets_values`, "must cover value_index");
    if (Object.hasOwn(promoted, "instance_path")) assertNodeIdArray(promoted["instance_path"], `${context}.promoted.instance_path`);
  }
  function assertWidgetWrite(): void {
    asNodeId(required(payload, "node_id", context), `${context}.node_id`);
    asString(required(payload, "widget", context), `${context}.widget`);
    if (required(payload, "value", context) === undefined) invalid(`${context}.value`, "must be JSON-representable");
    assertOptionalString(payload, "node_incarnation", context);
    if (Object.hasOwn(payload, "warnings")) asArray(payload["warnings"], `${context}.warnings`);
    const path = payload["path"];
    if (path !== undefined && path !== null) {
      const segments = asArray(path, `${context}.path`);
      if (segments.length === 0) invalid(`${context}.path`, "must not be empty");
      for (const [index, segment] of segments.entries()) asString(segment, `${context}.path[${index}]`);
      asString(required(payload, "inner_widget", context), `${context}.inner_widget`);
      if (payload["promoted"] !== undefined && payload["promoted"] !== null) invalid(`${context}.promoted`, "must be absent for an interior write");
    } else if (payload["inner_widget"] !== undefined && payload["inner_widget"] !== null) {
      invalid(`${context}.inner_widget`, "requires a non-empty path");
    } else if (payload["promoted"] !== undefined && payload["promoted"] !== null) {
      assertPromotedWidgetWrite();
    }
  }

  switch (op) {
    case "insert_workflow": assertWorkflowInsertion(); break;
    case "add_node": assertNodeAddition(); break;
    case "connect": assertConnection(); break;
    case "set_widget": assertWidgetWrite(); break;
    case "disconnect":
      asNodeId(required(payload, "link_id", context), `${context}.link_id`);
      asNodeId(required(payload, "to_node", context), `${context}.to_node`);
      asInteger(required(payload, "to_slot", context), `${context}.to_slot`);
      break;
    case "set_node_field":
      asNodeId(required(payload, "node_id", context), `${context}.node_id`);
      {
        const field = asOneOf(required(payload, "field", context), WRITABLE_NODE_FIELDS, `${context}.field`);
        const fieldValue = required(payload, "value", context);
        if (fieldValue !== null) {
          if (field === "title") asString(fieldValue, `${context}.value`);
          else if (field === "mode") asInteger(fieldValue, `${context}.value`);
          else asBoolean(fieldValue, `${context}.value`);
        }
        assertOptionalString(payload, "node_incarnation", context);
      }
      break;
    case "delete_node":
      asNodeId(required(payload, "node_id", context), `${context}.node_id`);
      assertNodeIdArray(required(payload, "removed_links", context), `${context}.removed_links`);
      break;
    case "clear":
      assertNodeIdArray(required(payload, "removed_nodes", context), `${context}.removed_nodes`);
      break;
    case "define_subgraph":
      asString(required(payload, "subgraph_id", context), `${context}.subgraph_id`);
      asRecord(required(payload, "subgraph_definition", context), `${context}.subgraph_definition`);
      break;
    default:
      // Exhaustiveness guard (issue #21), matching `dispatch` in `applier.ts`:
      // `op` is narrowed from `FROZEN_OPS`, so with every kind enumerated above
      // it is `never` here. This arm replaced a terminal `else` that validated
      // every un-enumerated kind against `clear`'s payload shape — which broke
      // silently when `disconnect` joined `FROZEN_OPS` in #139, rejecting real
      // disconnect evidence for a missing `removed_nodes` while never checking
      // `link_id`, `to_node`, or `to_slot`. Fail-closed reads (KA-11) need the
      // next added kind to break compilation here, not to be mis-validated at
      // runtime as some other kind.
      assertNever(op, `${context}.op`);
  }

  return { actor, baseVersion, op, opId, payload, stamp };
}

function assertCausal(value: unknown, context: string): void {
  const causal = asRecord(value, context);
  const status = asOneOf(required(causal, "status", context), ["known", "partial", "unknown"] as const, `${context}.status`);
  const parents = asArray(required(causal, "parents", context), `${context}.parents`);
  if (status === "unknown" && parents.length !== 0) invalid(context, "claims unknown causality with parents");
  for (const [index, value] of parents.entries()) {
    const parentContext = `${context}.parents[${index}]`;
    const parent = asRecord(value, parentContext);
    asOpId(required(parent, "op_id", parentContext), `${parentContext}.op_id`);
    asOneOf(required(parent, "relation", parentContext), ["observed-before", "fixture-declared"] as const, `${parentContext}.relation`);
    asOneOf(required(parent, "evidence", parentContext), ["producer-observation", "vector-reference", "fixture"] as const, `${parentContext}.evidence`);
  }
}

function assertSemanticDiff(value: unknown, context: string): boolean {
  const diff = asRecord(value, context);
  let entries = 0;
  for (const key of ["nodes_added", "nodes_removed", "nodes_changed", "links_added", "links_removed", "links_changed"] as const) {
    const items = asArray(required(diff, key, context), `${context}.${key}`);
    entries += items.length;
    for (const [index, item] of items.entries()) asNodeId(item, `${context}.${key}[${index}]`);
  }
  return entries === 0;
}

function assertTargets(value: unknown, context: string): void {
  for (const [index, targetValue] of asArray(value, context).entries()) {
    const targetContext = `${context}[${index}]`;
    const target = asRecord(targetValue, targetContext);
    asOneOf(required(target, "kind", targetContext), ["conflict-register", "affected-path", "workflow"] as const, `${targetContext}.kind`);
    for (const [pathIndex, segment] of asArray(required(target, "path", targetContext), `${targetContext}.path`).entries()) {
      asNodeId(segment, `${targetContext}.path[${pathIndex}]`);
    }
    asOneOf(required(target, "role", targetContext), ["conflict", "effect", "scope"] as const, `${targetContext}.role`);
  }
}

function assertBatch(value: unknown, context: string): { batchId: string; index: number; size: number } {
  const batch = asRecord(value, context);
  const batchId = asString(required(batch, "batch_id", context), `${context}.batch_id`);
  const index = asInteger(required(batch, "index", context), `${context}.index`);
  const size = asInteger(required(batch, "size", context), `${context}.size`, 1);
  if (index >= size) invalid(`${context}.index`, "must be smaller than size");
  return { batchId, index, size };
}

function assertDecision(value: unknown, context: string) {
  const decision = asRecord(value, context);
  const kind = asOneOf(required(decision, "kind", context), DECISION_KINDS, `${context}.kind`);
  if (kind === "lww-comparison") {
    return { kind, losing: assertStampKey(required(decision, "losing_stamp", context), `${context}.losing_stamp`), winning: assertStampKey(required(decision, "winning_stamp", context), `${context}.winning_stamp`) };
  }
  if (kind === "dedupe") return { kind, originalOpId: asOpId(required(decision, "original_op_id", context), `${context}.original_op_id`) };
  if (kind === "rejection") {
    const failingIndex = required(decision, "failing_index", context);
    return {
      code: asString(required(decision, "code", context), `${context}.code`),
      failingIndex: failingIndex === null ? null : asInteger(failingIndex, `${context}.failing_index`),
      kind,
      message: asString(required(decision, "message", context), `${context}.message`),
    };
  }
  return { kind };
}

function assertObservedFrontier(value: unknown, context: string): void {
  const frontier = asRecord(value, context);
  for (const [actor, counter] of Object.entries(frontier)) {
    asString(actor, `${context} actor`);
    asInteger(counter, `${context}.${actor}`);
  }
}

function assertSemanticStep(step: UnknownRecord, context: string): ValidatedSemanticStep {
  const actor = asString(required(step, "actor", context), `${context}.actor`);
  const opId = asOpId(required(step, "op_id", context), `${context}.op_id`);
  const stamp = assertStamp(required(step, "stamp", context), `${context}.stamp`);
  if (stamp[1] !== actor) invalid(`${context}.stamp`, "does not preserve semantic identity");
  const baseVersion = asInteger(required(step, "base_version", context), `${context}.base_version`);
  assertCausal(required(step, "causal", context), `${context}.causal`);
  if (Object.hasOwn(step, "observed_frontier")) assertObservedFrontier(step["observed_frontier"], `${context}.observed_frontier`);
  const verb = asOneOf(required(step, "verb", context), FROZEN_OPS, `${context}.verb`);
  const payload = assertOpPayload(required(step, "payload", context), `${context}.payload`);
  if (payload.opId !== opId || payload.actor !== actor || payload.baseVersion !== baseVersion || payload.op !== verb || payload.stamp[0] !== stamp[0] || payload.stamp[1] !== stamp[1]) {
    invalid(context, "does not preserve semantic identity across the step and payload");
  }
  const beforeHash = assertHashWithEncoding(required(step, "before_projection_hash", context), `${context}.before_projection_hash`, "canonical-json-v1");
  const afterHash = assertHashWithEncoding(required(step, "after_projection_hash", context), `${context}.after_projection_hash`, "canonical-json-v1");
  const emptyDiff = assertSemanticDiff(required(step, "semantic_diff", context), `${context}.semantic_diff`);
  const outcome = asOneOf(required(step, "outcome", context), OUTCOMES, `${context}.outcome`);
  const reasonCode = asString(required(step, "reason_code", context), `${context}.reason_code`);
  const processed = asBoolean(required(step, "processed", context), `${context}.processed`);
  const consumed = asBoolean(required(step, "consumed_op_id", context), `${context}.consumed_op_id`);
  assertTargets(required(step, "targets", context), `${context}.targets`);
  const decision = assertDecision(required(step, "decision_evidence", context), `${context}.decision_evidence`);
  const batch = Object.hasOwn(step, "batch") ? assertBatch(step["batch"], `${context}.batch`) : undefined;

  function assertAppliedOutcome(): void {
    if (reasonCode !== outcome) invalid(`${context}.reason_code`, "must match outcome");
    if (!processed || !consumed) invalid(`${context}.consumed_op_id`, "must be true for an applied outcome");
    if (decision.kind !== "none") invalid(`${context}.decision_evidence`, "must be none for an applied outcome");
  }
  function assertNoOpOutcome(): void {
    if (reasonCode !== outcome) invalid(`${context}.reason_code`, "must match outcome");
    if (!processed || !consumed) invalid(`${context}.consumed_op_id`, "must be true for a no-op outcome");
    if (decision.kind !== "none" && (decision.kind !== "dedupe" || decision.originalOpId !== opId)) {
      invalid(`${context}.decision_evidence`, "must be none or identify the deduplicated op_id");
    }
    if (!emptyDiff || !hashesMatch(beforeHash, afterHash)) invalid(`${context}.semantic_diff`, "must be empty for a no-op outcome");
  }
  function assertDroppedOutcome(): void {
    if (reasonCode !== outcome) invalid(`${context}.reason_code`, "must match outcome");
    if (!processed || !consumed) invalid(`${context}.consumed_op_id`, "must be true for an LWW-dropped outcome");
    if (decision.kind !== "lww-comparison" || decision.losing[0] !== stamp[0] || decision.losing[1] !== stamp[1] || decision.losing[2] !== opId) {
      invalid(`${context}.decision_evidence`, "must preserve the incoming losing stamp");
    }
    if (compareStampKeys(decision.winning, decision.losing) <= 0) {
      invalid(`${context}.decision_evidence.winning_stamp`, "must outrank the losing stamp");
    }
    if (!emptyDiff || !hashesMatch(beforeHash, afterHash)) invalid(`${context}.semantic_diff`, "must be empty for an LWW-dropped outcome");
  }
  function assertRejectedOutcome(): void {
    if (consumed) invalid(`${context}.consumed_op_id`, "must be false for a rejected outcome");
    if (decision.kind !== "rejection" || decision.code !== reasonCode) invalid(`${context}.decision_evidence`, "must match the rejection reason_code");
    if (!emptyDiff || !hashesMatch(beforeHash, afterHash)) invalid(`${context}.semantic_diff`, "must be empty for a rejected outcome");
    const aborted = reasonCode === "batch_aborted";
    if (aborted && processed) invalid(`${context}.processed`, "must be false for an aborted remainder");
    if (!aborted && !processed && (batch === undefined || decision.failingIndex !== null)) {
      invalid(`${context}.decision_evidence.failing_index`, "must be null for a batch preflight refusal");
    }
    const expectedFailureIndex = aborted
      ? decision.kind === "rejection" && batch !== undefined && decision.failingIndex !== null && decision.failingIndex < batch.index
      : !processed || (decision.kind === "rejection" && decision.failingIndex === (batch?.index ?? 0));
    if (!expectedFailureIndex) invalid(`${context}.decision_evidence.failing_index`, "does not identify the rejected operation");
  }

  switch (outcome) {
    case "applied": assertAppliedOutcome(); break;
    case "no-op": assertNoOpOutcome(); break;
    case "lww-dropped": assertDroppedOutcome(); break;
    case "rejected": assertRejectedOutcome(); break;
    default: assertNever(outcome, context);
  }

  return {
    afterHash,
    batchStep: batch === undefined
      ? undefined
      : {
          context,
          batchId: batch.batchId,
          index: batch.index,
          size: batch.size,
          outcome,
          reasonCode,
          processed,
          failingIndex: decision.kind === "rejection" ? decision.failingIndex : undefined,
        },
    beforeHash,
  };
}

function assertAbortedSuffix(members: ValidatedBatchStep[], failure: ValidatedBatchStep): void {
  for (const step of members) {
    if (step.index < failure.index && step.outcome === "rejected") invalid(`${step.context}.batch`, "contains a rejection before failing_index");
    if (step.index === failure.index && step !== failure) invalid(`${step.context}.batch`, "does not identify the processed rejection");
    if (step.index > failure.index && (step.outcome !== "rejected" || step.processed || step.reasonCode !== "batch_aborted" || step.failingIndex !== failure.index)) {
      invalid(`${step.context}.batch`, "must form a contiguous aborted suffix after failing_index");
    }
  }
}

function indexBatchSteps(steps: readonly ValidatedBatchStep[]) {
  const batches = new Map<string, { size: number; steps: Map<number, ValidatedBatchStep> }>();
  for (const step of steps) {
    const existing = batches.get(step.batchId);
    if (existing !== undefined && existing.size !== step.size) invalid(`${step.context}.batch.size`, `must match batch '${step.batchId}' size ${existing.size}`);
    const batch = existing ?? { size: step.size, steps: new Map<number, ValidatedBatchStep>() };
    if (batch.steps.has(step.index)) invalid(`${step.context}.batch.index`, `duplicates index ${step.index} in batch '${step.batchId}'`);
    batch.steps.set(step.index, step);
    batches.set(step.batchId, batch);
  }
  return batches;
}

function assertBatchSequences(steps: readonly ValidatedBatchStep[]): void {
  const batches = indexBatchSteps(steps);
  for (const [batchId, batch] of batches) {
    if (batch.steps.size !== batch.size) invalid(`batch '${batchId}'`, `must include all ${batch.size} members under one batch_id`);
    const ordered = Array.from({ length: batch.size }, (_, index) => batch.steps.get(index));
    if (ordered.some((step) => step === undefined)) invalid(`batch '${batchId}'`, "must use contiguous indexes");
    const members = ordered as ValidatedBatchStep[];
    const rejected = members.filter((step) => step.outcome === "rejected");
    if (rejected.length === 0) continue;

    const preflight = rejected.length === members.length
      && rejected.every((step) => !step.processed && step.reasonCode !== "batch_aborted" && step.failingIndex === null);
    if (preflight) continue;

    const failures = rejected.filter((step) => step.processed && step.reasonCode !== "batch_aborted");
    if (failures.length !== 1) invalid(`batch '${batchId}'`, "must contain exactly one processed rejection");
    const failure = failures[0]!;
    assertAbortedSuffix(members, failure);
  }
}

function assertDiagnostic(value: unknown, context: string): void {
  const diagnostic = asRecord(value, context);
  asOneOf(required(diagnostic, "direction", context), ["host-to-follower"] as const, `${context}.direction`);
  asInteger(required(diagnostic, "byte_length", context), `${context}.byte_length`);
  assertHashWithEncoding(required(diagnostic, "hash", context), `${context}.hash`, "binary");
  assertOptionalString(diagnostic, "attachment_ref", context);
}

function assertLifecycleBase(step: UnknownRecord, context: string, workflowId: string) {
  if (asString(required(step, "workflow_id", context), `${context}.workflow_id`) !== workflowId) invalid(`${context}.workflow_id`, "does not match run metadata");
  const beforeLineage = asString(required(step, "before_lineage_id", context), `${context}.before_lineage_id`);
  const afterLineage = asString(required(step, "after_lineage_id", context), `${context}.after_lineage_id`);
  const beforeDoc = asString(required(step, "before_doc_id", context), `${context}.before_doc_id`);
  const afterDoc = asString(required(step, "after_doc_id", context), `${context}.after_doc_id`);
  const beforeStateVectorHash = assertHashWithEncoding(required(step, "before_state_vector_hash", context), `${context}.before_state_vector_hash`, "yjs-state-vector");
  const afterStateVectorHash = assertHashWithEncoding(required(step, "after_state_vector_hash", context), `${context}.after_state_vector_hash`, "yjs-state-vector");
  if (Object.hasOwn(step, "diagnostic")) assertDiagnostic(step["diagnostic"], `${context}.diagnostic`);
  return { afterDoc, afterLineage, afterStateVectorHash, beforeDoc, beforeLineage, beforeStateVectorHash };
}

function assertLifecycleTransition(step: UnknownRecord, context: string, kind: "state-vector-replay" | "doc-reset", lifecycle: ReturnType<typeof assertLifecycleBase>): void {
  if (kind === "state-vector-replay") {
    if (!asBoolean(required(step, "same_document", context), `${context}.same_document`) || lifecycle.beforeDoc !== lifecycle.afterDoc || lifecycle.beforeLineage !== lifecycle.afterLineage) {
      invalid(context, "violates same-document replay");
    }
    asOneOf(required(step, "reason", context), ["seq-gap", "reconnect"] as const, `${context}.reason`);
    assertOptionalInteger(step, "requested_from_seq", context);
    assertOptionalInteger(step, "resumed_at_seq", context);
  } else {
    if (asBoolean(required(step, "same_document", context), `${context}.same_document`) || lifecycle.beforeDoc === lifecycle.afterDoc || lifecycle.beforeLineage === lifecycle.afterLineage) {
      invalid(context, "does not describe a lineage replacement");
    }
    asInteger(required(step, "reset_seq", context), `${context}.reset_seq`);
    if (!asBoolean(required(step, "projectors_notified_before_replace", context), `${context}.projectors_notified_before_replace`)) {
      invalid(`${context}.projectors_notified_before_replace`, "must be true before document replacement");
    }
  }
}

/** Fail closed at the schema-major boundary before a viewer reads a trace. */
export function assertCollabReplayTraceV1(value: unknown): asserts value is CollabReplayTraceV1 {
  const trace = asRecord(value, "collaboration trace");
  if (required(trace, "schema", "collaboration trace") !== COLLAB_TRACE_SCHEMA) {
    throw new TypeError(`unsupported collaboration trace schema: ${String(trace["schema"])}`);
  }
  const run = assertRun(required(trace, "run", "collaboration trace"), "collaboration trace.run");
  const steps = asArray(required(trace, "steps", "collaboration trace"), "collaboration trace.steps");
  const stepIds = new Set<string>();
  const batchSteps: ValidatedBatchStep[] = [];
  let currentLineage = run.lineageId;
  let currentDoc: string | undefined;
  let previousLifecycleAfterStateVectorHash: TraceHash | undefined;
  let previousSemanticAfterProjectionHash: TraceHash | undefined;

  function assertTraceStep(value: unknown, index: number): void {
    const context = `trace step ${index}`;
    const step = asRecord(value, context);
    const stepId = asString(required(step, "step_id", context), `${context}.step_id`);
    if (stepIds.has(stepId)) invalid(`${context}.step_id`, `duplicates '${stepId}'`);
    stepIds.add(stepId);
    const arrivalIndex = asInteger(required(step, "arrival_index", context), `${context}.arrival_index`);
    if (arrivalIndex !== index) invalid(`${context}.arrival_index`, `must be ${index}`);
    const kind = asOneOf(required(step, "kind", context), STEP_KINDS, `${context}.kind`);

    if (kind === "semantic-op") {
      const semantic = assertSemanticStep(step, context);
      if (previousSemanticAfterProjectionHash !== undefined && !hashesMatch(previousSemanticAfterProjectionHash, semantic.beforeHash)) {
        invalid(`${context}.before_projection_hash`, "violates projection continuity");
      }
      if (semantic.batchStep !== undefined) batchSteps.push(semantic.batchStep);
      previousLifecycleAfterStateVectorHash = undefined;
      previousSemanticAfterProjectionHash = semantic.afterHash;
      return;
    }

    previousSemanticAfterProjectionHash = undefined;
    const lifecycle = assertLifecycleBase(step, context, run.workflowId);
    if (lifecycle.beforeLineage !== currentLineage) invalid(`${context}.before_lineage_id`, "violates lifecycle ordering");
    if (currentDoc !== undefined && lifecycle.beforeDoc !== currentDoc) invalid(`${context}.before_doc_id`, "violates lifecycle ordering");
    if (previousLifecycleAfterStateVectorHash !== undefined && !hashesMatch(previousLifecycleAfterStateVectorHash, lifecycle.beforeStateVectorHash)) {
      invalid(`${context}.before_state_vector_hash`, "violates state-vector continuity");
    }
    assertLifecycleTransition(step, context, kind, lifecycle);
    currentLineage = lifecycle.afterLineage;
    currentDoc = lifecycle.afterDoc;
    previousLifecycleAfterStateVectorHash = lifecycle.afterStateVectorHash;
  }

  for (const [index, value] of steps.entries()) assertTraceStep(value, index);
  assertBatchSequences(batchSteps);

  const assertions = asRecord(required(trace, "assertions", "collaboration trace"), "collaboration trace.assertions");
  const converged = asBoolean(required(assertions, "converged", "collaboration trace.assertions"), "collaboration trace.assertions.converged");
  const finalProjectionHash = assertHashWithEncoding(required(assertions, "final_projection_hash", "collaboration trace.assertions"), "collaboration trace.assertions.final_projection_hash", "canonical-json-v1");
  if (previousSemanticAfterProjectionHash !== undefined && !hashesMatch(previousSemanticAfterProjectionHash, finalProjectionHash)) {
    invalid("collaboration trace.assertions.final_projection_hash", "must match the terminal semantic step");
  }
  assertHashWithEncoding(required(assertions, "final_applied_op_ids_hash", "collaboration trace.assertions"), "collaboration trace.assertions.final_applied_op_ids_hash", "canonical-json-v1");
  const failure = required(assertions, "failure_step_id", "collaboration trace.assertions");
  if (failure !== null && (typeof failure !== "string" || !stepIds.has(failure))) invalid("collaboration trace.assertions.failure_step_id", "must reference an existing step_id or be null");
  if (converged !== (failure === null)) invalid("collaboration trace.assertions.converged", "does not agree with failure_step_id");
}
