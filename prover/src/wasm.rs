// wasm.rs - WASM bindings for the Satsu STARK prover via wasm-bindgen
//
// These functions provide a JavaScript-friendly API for generating and verifying
// STARK proofs from the browser or Node.js.

use wasm_bindgen::prelude::*;
use winterfell::math::fields::f128::BaseElement;
use winterfell::math::FieldElement;
use winterfell::{FieldExtension, ProofOptions, Prover};

use crate::prover_impl::MembershipProver;
use crate::rescue::rescue_hash;
use crate::types::{SatsuPrivateInputs, SatsuPublicInputs};

/// Generate a STARK proof for a Merkle membership statement.
///
/// # Arguments
/// - `secret`: 16 bytes, the secret value (truncated to field element)
/// - `nullifier`: 16 bytes, the nullifier value (truncated to field element)
/// - `amount`: the deposit amount as u64
/// - `leaf_index`: the leaf position in the Merkle tree
/// - `merkle_path_flat`: flattened sibling hashes (N * 16 bytes, each 16 bytes is one field element)
/// - `path_indices`: N bytes, each 0 or 1
/// - `nullifier_hash`: 16 bytes, the nullifier hash as field element
/// - `root`: 16 bytes, the Merkle root as field element
/// - `recipient`: the recipient Stacks address
/// - `relayer_fee`: the relayer fee
///
/// # Returns
/// The serialized STARK proof as bytes, or an error.
#[wasm_bindgen]
pub fn generate_proof(
    secret: &[u8],
    nullifier: &[u8],
    _amount: u64,
    _leaf_index: u32,
    merkle_path_flat: &[u8],
    path_indices: &[u8],
    nullifier_hash: &[u8],
    root: &[u8],
    recipient: &str,
    relayer_fee: u64,
) -> Result<Vec<u8>, JsValue> {
    // Parse field elements from byte inputs
    let secret_elem = bytes_to_field_element(secret)?;
    let nullifier_elem = bytes_to_field_element(nullifier)?;

    // Compute commitment = rescue_hash(secret, nullifier)
    // (In the STARK-friendly version, we use Rescue-Prime instead of SHA-256)
    let commitment = rescue_hash(secret_elem, nullifier_elem);

    // Parse Merkle path
    let elem_size = 16; // Each field element is 16 bytes (u128)
    if merkle_path_flat.len() % elem_size != 0 {
        return Err(JsValue::from_str("merkle_path_flat length must be a multiple of 16"));
    }
    let merkle_depth = merkle_path_flat.len() / elem_size;

    if path_indices.len() != merkle_depth {
        return Err(JsValue::from_str("path_indices length must match merkle_path depth"));
    }

    let mut merkle_path = Vec::with_capacity(merkle_depth);
    for i in 0..merkle_depth {
        let start = i * elem_size;
        let end = start + elem_size;
        let bytes: [u8; 16] = merkle_path_flat[start..end]
            .try_into()
            .map_err(|_| JsValue::from_str("invalid merkle path element"))?;
        merkle_path.push(BaseElement::new(u128::from_be_bytes(bytes)));
    }

    let path_idx: Vec<BaseElement> = path_indices
        .iter()
        .map(|&b| {
            if b == 0 {
                BaseElement::ZERO
            } else {
                BaseElement::ONE
            }
        })
        .collect();

    let nullifier_hash_elem = bytes_to_field_element(nullifier_hash)?;
    let root_elem = bytes_to_field_element(root)?;
    let recipient_hash = crate::types::str_to_element(recipient);
    let relayer_fee_elem = BaseElement::new(relayer_fee as u128);

    let pub_inputs = SatsuPublicInputs {
        commitment,
        nullifier_hash: nullifier_hash_elem,
        root: root_elem,
        recipient_hash,
        relayer_fee: relayer_fee_elem,
    };

    let priv_inputs = SatsuPrivateInputs {
        commitment,
        merkle_path,
        path_indices: path_idx,
    };

    // Use moderate proof options for browser performance
    let options = ProofOptions::new(
        16,                     // num_queries
        4,                      // blowup_factor
        0,                      // grinding_factor
        FieldExtension::None,
        4,                      // FRI folding factor
        7,                      // FRI max remainder polynomial degree
    );

    let prover = MembershipProver::new(options, pub_inputs);
    let trace = prover.build_trace(&priv_inputs);

    let proof = prover
        .prove(trace)
        .map_err(|e| JsValue::from_str(&format!("Proof generation failed: {e}")))?;

    Ok(proof.to_bytes())
}

/// Verify a STARK proof for a Merkle membership statement.
///
/// # Arguments
/// - `proof_bytes`: the serialized STARK proof
/// - `commitment`: 16 bytes, the commitment as field element
/// - `nullifier_hash`: 16 bytes, the nullifier hash as field element
/// - `root`: 16 bytes, the Merkle root as field element
/// - `recipient`: the recipient Stacks address
/// - `relayer_fee`: the relayer fee
///
/// # Returns
/// `true` if the proof is valid, or an error.
#[wasm_bindgen]
pub fn verify_proof(
    proof_bytes: &[u8],
    commitment: &[u8],
    nullifier_hash: &[u8],
    root: &[u8],
    recipient: &str,
    relayer_fee: u64,
) -> Result<bool, JsValue> {
    let commitment_elem = bytes_to_field_element(commitment)?;
    let nullifier_hash_elem = bytes_to_field_element(nullifier_hash)?;
    let root_elem = bytes_to_field_element(root)?;
    let recipient_hash = crate::types::str_to_element(recipient);
    let relayer_fee_elem = BaseElement::new(relayer_fee as u128);

    let pub_inputs = SatsuPublicInputs {
        commitment: commitment_elem,
        nullifier_hash: nullifier_hash_elem,
        root: root_elem,
        recipient_hash,
        relayer_fee: relayer_fee_elem,
    };

    crate::verifier_impl::verify_proof_from_bytes(proof_bytes, pub_inputs)
        .map(|_| true)
        .map_err(|e| JsValue::from_str(&e))
}

/// Parse a byte slice into a field element (expects 16 bytes, big-endian u128).
fn bytes_to_field_element(bytes: &[u8]) -> Result<BaseElement, JsValue> {
    if bytes.len() < 16 {
        // Pad with leading zeros if shorter
        let mut padded = [0u8; 16];
        let start = 16 - bytes.len();
        padded[start..].copy_from_slice(bytes);
        Ok(BaseElement::new(u128::from_be_bytes(padded)))
    } else {
        let bytes: [u8; 16] = bytes[..16]
            .try_into()
            .map_err(|_| JsValue::from_str("invalid field element bytes"))?;
        Ok(BaseElement::new(u128::from_be_bytes(bytes)))
    }
}
