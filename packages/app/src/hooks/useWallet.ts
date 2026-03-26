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
 * Uses @stacks/connect for authentication. Falls back to a mock flow when the
 * wallet extension is not installed (useful during development).
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
      // Dynamic import to avoid SSR issues with @stacks/connect
      const { showConnect } = await import("@stacks/connect");

      await new Promise<void>((resolve, reject) => {
        showConnect({
          appDetails: {
            name: "Satsu",
            icon: "/favicon.ico",
          },
          onFinish: (data) => {
            const addr =
              data.userSession.loadUserData().profile.stxAddress.testnet;
            setState({
              address: addr,
              isConnected: true,
              isConnecting: false,
              network: "testnet",
            });
            try {
              localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ address: addr, network: "testnet" })
              );
            } catch {
              // ignore
            }
            resolve();
          },
          onCancel: () => {
            setState((s) => ({ ...s, isConnecting: false }));
            reject(new Error("User cancelled wallet connection"));
          },
        });
      });
    } catch {
      // If @stacks/connect is not available or wallet is not installed,
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
