"use client";

import { useState, useCallback, useEffect } from "react";

interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  network: "mainnet" | "testnet";
}

interface WalletActions {
  connect: () => Promise<void>;
  disconnect: () => void;
}

const STORAGE_KEY = "satsu_wallet";

/**
 * Wallet state management hook.
 *
 * Uses LeatherProvider.request for authentication. Falls back to a mock flow
 * when the wallet extension is not installed (useful during development).
 */
export function useWallet(): WalletState & WalletActions {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    network: "testnet",
  });

  // Restore persisted session on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.address) {
          setState((s) => ({
            ...s,
            address: parsed.address,
            isConnected: true,
            network: parsed.network ?? "testnet",
          }));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const connect = useCallback(async () => {
    setState((s) => ({ ...s, isConnecting: true }));

    try {
      const provider = (window as typeof window & { LeatherProvider?: { request: (method: string, params?: unknown) => Promise<unknown> } })
        .LeatherProvider;

      if (!provider?.request) {
        throw new Error("Leather wallet not available");
      }

      const response = (await provider.request("getAddresses")) as {
        addresses?: { address?: string; network?: string }[];
      };
      const addresses = Array.isArray(response?.addresses) ? response.addresses : [];
      const testnetAddress = addresses.find((entry) => entry.network === "testnet")
        ?.address;
      const address = testnetAddress ?? addresses[0]?.address;

      if (!address) {
        throw new Error("No address returned by Leather");
      }

      setState({
        address,
        isConnected: true,
        isConnecting: false,
        network: "testnet",
      });
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ address, network: "testnet" })
        );
      } catch {
        // ignore
      }
    } catch {
      // If Leather is not available or not installed,
      // fall back to a dev-mode mock address
      const mockAddr = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
      setState({
        address: mockAddr,
        isConnected: true,
        isConnecting: false,
        network: "testnet",
      });
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ address: mockAddr, network: "testnet" })
        );
      } catch {
        // ignore
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({
      address: null,
      isConnected: false,
      isConnecting: false,
      network: "testnet",
    });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { ...state, connect, disconnect };
}
