import * as Y from "yjs";
import { ROOT_STAMPS } from "./doc.js";
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
 * winning stamp ledger on every transaction. The package keeps no producer
 * counter: the Y.Doc is the caller-owned lineage snapshot and this store's
 * transaction queue is the serialization boundary.
 *
 * Stamp values are validated rather than silently skipped. A malformed
 * `__stamps` entry must fail closed before a producer mints an unsafe counter.
 * Incarnation-qualified target keys all belong to this document lineage, so
 * old node lives remain part of the observed floor (DQ-11 / ADR-021). A
 * successful transaction reserves its counter in the same ledger so the next
 * transaction observes it even before the producer's semantic op is applied.
 */
export class DocDerivedLamportClockStore implements LamportClockStore {
  public constructor(private readonly doc: Y.Doc) {}

  public async transaction<T>(
    identity: Omit<LamportProducerClock, "counter">,
    update: (stored: number | undefined) => Promise<{ counter: number; value: T }>,
  ): Promise<T> {
    const transaction = (documentTransactionTails.get(this.doc) ?? Promise.resolve()).then(async () => {
      const floor = observedDocCounter(this.doc);
      const result = await update(floor);
      validateLamportCounter(result.counter);
      if (floor !== undefined && result.counter <= floor) {
        throw new RangeError(`Lamport counter ${result.counter} did not advance beyond document floor ${floor}`);
      }
      this.commitCounter(identity, result.counter);
      return result.value;
    });
    documentTransactionTails.set(this.doc, transaction.then(() => undefined, () => undefined));
    return transaction;
  }

  private commitCounter(identity: Omit<LamportProducerClock, "counter">, counter: number): void {
    const reservationKey = JSON.stringify([
      "__lamport_clock",
      identity.workflow_id,
      identity.lineage_id,
      identity.producer_id,
    ]);
    const stamps = this.doc.getMap<unknown>(ROOT_STAMPS);
    this.doc.transact(() => stamps.set(reservationKey, [counter, identity.producer_id, reservationKey]));
  }
}

/** Return the maximum valid counter in the document's `__stamps` ledger. */
export function observedDocCounter(doc: Y.Doc): number | undefined {
  const root = doc.share.get(ROOT_STAMPS);
  if (root === undefined) return undefined;
  if (!(root instanceof Y.Map)) throw new TypeError("__stamps root is not a Y.Map");

  let maximum: number | undefined;
  root.forEach((value) => {
    if (!Array.isArray(value) || value.length < 3 || typeof value[1] !== "string" || typeof value[2] !== "string") {
      throw new TypeError("__stamps contains a malformed stamp");
    }
    const counter = validateLamportCounter(value[0], true);
    maximum = maximum === undefined ? counter : Math.max(maximum, counter);
  });
  return maximum;
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
