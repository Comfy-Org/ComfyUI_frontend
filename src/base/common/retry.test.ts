import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  calculateDelayWithJitter,
  retryWithBackoff,
  RetryAbortedError,
  RetriesExhaustedError,
  DEFAULT_RETRY_OPTIONS,
} from "./retry";

describe("retry utility", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("calculateDelayWithJitter", () => {
    it("calculates pure exponential backoff without jitter", () => {
      expect(calculateDelayWithJitter(0, 1000, 30000, false)).toBe(1000);
      expect(calculateDelayWithJitter(1, 1000, 30000, false)).toBe(2000);
      expect(calculateDelayWithJitter(2, 1000, 30000, false)).toBe(4000);
      expect(calculateDelayWithJitter(3, 1000, 30000, false)).toBe(8000);
    });

    it("caps delay at maxDelayMs", () => {
      expect(calculateDelayWithJitter(10, 1000, 30000, false)).toBe(30000);
      expect(calculateDelayWithJitter(5, 1000, 5000, false)).toBe(5000);
    });

    it("applies full jitter (delay between 0 and exponential)", () => {
      const delays: number[] = [];
      for (let i = 0; i < 100; i++) {
        delays.push(calculateDelayWithJitter(2, 1000, 30000, "full"));
      }

      // All delays should be between 0 and 4000 (1000 * 2^2)
      expect(delays.every((d) => d >= 0 && d <= 4000)).toBe(true);
      // Should have some variance (not all the same)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it("applies decorrelated jitter based on previous delay", () => {
      const delays: number[] = [];
      for (let i = 0; i < 100; i++) {
        delays.push(
          calculateDelayWithJitter(2, 1000, 30000, "decorrelated", 2000),
        );
      }

      // Delays should be between baseDelayMs (1000) and 3 * previousDelay (6000)
      expect(delays.every((d) => d >= 1000 && d <= 6000)).toBe(true);
    });

    it("treats true as full jitter", () => {
      const delays: number[] = [];
      for (let i = 0; i < 50; i++) {
        delays.push(calculateDelayWithJitter(1, 1000, 30000, true));
      }
      // Should be between 0 and 2000
      expect(delays.every((d) => d >= 0 && d <= 2000)).toBe(true);
    });
  });

  describe("retryWithBackoff", () => {
    it("returns immediately on success", async () => {
      const fn = vi.fn().mockResolvedValue("success");

      const result = await retryWithBackoff(fn, { maxRetries: 3 });

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("retries on failure up to maxRetries", async () => {
      const error = new Error("fail");
      const fn = vi.fn().mockRejectedValue(error);

      const promise = retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelayMs: 100,
        jitter: false,
      });

      // First attempt fails immediately
      await vi.advanceTimersByTimeAsync(0);
      // Wait for delay after first failure (100ms)
      await vi.advanceTimersByTimeAsync(100);
      // Wait for delay after second failure (200ms)
      await vi.advanceTimersByTimeAsync(200);

      await expect(promise).rejects.toBeInstanceOf(RetriesExhaustedError);
      expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
    });

    it("succeeds on retry after initial failures", async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");

      const promise = retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 100,
        jitter: false,
      });

      await vi.advanceTimersByTimeAsync(100); // after 1st failure
      await vi.advanceTimersByTimeAsync(200); // after 2nd failure

      const result = await promise;

      expect(result).toBe("success");
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it("calls onRetry callback before each retry", async () => {
      const error = new Error("fail");
      const fn = vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockResolvedValue("success");

      const onRetry = vi.fn();

      const promise = retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 100,
        jitter: false,
        onRetry,
      });

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, error, 1, 100);
      expect(onRetry).toHaveBeenNthCalledWith(2, error, 2, 200);
    });

    it("calls onExhausted when all retries fail", async () => {
      const error = new Error("persistent failure");
      const fn = vi.fn().mockRejectedValue(error);
      const onExhausted = vi.fn();

      const promise = retryWithBackoff(fn, {
        maxRetries: 2,
        baseDelayMs: 100,
        jitter: false,
        onExhausted,
      });

      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(200);

      await expect(promise).rejects.toBeInstanceOf(RetriesExhaustedError);
      expect(onExhausted).toHaveBeenCalledWith(error, 3);
    });

    it("stops retrying when shouldRetry returns false", async () => {
      const transientError = new Error("transient");
      const permanentError = new Error("permanent");

      const fn = vi
        .fn()
        .mockRejectedValueOnce(transientError)
        .mockRejectedValueOnce(permanentError);

      const shouldRetry = vi.fn((err: unknown) => {
        return err instanceof Error && err.message !== "permanent";
      });

      const promise = retryWithBackoff(fn, {
        maxRetries: 5,
        baseDelayMs: 100,
        jitter: false,
        shouldRetry,
      });

      await vi.advanceTimersByTimeAsync(100);

      // Should throw the permanent error directly (not wrapped)
      await expect(promise).rejects.toThrow("permanent");
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it("aborts immediately when signal is already aborted", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const controller = new AbortController();
      controller.abort();

      await expect(
        retryWithBackoff(fn, { signal: controller.signal }),
      ).rejects.toBeInstanceOf(RetryAbortedError);

      expect(fn).not.toHaveBeenCalled();
    });

    it("aborts during delay when signal is aborted", async () => {
      const fn = vi.fn().mockRejectedValue(new Error("fail"));
      const controller = new AbortController();

      const promise = retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 1000,
        jitter: false,
        signal: controller.signal,
      });

      // Let first attempt fail
      await vi.advanceTimersByTimeAsync(0);

      // Abort during delay
      controller.abort();
      await vi.advanceTimersByTimeAsync(100);

      await expect(promise).rejects.toBeInstanceOf(RetryAbortedError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("uses default options when none provided", async () => {
      const fn = vi.fn().mockResolvedValue("success");
      const result = await retryWithBackoff(fn);

      expect(result).toBe("success");
    });

    it("handles zero maxRetries (single attempt)", async () => {
      const error = new Error("fail");
      const fn = vi.fn().mockRejectedValue(error);

      const promise = retryWithBackoff(fn, { maxRetries: 0 });

      await expect(promise).rejects.toBeInstanceOf(RetriesExhaustedError);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("preserves error type in RetriesExhaustedError", async () => {
      class CustomError extends Error {
        code = "CUSTOM";
      }
      const error = new CustomError("custom failure");
      const fn = vi.fn().mockRejectedValue(error);

      const promise = retryWithBackoff(fn, {
        maxRetries: 0,
        jitter: false,
      });

      try {
        await promise;
      } catch (e) {
        expect(e).toBeInstanceOf(RetriesExhaustedError);
        const exhaustedError = e as RetriesExhaustedError;
        expect(exhaustedError.lastError).toBe(error);
        expect(exhaustedError.attempts).toBe(1);
      }
    });
  });

  describe("DEFAULT_RETRY_OPTIONS", () => {
    it("has sensible defaults", () => {
      expect(DEFAULT_RETRY_OPTIONS.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_OPTIONS.baseDelayMs).toBe(1000);
      expect(DEFAULT_RETRY_OPTIONS.maxDelayMs).toBe(30_000);
      expect(DEFAULT_RETRY_OPTIONS.jitter).toBe("full");
    });
  });
});
