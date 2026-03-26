"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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
 * Relayer status hook using @satsu/sdk RelayerClient.
 *
 * Polls the relayer's /api/v1/status endpoint every 30 seconds.
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

  // Lazy-load the SDK RelayerClient to avoid SSR issues
  const clientRef = useRef<{ getStatus: () => Promise<{ pendingDeposits: number; pendingWithdrawals: number; currentFee: bigint }>; getHealth: () => Promise<boolean> } | null>(null);

  const getClient = useCallback(async () => {
    if (clientRef.current) return clientRef.current;
    try {
      const { RelayerClient } = await import("@satsu/sdk");
      clientRef.current = new RelayerClient(RELAYER_URL);
      return clientRef.current;
    } catch {
      // SDK import failed — fall back to raw fetch
      return null;
    }
  }, []);

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    const start = Date.now();

    try {
      const client = await getClient();

      if (client) {
        // Use SDK RelayerClient
        const result = await client.getStatus();
        setStatus({
          url: RELAYER_URL,
          isOnline: true,
          latency: Date.now() - start,
          lastChecked: new Date().toISOString(),
          queueDepth: result.pendingDeposits + result.pendingWithdrawals,
        });
      } else {
        // Fallback: raw fetch
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
            queueDepth: (data.pendingDeposits ?? 0) + (data.pendingWithdrawals ?? 0),
          });
        } else {
          throw new Error("Non-OK response");
        }
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
  }, [getClient]);

  // Auto-check on mount and every 30 seconds
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  return { status, checkStatus, isChecking };
}
