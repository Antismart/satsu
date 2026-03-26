"use client";

import { useState, useEffect, useCallback } from "react";

interface RelayerStatus {
  url: string;
  isOnline: boolean;
  latency: number | null;
  lastChecked: string | null;
  queueDepth: number;
}

interface RelayerHook {
  status: RelayerStatus;
  checkStatus: () => Promise<void>;
  isChecking: boolean;
}

const RELAYER_URL =
  process.env.NEXT_PUBLIC_RELAYER_URL ?? "http://localhost:3100";

/**
 * Relayer status hook.
 *
 * Polls the relayer /api/v1/status endpoint every 30 seconds.
 * When the relayer is unreachable the status reflects offline.
 */
export function useRelayer(): RelayerHook {
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<RelayerStatus>({
    url: RELAYER_URL,
    isOnline: false,
    latency: null,
    lastChecked: null,
    queueDepth: 0,
  });

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    const start = Date.now();

    try {
      const res = await fetch(`${RELAYER_URL}/api/v1/status`, {
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        setStatus({
          url: RELAYER_URL,
          isOnline: true,
          latency: Date.now() - start,
          lastChecked: new Date().toISOString(),
          queueDepth:
            (data.pendingDeposits ?? 0) + (data.pendingWithdrawals ?? 0),
        });
      } else {
        throw new Error("Non-OK response");
      }
    } catch {
      setStatus((s) => ({
        ...s,
        isOnline: false,
        latency: null,
        lastChecked: new Date().toISOString(),
      }));
    } finally {
      setIsChecking(false);
    }
  }, []);

  // Auto-check on mount and every 30 seconds
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return { status, checkStatus, isChecking };
}
