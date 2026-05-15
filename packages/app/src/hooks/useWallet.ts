"use client";

import { useState, useCallback, useEffect } from "react";
import {
  connect as stacksConnect,
  disconnect as stacksDisconnect,
  isConnected as stacksIsConnected,
  getLocalStorage,
  request as stacksRequest,
  type StacksProvider,
} from "@stacks/connect";

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  network: "mainnet" | "testnet";
  error: string | null;
}

interface WalletActions {
  connect: () => Promise<void>;
  disconnect: () => void;
  clearError: () => void;
}

const PRIMARY_TIMEOUT_MS = 30_000;
const FALLBACK_TIMEOUT_MS = 30_000;

type WindowProviders = Window & {
  wbip_providers?: Array<{ id: string; name?: string }>;
  webbtc_stx_providers?: Array<{ id: string; name?: string }>;
  LeatherProvider?: StacksProvider;
  XverseProviders?: { StacksProvider?: StacksProvider };
  StacksProvider?: StacksProvider;
  HiroWalletProvider?: StacksProvider;
};

function logRegisteredProviders() {
  if (typeof window === "undefined") return;
  const w = window as WindowProviders;
  const wbip = (w.wbip_providers ?? []).map((p) => p.id);
  const legacy = (w.webbtc_stx_providers ?? []).map((p) => p.id);
  const direct = {
    LeatherProvider: !!w.LeatherProvider,
    "XverseProviders.StacksProvider": !!w.XverseProviders?.StacksProvider,
    StacksProvider: !!w.StacksProvider,
    HiroWalletProvider: !!w.HiroWalletProvider,
  };
  console.log("[useWallet] wbip_providers:", wbip);
  console.log("[useWallet] webbtc_stx_providers:", legacy);
  console.log("[useWallet] direct providers:", direct);
}

function readStxAddress(): string | null {
  return getLocalStorage()?.addresses?.stx?.[0]?.address ?? null;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
        ms
      )
    ),
  ]);
}

export function useWallet(): WalletState & WalletActions {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    network: "testnet",
    error: null,
  });

  useEffect(() => {
    if (stacksIsConnected()) {
      const addr = readStxAddress();
      if (addr) {
        setState((s) => ({ ...s, address: addr, isConnected: true }));
      }
    }
  }, []);

  const connect = useCallback(async () => {
    if (stacksIsConnected()) {
      const addr = readStxAddress();
      if (addr) {
        setState({
          address: addr,
          isConnected: true,
          isConnecting: false,
          network: "testnet",
          error: null,
        });
        return;
      }
    }

    setState((s) => ({ ...s, isConnecting: true, error: null }));
    logRegisteredProviders();

    // Try the canonical @stacks/connect flow first (shows the multi-wallet
    // picker UI), bounded by a timeout.
    try {
      const response = await withTimeout(
        stacksConnect(),
        PRIMARY_TIMEOUT_MS,
        "connect()"
      );
      console.log("[useWallet] connect response:", response);

      const address =
        response.addresses.find((a) => a.symbol === "STX")?.address ??
        readStxAddress();

      if (address) {
        setState({
          address,
          isConnected: true,
          isConnecting: false,
          network: "testnet",
          error: null,
        });
        return;
      }
      console.warn("[useWallet] connect() returned but no STX address");
    } catch (err) {
      console.warn(
        "[useWallet] connect() failed — falling back to direct provider:",
        err
      );
    }

    // Fallback: call a directly-injected provider, bypassing the picker.
    // This works around conflicts where the picker selects a provider that
    // hangs (e.g., a deprecated extension intercepting StacksProvider).
    const w =
      typeof window !== "undefined" ? (window as WindowProviders) : undefined;
    const directProvider =
      w?.LeatherProvider ??
      w?.XverseProviders?.StacksProvider ??
      w?.StacksProvider;

    if (!directProvider) {
      setState((s) => ({
        ...s,
        isConnecting: false,
        error:
          "No Stacks wallet detected. Install Leather or Xverse and reload the page.",
      }));
      return;
    }

    try {
      console.log("[useWallet] trying direct provider request");
      const response = await withTimeout(
        stacksRequest({ provider: directProvider }, "getAddresses"),
        FALLBACK_TIMEOUT_MS,
        "direct getAddresses"
      );
      console.log("[useWallet] direct response:", response);

      const address =
        response.addresses.find((a) => a.symbol === "STX")?.address ??
        readStxAddress();

      if (!address) {
        setState((s) => ({
          ...s,
          isConnecting: false,
          error: "Wallet did not return a Stacks address.",
        }));
        return;
      }

      setState({
        address,
        isConnected: true,
        isConnecting: false,
        network: "testnet",
        error: null,
      });
    } catch (err) {
      const msg =
        err instanceof Error && err.message ? err.message : "Failed to connect.";
      console.error("[useWallet] direct provider failed:", err);
      setState((s) => ({
        ...s,
        isConnecting: false,
        error: `${msg} If you have multiple wallet extensions installed, try disabling all but one and reload.`,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    try {
      stacksDisconnect();
    } catch (err) {
      console.warn("[useWallet] disconnect cleanup failed:", err);
    }
    setState({
      address: null,
      isConnected: false,
      isConnecting: false,
      network: "testnet",
      error: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return { ...state, connect, disconnect, clearError };
}
