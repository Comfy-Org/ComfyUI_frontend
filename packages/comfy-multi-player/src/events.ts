/** Version of the language-agnostic host event envelope. */
export const CMP_EVENT_SCHEMA_VERSION = 1 as const;

/**
 * Known v1 event names. The wire field remains open so decoders can preserve
 * forward compatibility with later additive v1 names.
 */
export type CmpEventType =
  | "applier_error"
  | "op_rejected"
  | "op_conflict"
  | "clock_anomaly"
  | "migration"
  | "limit_violation"
  | "schema_mismatch"
  | (string & {});

/** Plain, JSON-safe event contract shared by browser and Node importers. */
export interface CmpEvent {
  readonly schema_version: typeof CMP_EVENT_SCHEMA_VERSION;
  readonly type: CmpEventType;
  readonly source: "applyOps" | "clock" | "migrate" | "project" | "read";
  readonly code: string;
  readonly message: string;
  readonly error_name?: string;
  readonly op_id?: string;
  readonly batch_index?: number;
}

/** A synchronous, best-effort observer owned by the caller. */
export type CmpEventSink = (event: CmpEvent) => undefined;

/** Optional caller-owned context for a single package entry-point call. */
export interface CmpCallContext {
  readonly eventSink?: CmpEventSink;
}

/**
 * Invoke a sink without allowing observer failure to affect package semantics.
 * Callers must branch on sink presence before constructing an event so the
 * default path allocates nothing for telemetry.
 */
export function emitCmpEvent(sink: CmpEventSink, event: CmpEvent): void {
  try {
    sink(event);
  } catch {
    // Observability is best-effort. Sink failure never enters semantic flow.
  }
}
