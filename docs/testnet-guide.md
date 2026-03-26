# Satsu Testnet Deployment Guide

This guide covers deploying Satsu privacy pool contracts to the Stacks testnet with real sBTC integration.

## Prerequisites

- **clarinet** >= 2.0 installed ([installation guide](https://github.com/hirosystems/clarinet#installation))
- **Node.js** >= 18 (for SDK and tests)
- A Stacks testnet wallet with STX for deployment fees
- Internet connection to reach the Stacks testnet API

## Step 1: Get Testnet STX

You need testnet STX to pay for contract deployment transactions.

1. Generate or import a wallet mnemonic.
2. Derive the STX address from the mnemonic (clarinet does this automatically).
3. Visit the faucet: https://explorer.hiro.so/sandbox/faucet?chain=testnet
4. Enter your STX address and request tokens.
5. Wait for the faucet transaction to confirm (usually 1-2 minutes on testnet).
6. Verify your balance:
   ```bash
   curl https://api.testnet.hiro.so/v2/accounts/<YOUR_STX_ADDRESS>
   ```

## Step 2: Get Testnet sBTC

To test deposits into the Satsu privacy pool, you need testnet sBTC.

1. Visit the sBTC testnet bridge: https://bridge.sbtc.tech
2. Connect your wallet (Leather, Xverse, or similar).
3. Bridge testnet BTC to sBTC on Stacks testnet.
4. The sBTC will appear in your Stacks wallet once the bridge transaction confirms.

The real sBTC testnet contract is:
```
SN3R84XZYA63QS28932XQF3G1J8R9PC3W8AKR0EP.sbtc-token
```

Verify it is live:
```bash
curl https://api.testnet.hiro.so/v2/contracts/interface/SN3R84XZYA63QS28932XQF3G1J8R9PC3W8AKR0EP/sbtc-token
```

## Step 3: Configure Deployment

1. Open `settings/Testnet.toml` and set your deployer mnemonic:
   ```toml
   [accounts.deployer]
   mnemonic = "your twelve word mnemonic phrase goes here ..."
   ```

2. For better security, use encrypted mnemonics:
   ```bash
   clarinet deployments encrypt
   ```

3. Verify the sBTC testnet address in `contracts/pool-v1-testnet.clar` matches the current canonical deployment. If it has changed, update the contract references.

## Step 4: Deploy Contracts

Run the deployment script:

```bash
chmod +x scripts/deploy-testnet.sh
./scripts/deploy-testnet.sh
```

The script performs pre-flight checks, runs `clarinet check`, and applies the deployment plan.

Alternatively, deploy manually:

```bash
cd /path/to/satsu
clarinet check
clarinet deployments apply -p deployments/default.testnet-plan.yaml
```

### Deployment Order

The deployment plan (`deployments/default.testnet-plan.yaml`) deploys contracts in three batches:

| Batch | Contracts | Purpose |
|-------|-----------|---------|
| 0 | sip010-trait, pool-trait, verifier-trait | Interface traits |
| 1 | merkle-tree, nullifier-registry, stealth-v1, proof-verifier | Core infrastructure |
| 2 | pool-v1 (from pool-v1-testnet.clar) | Privacy pool application |

The mock `sbtc-token` is NOT deployed on testnet. The pool-v1-testnet variant calls the real sBTC contract directly.

## Step 5: Verify Deployment

After all transactions confirm, verify each contract is deployed:

```bash
# Replace <DEPLOYER> with your deployer STX address
DEPLOYER="<YOUR_DEPLOYER_ADDRESS>"
API="https://api.testnet.hiro.so"

# Check pool-v1
curl "$API/v2/contracts/interface/$DEPLOYER/pool-v1"

# Check merkle-tree
curl "$API/v2/contracts/interface/$DEPLOYER/merkle-tree"

# Check stealth-v1
curl "$API/v2/contracts/interface/$DEPLOYER/stealth-v1"

# Check nullifier-registry
curl "$API/v2/contracts/interface/$DEPLOYER/nullifier-registry"
```

Each should return a JSON object describing the contract's interface. A 404 means the contract is not yet deployed or the address is wrong.

## Step 6: Post-Deployment Configuration

### 6a. Authorize pool-v1 on nullifier-registry

The nullifier registry only allows authorized contracts to mark nullifiers as used. You must set pool-v1 as the authorized contract:

```clarity
(contract-call? '<DEPLOYER>.nullifier-registry set-authorized-contract
  '<DEPLOYER>.pool-v1)
```

### 6b. Authorize pool-v1 on merkle-tree

If the merkle-tree contract has an `set-authorized-caller` function:

```clarity
(contract-call? '<DEPLOYER>.merkle-tree set-authorized-caller
  '<DEPLOYER>.pool-v1)
```

### 6c. Register stealth meta-address (bootstrap anonymity set)

Register the deployer's stealth meta-address to bootstrap the anonymity set:

```clarity
(contract-call? '<DEPLOYER>.stealth-v1 register-meta-address
  0x02<your-spend-pubkey-32-bytes>
  0x02<your-view-pubkey-32-bytes>)
```

## Step 7: Test a Deposit

1. Ensure you have testnet sBTC (at least 0.1 sBTC = 10,000,000 satoshis).

2. Generate a commitment (32-byte Pedersen commitment). Using the SDK:
   ```typescript
   import { generateCommitment } from '@satsu/sdk';
   const { commitment, secret, nullifier } = generateCommitment();
   ```

3. Call deposit on pool-v1:
   ```clarity
   (contract-call? '<DEPLOYER>.pool-v1 deposit
     0x<commitment-hex>
     '<YOUR_ADDRESS>)
   ```

4. The transaction will:
   - Transfer 0.1 sBTC from your address to the pool contract
   - Append the commitment to the Merkle tree
   - Return the new root and leaf index

5. Save the returned values -- you need them (plus the secret and nullifier) to withdraw later.

## Step 8: Test a Withdrawal

1. Generate a ZK-STARK proof using the SDK:
   ```typescript
   import { generateWithdrawalProof } from '@satsu/sdk';
   const proof = await generateWithdrawalProof({
     secret,
     nullifier,
     root: merkleRoot,
     recipient: recipientAddress,
     relayerFee: 0,
   });
   ```

2. Call withdraw on pool-v1:
   ```clarity
   (contract-call? '<DEPLOYER>.pool-v1 withdraw
     0x<proof-hex>
     0x<nullifier-hex>
     0x<root-hex>
     '<RECIPIENT_ADDRESS>
     0x<ephemeral-pubkey-hex>
     u0)
   ```

3. The transaction will:
   - Verify the Merkle root is known
   - Check the nullifier has not been used
   - Verify the STARK proof
   - Mark the nullifier as used
   - Transfer 0.1 sBTC to the recipient

## Troubleshooting

### "Insufficient STX balance"
Fund your deployer account from the faucet. Each contract deployment costs a few hundred micro-STX.

### "Contract already deployed"
Contract names are unique per deployer address. If you need to redeploy, use a different deployer account or increment the contract name (e.g., `pool-v2`).

### "Nonce mismatch"
Wait for all pending transactions to confirm before submitting new ones. Check pending transactions at:
```
https://api.testnet.hiro.so/v2/accounts/<ADDRESS>?unanchored=true
```

### "sBTC transfer failed"
- Verify you have sufficient sBTC balance
- Verify the sBTC contract address in pool-v1-testnet.clar is correct
- Check that the sBTC testnet contract is operational

### "Invalid root" on withdrawal
The Merkle root you are using may not be recognized. Use `get-current-root` or check `is-known-root` to verify your root is valid.

## SDK Configuration

After deployment, update the SDK testnet configuration:

1. Edit `packages/sdk/src/config/testnet.ts`
2. Set `TESTNET_DEPLOYER` to your actual deployer address
3. Verify `SBTC_TESTNET_CONTRACT` matches the real sBTC address

## Architecture Notes

### Why pool-v1-testnet.clar?

Clarity uses static contract references -- you cannot dynamically pass a contract address at runtime (except via traits in function parameters). The `pool-v1.clar` file references `.sbtc-token` (the mock), while `pool-v1-testnet.clar` references the real sBTC testnet contract.

Both are deployed as `pool-v1` on their respective networks, so the SDK and API remain consistent.

### SIP-010 Trait

The `sip010-trait.clar` defines the standard SIP-010 fungible token interface. The mock `sbtc-token` implements this trait. Future versions may use trait-based function parameters to eliminate the per-network contract variant.
