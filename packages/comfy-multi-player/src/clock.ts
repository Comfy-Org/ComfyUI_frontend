import type { Actor } from "./types.js";

export const MAX_LAMPORT_COUNTER = Number.MAX_SAFE_INTEGER;

export interface LamportProducerClock {
  workflow_id: string;
  lineage_id: string;
  producer_id: string;
  counter: number;
}

export interface LamportClockStore {
  /** Serialize the callback for this exact producer identity and commit on success. */
  transaction<T>(
    identity: Omit<LamportProducerClock, "counter">,
    update: (stored: number | undefined) => Promise<{ counter: number; value: T }>,
  ): Promise<T>;
}

export function validateLamportCounter(value: unknown, allowZero = false): number {
  if (!Number.isSafeInteger(value) || (value as number) < (allowZero ? 0 : 1)) {
    throw new RangeError(
      `Lamport counter must be a ${allowZero ? "non-negative" : "positive"} safe integer`,
    );
  }
  return value as number;
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
