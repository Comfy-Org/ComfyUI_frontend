import * as Y from "yjs";
import { ROOT_CLOCK_RESERVATIONS, ROOT_STAMPS } from "./doc.js";
import { assertReadableSchema } from "./schema-version.js";
import type { Actor } from "./types.js";

export const MAX_LAMPORT_COUNTER = Number.MAX_SAFE_INTEGER;

export interface LamportProducerClock {
  workflow_id: string;
  lineage_id: string;
  producer_id: string;
  counter: number;
}

export interface LamportClockStore {
  /** Serialize the callback for this document admission scope and commit on success. */
  transaction<T>(
    identity: Omit<LamportProducerClock, "counter">,
    update: (stored: number | undefined) => Promise<{ counter: number; value: T }>,
  ): Promise<T>;
}

/** All stores wrapping one document share its admission serialization boundary. */
const documentTransactionTails = new WeakMap<Y.Doc, Promise<void>>();

/**
 * A caller-owned Lamport store whose floor is derived from this document's
 * winning stamps and reservations on every transaction. The package keeps no producer
 * counter: the Y.Doc is the caller-owned lineage snapshot and this store's
 * transaction queue is the serialization boundary.
 *
 * Both ledgers are validated rather than silently skipped. Malformed state
 * must fail closed before a producer mints an unsafe counter.
 * Incarnation-qualified target keys all belong to this document lineage, so
 * old node lives remain part of the observed floor (DQ-11 / ADR-021). A
 * successful transaction writes `__clock_reservations` so the next transaction
 * observes it even before the producer's semantic op is applied. `__stamps`
 * remains exclusively the semantic write-target ledger exposed by readStamps.
 */
export class DocDerivedLamportClockStore implements LamportClockStore {
  public constructor(private readonly doc: Y.Doc) {}

  public async transaction<T>(
    identity: Omit<LamportProducerClock, "counter">,
    update: (stored: number | undefined) => Promise<{ counter: number; value: T }>,
  ): Promise<T> {
    // Capture validated primitives before queueing or invoking caller code.
    const { workflow_id, lineage_id, producer_id } = identity;
    if (typeof workflow_id !== "string" || typeof lineage_id !== "string" || typeof producer_id !== "string") {
      throw new TypeError("Lamport reservation identity fields must be strings");
    }
    const reservationKey = JSON.stringify(["__lamport_clock", workflow_id, lineage_id, producer_id]);
    const transaction = (documentTransactionTails.get(this.doc) ?? Promise.resolve()).then(async () => {
      const floor = observedDocCounter(this.doc);
      const result = await update(floor);
      validateLamportCounter(result.counter);
      if (floor !== undefined && result.counter <= floor) {
        throw new RangeError(`Lamport counter ${result.counter} did not advance beyond document floor ${floor}`);
      }
      this.commitCounter(reservationKey, producer_id, result.counter);
      return result.value;
    });
    documentTransactionTails.set(this.doc, transaction.then(() => undefined, () => undefined));
    return transaction;
  }

  private commitCounter(reservationKey: string, producer: string, counter: number): void {
    const reservations = this.doc.getMap<unknown>(ROOT_CLOCK_RESERVATIONS);
    this.doc.transact(() => reservations.set(reservationKey, [counter, producer, reservationKey]));
  }
}

/**
 * Maximum counter across winning stamps and reservations in a current-schema
 * document. Missing ledgers are empty; missing/unsupported schema is refused.
 * Reads neither write structs nor create absent roots.
 */
export function observedDocCounter(doc: Y.Doc): number | undefined {
  assertReadableSchema(doc, "observedDocCounter");
  let maximum: number | undefined;
  for (const name of [ROOT_STAMPS, ROOT_CLOCK_RESERVATIONS]) {
    const root = doc.share.get(name);
    if (root === undefined) continue;
    // Snapshot roots arrive as AbstractType, not Y.Map. Type only an existing
    // root; reject sequence content before getMap can hide it in a map view.
    if (root._start !== null) throw new TypeError(`${name} root contains non-map content`);
    const ledger = doc.getMap<unknown>(name); // throws for a different concrete Y type
    ledger.forEach((value, key) => {
      if (!Array.isArray(value) || value.length !== 3 || typeof value[1] !== "string" ||
          typeof value[2] !== "string" || value[2].length === 0) {
        throw new TypeError(`${name} contains a malformed stamp tuple`);
      }
      if (name === ROOT_CLOCK_RESERVATIONS) validateReservation(key, value[1], value[2]);
      const counter = validateLamportCounter(value[0], name === ROOT_STAMPS);
      maximum = maximum === undefined ? counter : Math.max(maximum, counter);
    });
  }
  return maximum;
}

function validateReservation(key: string, producer: string, storedKey: string): void {
  const identity: unknown = JSON.parse(key);
  if (!Array.isArray(identity) || identity.length !== 4 || identity[0] !== "__lamport_clock" ||
      typeof identity[1] !== "string" || typeof identity[2] !== "string" ||
      identity[3] !== producer || storedKey !== key || JSON.stringify(identity) !== key) {
    throw new TypeError(`${ROOT_CLOCK_RESERVATIONS} contains a malformed reservation identity`);
  }
}

export function validateLamportCounter(value: unknown, allowZero = false): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < (allowZero ? 0 : 1)) {
    throw new RangeError(
      `Lamport counter must be a ${allowZero ? "non-negative" : "positive"} safe integer`,
    );
  }
  return value;
}

export function observeLamport(local: number, ...observed: number[]): number {
  let maximum = validateLamportCounter(local, true);
  for (const counter of observed) maximum = Math.max(maximum, validateLamportCounter(counter, true));
  return maximum;
}

export function tickLamport(...observed: number[]): number {
  const maximum = observeLamport(0, ...observed);
  if (maximum === MAX_LAMPORT_COUNTER) throw new RangeError("Lamport counter exhausted");
  return maximum + 1;
}

/** Persist-before-return producer tick. A caller dispatches only after this resolves. */
export async function persistLamportTick(
  store: LamportClockStore,
  identity: Omit<LamportProducerClock, "counter">,
  observed: readonly number[],
  options: { requireSeed?: boolean } = {},
): Promise<number> {
  return store.transaction(identity, async (stored) => {
    if (stored === undefined && options.requireSeed && observed.length === 0) {
      throw new Error("Lamport producer clock is unseeded; observe authoritative lineage state before minting");
    }
    const counter = tickLamport(stored ?? 0, ...observed);
    return { counter, value: counter };
  });
}

/** Pure helper for creating a frozen envelope after the durable tick succeeds. */
export function freezeLamportEnvelope<T extends object>(
  payload: T,
  actor: Actor,
  opId: string,
  counter: number,
): Readonly<T & { actor: Actor; op_id: string; base_version: number; stamp: readonly [number, Actor] }> {
  validateLamportCounter(counter);
  return Object.freeze({
    ...payload,
    actor,
    op_id: opId,
    base_version: counter,
    stamp: Object.freeze([counter, actor]) as readonly [number, Actor],
  });
}
