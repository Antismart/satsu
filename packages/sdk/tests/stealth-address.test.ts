/**
 * Tests for ECDH stealth address derivation.
 *
 * Verifies the core stealth address protocol:
 *   - Sender can derive a stealth address from a meta-address
 *   - Recipient can detect payments using their view key
 *   - Non-matching view keys correctly fail to match
 *   - Self-deposit produces consistent stealth private keys
 *   - Meta-address encoding round-trips correctly
 */

import { describe, it, expect } from 'vitest';
import * as secp from '@noble/secp256k1';
import {
  generateStealthKeys,
  deriveViewKeyFromSpend,
} from '../src/wallet/stealth-keys.js';
import {
  deriveStealthAddress,
  deriveSelfStealth,
  checkStealthPayment,
  verifyStealthPayment,
} from '../src/wallet/stealth-address.js';
import {
  encodeMetaAddress,
  decodeMetaAddress,
  validateMetaAddress,
} from '../src/wallet/meta-address.js';

describe('Stealth Keys', () => {
  it('should generate valid stealth keypairs', () => {
    const keys = generateStealthKeys();

    // Check key lengths
    expect(keys.spendPrivKey.length).toBe(32);
    expect(keys.spendPubKey.length).toBe(33);
    expect(keys.viewPrivKey.length).toBe(32);
    expect(keys.viewPubKey.length).toBe(33);

    // Check that public keys start with 02 or 03 (compressed)
    expect([0x02, 0x03]).toContain(keys.spendPubKey[0]);
    expect([0x02, 0x03]).toContain(keys.viewPubKey[0]);

    // Verify spend public key matches spend private key
    const derivedSpendPub = secp.getPublicKey(keys.spendPrivKey, true);
    expect(keys.spendPubKey).toEqual(derivedSpendPub);

    // Verify view public key matches view private key
    const derivedViewPub = secp.getPublicKey(keys.viewPrivKey, true);
    expect(keys.viewPubKey).toEqual(derivedViewPub);
  });

  it('should derive view key deterministically from spend key', () => {
    const keys = generateStealthKeys();
    const derived1 = deriveViewKeyFromSpend(keys.spendPrivKey);
    const derived2 = deriveViewKeyFromSpend(keys.spendPrivKey);

    expect(derived1.viewPrivKey).toEqual(derived2.viewPrivKey);
    expect(derived1.viewPubKey).toEqual(derived2.viewPubKey);
  });

  it('should derive different view keys from different spend keys', () => {
    const keys1 = generateStealthKeys();
    const keys2 = generateStealthKeys();

    const view1 = deriveViewKeyFromSpend(keys1.spendPrivKey);
    const view2 = deriveViewKeyFromSpend(keys2.spendPrivKey);

    expect(view1.viewPrivKey).not.toEqual(view2.viewPrivKey);
  });
});

describe('Stealth Address Derivation', () => {
  it('should derive a stealth address from a meta-address', () => {
    const keys = generateStealthKeys();
    const meta = {
      spendPubKey: keys.spendPubKey,
      viewPubKey: keys.viewPubKey,
    };

    const result = deriveStealthAddress(meta, undefined, 'testnet');

    expect(result.stealthPubKey.length).toBe(33);
    expect(result.ephemeralPubKey.length).toBe(33);
    expect(result.stealthAddress).toBeTruthy();
    expect(result.stealthAddress.startsWith('S')).toBe(true);
    // Sender should NOT have the stealth private key
    expect(result.stealthPrivKey).toBeUndefined();
  });

  it('should produce different stealth addresses for different ephemeral keys', () => {
    const keys = generateStealthKeys();
    const meta = {
      spendPubKey: keys.spendPubKey,
      viewPubKey: keys.viewPubKey,
    };

    const result1 = deriveStealthAddress(meta, undefined, 'testnet');
    const result2 = deriveStealthAddress(meta, undefined, 'testnet');

    // Each call uses a random ephemeral key, so addresses should differ
    expect(result1.stealthAddress).not.toBe(result2.stealthAddress);
    expect(result1.ephemeralPubKey).not.toEqual(result2.ephemeralPubKey);
  });

  it('should produce deterministic result with provided ephemeral key', () => {
    const keys = generateStealthKeys();
    const meta = {
      spendPubKey: keys.spendPubKey,
      viewPubKey: keys.viewPubKey,
    };

    const ephemeralPrivKey = secp.utils.randomPrivateKey();
    const result1 = deriveStealthAddress(meta, ephemeralPrivKey, 'testnet');
    const result2 = deriveStealthAddress(meta, ephemeralPrivKey, 'testnet');

    expect(result1.stealthAddress).toBe(result2.stealthAddress);
    expect(result1.stealthPubKey).toEqual(result2.stealthPubKey);
    expect(result1.ephemeralPubKey).toEqual(result2.ephemeralPubKey);
  });
});

describe('Stealth Payment Detection', () => {
  it('should detect a payment addressed to us', () => {
    const keys = generateStealthKeys();
    const meta = {
      spendPubKey: keys.spendPubKey,
      viewPubKey: keys.viewPubKey,
    };

    // Sender derives stealth address
    const senderResult = deriveStealthAddress(meta, undefined, 'testnet');

    // Recipient checks with view key
    const check = checkStealthPayment(
      senderResult.ephemeralPubKey,
      keys.viewPrivKey,
      keys.spendPubKey,
      keys.spendPrivKey,
      'testnet',
    );

    expect(check.match).toBe(true);
    expect(check.stealthAddress).toBe(senderResult.stealthAddress);
    expect(check.stealthPubKey).toEqual(senderResult.stealthPubKey);
    expect(check.stealthPrivKey).toBeDefined();
    expect(check.stealthPrivKey!.length).toBe(32);

    // Verify the stealth private key produces the correct public key
    const derivedPub = secp.getPublicKey(check.stealthPrivKey!, true);
    expect(derivedPub).toEqual(senderResult.stealthPubKey);
  });

  it('should detect payment using verifyStealthPayment against target address', () => {
    const keys = generateStealthKeys();
    const meta = {
      spendPubKey: keys.spendPubKey,
      viewPubKey: keys.viewPubKey,
    };

    const senderResult = deriveStealthAddress(meta, undefined, 'testnet');

    // Verify against the correct address
    const matchResult = verifyStealthPayment(
      senderResult.ephemeralPubKey,
      keys.viewPrivKey,
      keys.spendPubKey,
      senderResult.stealthAddress,
      keys.spendPrivKey,
      'testnet',
    );

    expect(matchResult.match).toBe(true);

    // Verify against a wrong address
    const noMatchResult = verifyStealthPayment(
      senderResult.ephemeralPubKey,
      keys.viewPrivKey,
      keys.spendPubKey,
      'ST1234WRONGADDRESS',
      keys.spendPrivKey,
      'testnet',
    );

    expect(noMatchResult.match).toBe(false);
  });

  it('should not match with wrong view key', () => {
    const recipientKeys = generateStealthKeys();
    const wrongKeys = generateStealthKeys();
    const meta = {
      spendPubKey: recipientKeys.spendPubKey,
      viewPubKey: recipientKeys.viewPubKey,
    };

    // Sender derives stealth address for recipient
    const senderResult = deriveStealthAddress(meta, undefined, 'testnet');

    // Wrong person tries to check with their view key
    const check = checkStealthPayment(
      senderResult.ephemeralPubKey,
      wrongKeys.viewPrivKey, // wrong view key!
      recipientKeys.spendPubKey,
      undefined,
      'testnet',
    );

    // checkStealthPayment always returns match: true with a derived address,
    // but the derived address will NOT match the sender's stealth address
    // because the wrong view key produces a different shared secret.
    expect(check.stealthAddress).not.toBe(senderResult.stealthAddress);
  });
});

describe('Self-Stealth (Self-Deposit)', () => {
  it('should produce a valid stealth address with spending key', () => {
    const keys = generateStealthKeys();

    const result = deriveSelfStealth(
      keys.spendPrivKey,
      keys.viewPrivKey,
      'testnet',
    );

    expect(result.stealthPubKey.length).toBe(33);
    expect(result.ephemeralPubKey.length).toBe(33);
    expect(result.stealthPrivKey).toBeDefined();
    expect(result.stealthPrivKey!.length).toBe(32);

    // Verify stealth private key corresponds to stealth public key
    const derivedPub = secp.getPublicKey(result.stealthPrivKey!, true);
    expect(derivedPub).toEqual(result.stealthPubKey);
  });

  it('self-deposit should be detectable by the recipient (self)', () => {
    const keys = generateStealthKeys();

    const selfResult = deriveSelfStealth(
      keys.spendPrivKey,
      keys.viewPrivKey,
      'testnet',
    );

    // Verify the self-deposit is detectable
    const check = checkStealthPayment(
      selfResult.ephemeralPubKey,
      keys.viewPrivKey,
      keys.spendPubKey,
      keys.spendPrivKey,
      'testnet',
    );

    expect(check.match).toBe(true);
    expect(check.stealthAddress).toBe(selfResult.stealthAddress);
    expect(check.stealthPrivKey).toEqual(selfResult.stealthPrivKey);
  });
});

describe('Meta-Address Encoding', () => {
  it('should round-trip encode/decode', () => {
    const keys = generateStealthKeys();

    const encoded = encodeMetaAddress(keys.spendPubKey, keys.viewPubKey);
    expect(encoded.startsWith('st:1:')).toBe(true);

    const decoded = decodeMetaAddress(encoded);
    expect(decoded.spendPubKey).toEqual(keys.spendPubKey);
    expect(decoded.viewPubKey).toEqual(keys.viewPubKey);
  });

  it('should validate a correct meta-address', () => {
    const keys = generateStealthKeys();
    const meta = {
      spendPubKey: keys.spendPubKey,
      viewPubKey: keys.viewPubKey,
    };

    expect(validateMetaAddress(meta)).toBe(true);
  });

  it('should reject invalid meta-address (wrong length)', () => {
    const meta = {
      spendPubKey: new Uint8Array(32), // wrong length
      viewPubKey: new Uint8Array(33),
    };

    expect(validateMetaAddress(meta)).toBe(false);
  });

  it('should reject invalid meta-address (invalid point)', () => {
    const meta = {
      spendPubKey: new Uint8Array(33), // all zeros is not a valid point
      viewPubKey: new Uint8Array(33),
    };

    expect(validateMetaAddress(meta)).toBe(false);
  });

  it('should throw on invalid encoded meta-address', () => {
    expect(() => decodeMetaAddress('invalid')).toThrow();
    expect(() => decodeMetaAddress('st:2:abcd')).toThrow();
    expect(() => decodeMetaAddress('st:1:tooshort')).toThrow();
  });
});
