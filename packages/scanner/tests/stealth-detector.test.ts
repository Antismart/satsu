/**
 * Tests for stealth payment detection via view-key trial decryption.
 *
 * These tests verify the core privacy detection logic:
 * 1. Generate a keypair (spend + view)
 * 2. Derive a stealth address using ECDH (simulating the sender)
 * 3. Create a mock WithdrawalEvent with the ephemeral pubkey and stealth address
 * 4. Run tryDecryptPayment with the view key
 * 5. Verify it detects the payment
 *
 * Also tests that wrong keys don't produce false positives.
 */

import { describe, it, expect } from 'vitest';
import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';

import {
  tryDecryptPayment,
  scanEvents,
  publicKeyToStacksAddress,
  type ScannerKeys,
} from '../src/stealth-detector.js';
import type { WithdrawalEvent } from '../src/chainhook.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reduce a 32-byte hash to a valid secp256k1 scalar in [1, n-1].
 * Mirrors the logic in stealth-detector.ts.
 */
function bytesToScalar(bytes: Uint8Array): bigint {
  const num = secp.etc.bytesToNumberBE(bytes);
  const scalar = secp.etc.mod(num, secp.CURVE.n);
  return scalar === 0n ? 1n : scalar;
}

/**
 * Simulate the sender's stealth address derivation.
 *
 * The sender:
 * 1. Picks ephemeral scalar r, computes R = r * G
 * 2. Computes shared secret S = r * viewPubKey
 * 3. Derives stealth pubkey: P = spendPubKey + sha256(S) * G
 * 4. Derives Stacks address from P
 */
function deriveStealthAddress(
  spendPubKey: Uint8Array,
  viewPubKey: Uint8Array,
  ephemeralPrivKey: Uint8Array,
  network: 'mainnet' | 'testnet' = 'testnet',
): { stealthAddress: string; ephemeralPubKey: Uint8Array; sharedSecretHash: Uint8Array } {
  const R = secp.getPublicKey(ephemeralPrivKey, true);

  // ECDH: S = r * viewPubKey
  const sharedSecretPoint = secp.getSharedSecret(ephemeralPrivKey, viewPubKey, true);
  const hashS = sha256(sharedSecretPoint);
  const hashScalar = bytesToScalar(hashS);

  // Stealth pubkey: P = spendPubKey + hash(S) * G
  const spendPoint = secp.Point.fromHex(spendPubKey);
  const hashPoint = secp.Point.BASE.multiply(hashScalar);
  const stealthPoint = spendPoint.add(hashPoint);
  const stealthPubKey = stealthPoint.toRawBytes(true);

  const stealthAddress = publicKeyToStacksAddress(stealthPubKey, network);

  return { stealthAddress, ephemeralPubKey: R, sharedSecretHash: hashS };
}

/**
 * Create a mock WithdrawalEvent.
 */
function mockWithdrawalEvent(
  recipient: string,
  ephemeralPubKey: Uint8Array,
  overrides?: Partial<WithdrawalEvent>,
): WithdrawalEvent {
  return {
    txId: overrides?.txId ?? '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    nullifier: overrides?.nullifier ?? new Uint8Array(32).fill(0xab),
    recipient,
    ephemeralPubKey,
    relayerFee: overrides?.relayerFee ?? 0n,
    blockHeight: overrides?.blockHeight ?? 100,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('stealth-detector', () => {
  // Generate test keypairs deterministically for reproducibility
  const spendPrivKey = secp.etc.hexToBytes(
    'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  );
  const viewPrivKey = secp.etc.hexToBytes(
    'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  );
  const spendPubKey = secp.getPublicKey(spendPrivKey, true);
  const viewPubKey = secp.getPublicKey(viewPrivKey, true);
  const ephemeralPrivKey = secp.etc.hexToBytes(
    'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
  );

  const keys: ScannerKeys = {
    viewPrivKey,
    spendPubKey,
  };

  describe('tryDecryptPayment', () => {
    it('should detect a payment addressed to the user', () => {
      // Sender derives stealth address
      const { stealthAddress, ephemeralPubKey, sharedSecretHash } = deriveStealthAddress(
        spendPubKey,
        viewPubKey,
        ephemeralPrivKey,
        'testnet',
      );

      // Create a mock withdrawal event
      const event = mockWithdrawalEvent(stealthAddress, ephemeralPubKey);

      // Scanner attempts trial decryption
      const result = tryDecryptPayment(event, keys, 'testnet');

      expect(result).not.toBeNull();
      expect(result!.txId).toBe(event.txId);
      expect(result!.stealthAddress).toBe(stealthAddress);
      expect(result!.blockHeight).toBe(100);

      // Verify the shared secret hash matches what the sender computed
      expect(result!.sharedSecretHash).toEqual(sharedSecretHash);
    });

    it('should not detect a payment addressed to a different user', () => {
      // Generate a different user's keys
      const otherSpendPrivKey = secp.etc.hexToBytes(
        '1111111111111111111111111111111111111111111111111111111111111111',
      );
      const otherViewPrivKey = secp.etc.hexToBytes(
        '2222222222222222222222222222222222222222222222222222222222222222',
      );
      const otherSpendPubKey = secp.getPublicKey(otherSpendPrivKey, true);
      const otherViewPubKey = secp.getPublicKey(otherViewPrivKey, true);

      // Sender derives stealth address for OTHER user
      const { stealthAddress, ephemeralPubKey } = deriveStealthAddress(
        otherSpendPubKey,
        otherViewPubKey,
        ephemeralPrivKey,
        'testnet',
      );

      const event = mockWithdrawalEvent(stealthAddress, ephemeralPubKey);

      // OUR scanner should NOT detect this payment
      const result = tryDecryptPayment(event, keys, 'testnet');
      expect(result).toBeNull();
    });

    it('should not detect when using wrong view key', () => {
      const { stealthAddress, ephemeralPubKey } = deriveStealthAddress(
        spendPubKey,
        viewPubKey,
        ephemeralPrivKey,
        'testnet',
      );

      const event = mockWithdrawalEvent(stealthAddress, ephemeralPubKey);

      // Scanner with WRONG view key
      const wrongKeys: ScannerKeys = {
        viewPrivKey: secp.etc.hexToBytes(
          'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        ),
        spendPubKey,
      };

      const result = tryDecryptPayment(event, wrongKeys, 'testnet');
      expect(result).toBeNull();
    });

    it('should not detect when using wrong spend public key', () => {
      const { stealthAddress, ephemeralPubKey } = deriveStealthAddress(
        spendPubKey,
        viewPubKey,
        ephemeralPrivKey,
        'testnet',
      );

      const event = mockWithdrawalEvent(stealthAddress, ephemeralPubKey);

      // Scanner with WRONG spend public key
      const wrongSpendPrivKey = secp.etc.hexToBytes(
        'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      );
      const wrongKeys: ScannerKeys = {
        viewPrivKey,
        spendPubKey: secp.getPublicKey(wrongSpendPrivKey, true),
      };

      const result = tryDecryptPayment(event, wrongKeys, 'testnet');
      expect(result).toBeNull();
    });

    it('should handle invalid ephemeral public key gracefully', () => {
      const event = mockWithdrawalEvent(
        'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        new Uint8Array(33).fill(0xff), // Invalid point
      );

      const result = tryDecryptPayment(event, keys, 'testnet');
      expect(result).toBeNull();
    });

    it('should handle wrong-length ephemeral public key gracefully', () => {
      const event = mockWithdrawalEvent(
        'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        new Uint8Array(32).fill(0x02), // Wrong length (32 instead of 33)
      );

      const result = tryDecryptPayment(event, keys, 'testnet');
      expect(result).toBeNull();
    });

    it('should compute correct amount considering relayer fee', () => {
      const { stealthAddress, ephemeralPubKey } = deriveStealthAddress(
        spendPubKey,
        viewPubKey,
        ephemeralPrivKey,
        'testnet',
      );

      const relayerFee = 100_000n;
      const event = mockWithdrawalEvent(stealthAddress, ephemeralPubKey, { relayerFee });

      const result = tryDecryptPayment(event, keys, 'testnet');
      expect(result).not.toBeNull();
      // Pool denomination (10_000_000) - relayer fee (100_000) = 9_900_000
      expect(result!.amount).toBe(10_000_000n - relayerFee);
    });

    it('should work with mainnet network parameter', () => {
      const { stealthAddress, ephemeralPubKey } = deriveStealthAddress(
        spendPubKey,
        viewPubKey,
        ephemeralPrivKey,
        'mainnet',
      );

      expect(stealthAddress.startsWith('SP')).toBe(true);

      const event = mockWithdrawalEvent(stealthAddress, ephemeralPubKey);
      const result = tryDecryptPayment(event, keys, 'mainnet');

      expect(result).not.toBeNull();
      expect(result!.stealthAddress).toBe(stealthAddress);
    });
  });

  describe('scanEvents', () => {
    it('should detect matching events and skip non-matching ones', () => {
      // Create one matching event
      const { stealthAddress, ephemeralPubKey } = deriveStealthAddress(
        spendPubKey,
        viewPubKey,
        ephemeralPrivKey,
        'testnet',
      );

      const matchingEvent = mockWithdrawalEvent(stealthAddress, ephemeralPubKey, {
        txId: '0x1111111111111111111111111111111111111111111111111111111111111111',
        blockHeight: 200,
      });

      // Create non-matching events
      const otherSpendPrivKey = secp.etc.hexToBytes(
        '3333333333333333333333333333333333333333333333333333333333333333',
      );
      const otherViewPrivKey = secp.etc.hexToBytes(
        '4444444444444444444444444444444444444444444444444444444444444444',
      );
      const otherEph = secp.utils.randomPrivateKey();
      const otherStealth = deriveStealthAddress(
        secp.getPublicKey(otherSpendPrivKey, true),
        secp.getPublicKey(otherViewPrivKey, true),
        otherEph,
        'testnet',
      );

      const nonMatchingEvent = mockWithdrawalEvent(
        otherStealth.stealthAddress,
        otherStealth.ephemeralPubKey,
        {
          txId: '0x2222222222222222222222222222222222222222222222222222222222222222',
          blockHeight: 201,
        },
      );

      const events = [matchingEvent, nonMatchingEvent];
      const detected = scanEvents(events, keys, 'testnet');

      expect(detected).toHaveLength(1);
      expect(detected[0]!.txId).toBe(matchingEvent.txId);
      expect(detected[0]!.stealthAddress).toBe(stealthAddress);
    });

    it('should return empty array when no events match', () => {
      const randomKey = secp.utils.randomPrivateKey();
      const event = mockWithdrawalEvent(
        'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
        secp.getPublicKey(randomKey, true),
      );

      const detected = scanEvents([event], keys, 'testnet');
      expect(detected).toHaveLength(0);
    });

    it('should handle empty events array', () => {
      const detected = scanEvents([], keys, 'testnet');
      expect(detected).toHaveLength(0);
    });

    it('should detect multiple matching payments in the same batch', () => {
      // Two different ephemeral keys, both addressed to the same recipient
      const eph1 = secp.etc.hexToBytes(
        '5555555555555555555555555555555555555555555555555555555555555555',
      );
      const eph2 = secp.etc.hexToBytes(
        '6666666666666666666666666666666666666666666666666666666666666666',
      );

      const s1 = deriveStealthAddress(spendPubKey, viewPubKey, eph1, 'testnet');
      const s2 = deriveStealthAddress(spendPubKey, viewPubKey, eph2, 'testnet');

      // Each produces a DIFFERENT stealth address (unlinkable)
      expect(s1.stealthAddress).not.toBe(s2.stealthAddress);

      const events = [
        mockWithdrawalEvent(s1.stealthAddress, s1.ephemeralPubKey, {
          txId: '0xaaaa000000000000000000000000000000000000000000000000000000000000',
        }),
        mockWithdrawalEvent(s2.stealthAddress, s2.ephemeralPubKey, {
          txId: '0xbbbb000000000000000000000000000000000000000000000000000000000000',
        }),
      ];

      const detected = scanEvents(events, keys, 'testnet');
      expect(detected).toHaveLength(2);
    });
  });

  describe('publicKeyToStacksAddress', () => {
    it('should generate testnet addresses starting with ST', () => {
      const addr = publicKeyToStacksAddress(spendPubKey, 'testnet');
      expect(addr.startsWith('ST')).toBe(true);
    });

    it('should generate mainnet addresses starting with SP', () => {
      const addr = publicKeyToStacksAddress(spendPubKey, 'mainnet');
      expect(addr.startsWith('SP')).toBe(true);
    });

    it('should produce deterministic addresses for the same key', () => {
      const addr1 = publicKeyToStacksAddress(spendPubKey, 'testnet');
      const addr2 = publicKeyToStacksAddress(spendPubKey, 'testnet');
      expect(addr1).toBe(addr2);
    });

    it('should produce different addresses for different keys', () => {
      const otherKey = secp.getPublicKey(
        secp.etc.hexToBytes(
          '9999999999999999999999999999999999999999999999999999999999999999',
        ),
        true,
      );
      const addr1 = publicKeyToStacksAddress(spendPubKey, 'testnet');
      const addr2 = publicKeyToStacksAddress(otherKey, 'testnet');
      expect(addr1).not.toBe(addr2);
    });
  });

  describe('shared secret hash for spending key derivation', () => {
    it('should enable user to derive stealth spending key', () => {
      // Sender derives stealth address
      const { stealthAddress, ephemeralPubKey } = deriveStealthAddress(
        spendPubKey,
        viewPubKey,
        ephemeralPrivKey,
        'testnet',
      );

      // Scanner detects the payment
      const event = mockWithdrawalEvent(stealthAddress, ephemeralPubKey);
      const detected = tryDecryptPayment(event, keys, 'testnet');

      expect(detected).not.toBeNull();

      // Now the user (who has spendPrivKey) can compute the stealth private key:
      // stealthPrivKey = spendPrivKey + s (mod n)
      const s = bytesToScalar(detected!.sharedSecretHash);
      const spendScalar = secp.etc.bytesToNumberBE(spendPrivKey);
      const stealthScalar = secp.etc.mod(spendScalar + s, secp.CURVE.n);

      // Convert to bytes
      const stealthPrivKeyHex = stealthScalar.toString(16).padStart(64, '0');
      const stealthPrivKeyBytes = secp.etc.hexToBytes(stealthPrivKeyHex);

      // Verify: the derived private key corresponds to the stealth public key
      const derivedPubKey = secp.getPublicKey(stealthPrivKeyBytes, true);
      expect(derivedPubKey).toEqual(detected!.stealthPubKey);
    });
  });
});
