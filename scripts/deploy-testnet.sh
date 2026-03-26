#!/bin/bash
# ============================================================================
# deploy-testnet.sh - Deploy Satsu contracts to Stacks testnet
# ============================================================================
#
# Prerequisites:
#   - clarinet >= 2.0 installed
#   - Testnet STX in deployer account (get from faucet)
#   - settings/Testnet.toml configured with your mnemonic
#   - Network reachable (https://api.testnet.hiro.so)
#
# Usage:
#   ./scripts/deploy-testnet.sh
#
# The script will:
#   1. Validate prerequisites (clarinet version, network reachability)
#   2. Run `clarinet check` to verify all contracts compile
#   3. Deploy contracts in order via `clarinet deployments apply`
#   4. Verify deployment by querying contract state
#   5. Print post-deployment setup instructions
# ============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TESTNET_API="https://api.testnet.hiro.so"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEPLOYMENT_PLAN="deployments/default.testnet-plan.yaml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

# ---------------------------------------------------------------------------
# Step 0: Pre-flight checks
# ---------------------------------------------------------------------------

echo ""
echo "============================================"
echo "  Satsu Testnet Deployment"
echo "============================================"
echo ""

# Check clarinet is installed
if ! command -v clarinet &> /dev/null; then
    log_error "clarinet is not installed or not in PATH."
    echo "  Install: https://github.com/hirosystems/clarinet#installation"
    exit 1
fi

CLARINET_VERSION=$(clarinet --version 2>/dev/null | head -1)
log_ok "clarinet found: ${CLARINET_VERSION}"

# Check network reachability
log_info "Checking testnet API reachability..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${TESTNET_API}/v2/info" --connect-timeout 10 || echo "000")
if [ "${HTTP_STATUS}" != "200" ]; then
    log_error "Cannot reach Stacks testnet API at ${TESTNET_API} (HTTP ${HTTP_STATUS})."
    echo "  Check your internet connection or try again later."
    exit 1
fi
log_ok "Testnet API reachable (HTTP ${HTTP_STATUS})."

# Check Testnet.toml has a real mnemonic
cd "${PROJECT_ROOT}"
if grep -q '<YOUR PRIVATE TESTNET MNEMONIC HERE>' settings/Testnet.toml; then
    log_error "Deployer mnemonic not configured in settings/Testnet.toml"
    echo ""
    echo "  1. Generate a new mnemonic or use an existing one"
    echo "  2. Replace '<YOUR PRIVATE TESTNET MNEMONIC HERE>' in settings/Testnet.toml"
    echo "  3. Fund the derived STX address from the faucet:"
    echo "     https://explorer.hiro.so/sandbox/faucet?chain=testnet"
    echo ""
    exit 1
fi
log_ok "Deployer mnemonic configured."

# ---------------------------------------------------------------------------
# Step 1: Verify contracts compile
# ---------------------------------------------------------------------------

echo ""
log_info "Running clarinet check..."
if ! clarinet check; then
    log_error "Contract verification failed. Fix errors above before deploying."
    exit 1
fi
log_ok "All contracts pass clarinet check."

# ---------------------------------------------------------------------------
# Step 2: Show deployment plan
# ---------------------------------------------------------------------------

echo ""
log_info "Deployment plan: ${DEPLOYMENT_PLAN}"
echo ""
echo "  Batch 0 (infrastructure):"
echo "    - sip010-trait    (SIP-010 fungible token trait)"
echo "    - pool-trait      (pool interface trait)"
echo "    - verifier-trait  (verifier interface trait)"
echo ""
echo "  Batch 1 (core libraries):"
echo "    - merkle-tree          (incremental Merkle tree)"
echo "    - nullifier-registry   (double-spend prevention)"
echo "    - stealth-v1           (stealth address registry)"
echo "    - proof-verifier       (STARK proof verification)"
echo ""
echo "  Batch 2 (application):"
echo "    - pool-v1              (privacy pool - deposit/withdraw)"
echo ""

# ---------------------------------------------------------------------------
# Step 3: Deploy
# ---------------------------------------------------------------------------

log_info "Deploying contracts to testnet..."
echo ""

if ! clarinet deployments apply -p "${DEPLOYMENT_PLAN}"; then
    log_error "Deployment failed. Check the output above for details."
    echo ""
    echo "  Common issues:"
    echo "  - Insufficient STX balance: fund from faucet"
    echo "  - Nonce mismatch: wait for pending txs to confirm"
    echo "  - Contract already deployed: check explorer"
    echo ""
    exit 1
fi

log_ok "Deployment transactions submitted."
echo ""

# ---------------------------------------------------------------------------
# Step 4: Verify deployment
# ---------------------------------------------------------------------------

log_info "Waiting for transactions to confirm (this may take 1-2 minutes)..."
echo "  You can monitor at: https://explorer.hiro.so/?chain=testnet"
echo ""

# Extract deployer address from the first contract deployment
# We'll try to read it from the deployment plan or just prompt
log_info "To verify deployment, check these contract endpoints:"
echo ""
echo "  Pool contract:"
echo "    curl ${TESTNET_API}/v2/contracts/interface/<DEPLOYER>/pool-v1"
echo ""
echo "  Merkle tree:"
echo "    curl ${TESTNET_API}/v2/contracts/interface/<DEPLOYER>/merkle-tree"
echo ""
echo "  Stealth registry:"
echo "    curl ${TESTNET_API}/v2/contracts/interface/<DEPLOYER>/stealth-v1"
echo ""

# ---------------------------------------------------------------------------
# Step 5: Post-deployment setup
# ---------------------------------------------------------------------------

echo "============================================"
echo "  Post-Deployment Setup"
echo "============================================"
echo ""
log_warn "IMPORTANT: Complete these steps after all contracts confirm:"
echo ""
echo "  1. Authorize pool-v1 on nullifier-registry:"
echo "     Call nullifier-registry.set-authorized-contract with the"
echo "     pool-v1 contract principal as the argument."
echo ""
echo "     Using clarinet console (testnet):"
echo "       (contract-call? .nullifier-registry set-authorized-contract"
echo "         '<DEPLOYER>.pool-v1)"
echo ""
echo "  2. Register your stealth meta-address (bootstrap the anonymity set):"
echo "     Call stealth-v1.register-meta-address with your spend and view"
echo "     public keys."
echo ""
echo "  3. Make a test deposit:"
echo "     a. Obtain testnet sBTC via the bridge: https://bridge.sbtc.tech"
echo "     b. Approve pool-v1 to spend your sBTC (if using mock token)"
echo "     c. Call pool-v1.deposit with a commitment"
echo ""
echo "  4. Update SDK configuration:"
echo "     Edit packages/sdk/src/config/testnet.ts and set TESTNET_DEPLOYER"
echo "     to your actual deployer address."
echo ""

log_ok "Deployment script complete."
echo ""
