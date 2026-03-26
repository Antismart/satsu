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

const DEFAULT_RELAYER_URL =
  process.env.NEXT_PUBLIC_RELAYER_URL ?? "http://localhost:3001";

/**
 * Relayer status and submission hook.
 *
 * Once the relayer service is live this will use the @satsu/sdk RelayerClient.
 * For now it provides placeholder status for the UI.
 */
export function useRelayer(): RelayerHook {
  const [isChecking, setIsChecking] = useState(false);
  const [status, setStatus] = useState<RelayerStatus>({
    url: DEFAULT_RELAYER_URL,
    isOnline: false,
    latency: null,
    lastChecked: null,
    queueDepth: 0,
  });

  const checkStatus = useCallback(async () => {
    setIsChecking(true);
    const start = Date.now();

    try {
      // TODO: integrate with @satsu/sdk RelayerClient.status()
      const res = await fetch(`${DEFAULT_RELAYER_URL}/status`, {
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        setStatus({
          url: DEFAULT_RELAYER_URL,
          isOnline: true,
          latency: Date.now() - start,
          lastChecked: new Date().toISOString(),
          queueDepth: data.queueDepth ?? 0,
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
