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

const PRIMARY_TIMEOUT_MS = 20_000;
const FALLBACK_TIMEOUT_MS = 12_000;

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

    // Primary path: @stacks/connect picker UI.
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

    // Fallback: bypass the picker and try every injected provider in turn.
    // With multiple wallet extensions installed, the first one's message
    // bridge often hangs (especially deprecated Hiro Wallet); the second
    // may still respond.
    const w =
      typeof window !== "undefined" ? (window as WindowProviders) : undefined;
    const candidates: Array<{ name: string; provider: StacksProvider }> = [];
    if (w?.LeatherProvider) candidates.push({ name: "Leather", provider: w.LeatherProvider });
    if (w?.XverseProviders?.StacksProvider) candidates.push({ name: "Xverse", provider: w.XverseProviders.StacksProvider });
    if (w?.StacksProvider) candidates.push({ name: "StacksProvider", provider: w.StacksProvider });

    if (candidates.length === 0) {
      setState((s) => ({
        ...s,
        isConnecting: false,
        error:
          "No Stacks wallet detected. Install Leather or Xverse and reload the page.",
      }));
      return;
    }

    const failures: string[] = [];
    for (const { name, provider } of candidates) {
      try {
        console.log(`[useWallet] trying ${name} directly`);
        const response = await withTimeout(
          stacksRequest({ provider }, "getAddresses"),
          FALLBACK_TIMEOUT_MS,
          `${name}.getAddresses`
        );
        console.log(`[useWallet] ${name} response:`, response);

        const address =
          response.addresses.find((a) => a.symbol === "STX")?.address ??
          readStxAddress();
        if (!address) {
          failures.push(`${name}: no STX address returned`);
          continue;
        }

        setState({
          address,
          isConnected: true,
          isConnecting: false,
          network: "testnet",
          error: null,
        });
        return;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[useWallet] ${name} failed:`, err);
        failures.push(`${name}: ${msg}`);
      }
    }

    setState((s) => ({
      ...s,
      isConnecting: false,
      error: `All wallets failed (${failures.join("; ")}). Disable other Stacks wallet extensions (especially the deprecated Hiro Wallet) and reload.`,
    }));
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
