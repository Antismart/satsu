// lib.rs - Satsu ZK-STARK Prover
//
// This crate implements a ZK-STARK prover for Satsu's privacy pool Merkle membership proofs.
// It uses the Winterfell library for the STARK protocol and Rescue-Prime as the
// STARK-friendly hash function.
//
// Architecture:
// - The on-chain Merkle tree uses SHA-256 (defined in contracts/merkle-tree.clar)
// - The STARK proof uses Rescue-Prime internally (efficient arithmetization)
// - A SHA-256 bridge layer connects the two (binding commitment)
//
// This is the same approach used by StarkNet/Cairo: use a STARK-friendly hash
// for the proof system, and bridge to the application hash (SHA-256) externally.
//
// Modules:
// - rescue: Rescue-Prime hash implementation over the Winterfell f128 field
// - types: Shared types for public/private inputs and byte<->field conversions
// - air: Algebraic Intermediate Representation (constraint system)
// - prover_impl: STARK prover implementation (execution trace + Winterfell Prover trait)
// - verifier_impl: STARK verifier (wraps Winterfell's verify function)
// - wasm: WASM bindings for browser/Node.js usage

pub mod rescue;
pub mod types;
pub mod air;
pub mod prover_impl;
pub mod verifier_impl;
pub mod wasm;

// Re-export key types for convenience
pub use prover_impl::MembershipProver;
pub use types::{SatsuPublicInputs, SatsuPrivateInputs};
pub use rescue::rescue_hash;

#[cfg(test)]
mod tests {
    use super::*;
    use winterfell::math::fields::f128::BaseElement;
    use winterfell::math::FieldElement;
    use winterfell::{FieldExtension, ProofOptions, Prover};

    /// Build a test Merkle tree of given depth and return (commitment, root, path, indices)
    /// for a leaf at the given index. Using a non-zero leaf index ensures mixed path bits,
    /// which is required for the AIR constraints to produce non-trivial polynomials.
    fn build_test_tree(
        depth: usize,
        leaf_index: usize,
    ) -> (BaseElement, BaseElement, Vec<BaseElement>, Vec<BaseElement>) {
        let num_leaves = 1usize << depth;
        assert!(leaf_index < num_leaves, "leaf_index out of range");

        // Create leaves
        let secret = BaseElement::new(42);
        let nullifier = BaseElement::new(1337);
        let commitment = rescue_hash(secret, nullifier);

        let mut leaves = Vec::with_capacity(num_leaves);
        for i in 0..num_leaves {
            if i == leaf_index {
                leaves.push(commitment);
            } else {
                leaves.push(rescue_hash(
                    BaseElement::new(i as u128 + 100),
                    BaseElement::new(i as u128 + 200),
                ));
            }
        }

        // Build the tree bottom-up
        let mut tree: Vec<Vec<BaseElement>> = Vec::new();
        tree.push(leaves);

        for level in 0..depth {
            let prev = &tree[level];
            let mut next_level = Vec::new();
            for pair in prev.chunks(2) {
                next_level.push(rescue_hash(pair[0], pair[1]));
            }
            tree.push(next_level);
        }

        let root = tree[depth][0];

        // Extract Merkle path for the given leaf index
        let mut merkle_path = Vec::new();
        let mut path_indices = Vec::new();
        let mut index = leaf_index;

        for level in 0..depth {
            let sibling_index = if index % 2 == 0 { index + 1 } else { index - 1 };
            merkle_path.push(tree[level][sibling_index]);
            // bit = 1 means "current node is the right child" (sibling is left)
            path_indices.push(if index % 2 == 0 {
                BaseElement::ZERO // current is left child
            } else {
                BaseElement::ONE // current is right child
            });
            index /= 2;
        }

        (commitment, root, merkle_path, path_indices)
    }

    #[test]
    fn test_rescue_hash_consistency() {
        let a = BaseElement::new(1);
        let b = BaseElement::new(2);
        let h1 = rescue_hash(a, b);
        let h2 = rescue_hash(a, b);
        assert_eq!(h1, h2);

        let h3 = rescue_hash(b, a);
        assert_ne!(h1, h3);
    }

    #[test]
    fn test_merkle_tree_construction() {
        let (commitment, root, path, indices) = build_test_tree(4, 5);

        // Verify the path manually
        let mut current = commitment;
        for i in 0..path.len() {
            let is_right = indices[i] != BaseElement::ZERO;
            let (left, right) = if is_right {
                (path[i], current)
            } else {
                (current, path[i])
            };
            current = rescue_hash(left, right);
        }
        assert_eq!(current, root, "Merkle path verification should produce the root");
    }

    #[test]
    fn test_end_to_end_proof_depth_2() {
        // leaf_index=3 (binary 11) gives bits [1, 1]
        run_end_to_end_test(2, 3);
    }

    #[test]
    fn test_end_to_end_proof_depth_4() {
        // leaf_index=5 (binary 0101) gives bits [1, 0, 1, 0]
        run_end_to_end_test(4, 5);
    }

    #[test]
    fn test_end_to_end_proof_depth_8() {
        // leaf_index=170 (binary 10101010) gives mixed bits
        run_end_to_end_test(8, 170);
    }

    fn run_end_to_end_test(depth: usize, leaf_index: usize) {
        let (commitment, root, merkle_path, path_indices) = build_test_tree(depth, leaf_index);

        let nullifier_hash = rescue_hash(BaseElement::new(1337), BaseElement::ZERO);
        let recipient_hash = BaseElement::new(0x5555);
        let relayer_fee = BaseElement::ZERO;

        let pub_inputs = SatsuPublicInputs {
            commitment,
            nullifier_hash,
            root,
            recipient_hash,
            relayer_fee,
        };

        let priv_inputs = SatsuPrivateInputs {
            commitment,
            merkle_path,
            path_indices,
        };

        // Use minimal options for fast testing
        let options = ProofOptions::new(
            1,  // num_queries
            2,  // blowup_factor
            0,  // grinding_factor
            FieldExtension::None,
            2,  // FRI folding factor
            1,  // FRI max remainder polynomial degree
        );

        let prover = MembershipProver::new(options, pub_inputs.clone());
        let trace = prover.build_trace(&priv_inputs);

        // Generate proof
        let proof = prover.prove(trace).expect("proof generation should succeed");
        let proof_size = proof.to_bytes().len();
        eprintln!("Proof size for depth {depth}: {proof_size} bytes");

        // Verify proof
        let result = verifier_impl::verify_membership_proof(proof, pub_inputs);
        assert!(result.is_ok(), "verification failed for depth {depth}: {:?}", result.err());
    }

    #[test]
    fn test_wrong_root_fails_verification() {
        let (commitment, root, merkle_path, path_indices) = build_test_tree(4, 5);

        let pub_inputs = SatsuPublicInputs {
            commitment,
            nullifier_hash: rescue_hash(BaseElement::new(1337), BaseElement::ZERO),
            root,
            recipient_hash: BaseElement::new(0x5555),
            relayer_fee: BaseElement::ZERO,
        };

        let priv_inputs = SatsuPrivateInputs {
            commitment,
            merkle_path,
            path_indices,
        };

        let options = ProofOptions::new(1, 2, 0, FieldExtension::None, 2, 1);
        let prover = MembershipProver::new(options, pub_inputs.clone());
        let trace = prover.build_trace(&priv_inputs);
        let proof = prover.prove(trace).expect("proof generation should succeed");

        // Tamper with the root
        let mut bad_inputs = pub_inputs;
        bad_inputs.root = BaseElement::new(0xDEAD);

        let result = verifier_impl::verify_membership_proof(proof, bad_inputs);
        assert!(result.is_err(), "verification should fail with wrong root");
    }

    #[test]
    fn test_wrong_commitment_fails_verification() {
        let (commitment, root, merkle_path, path_indices) = build_test_tree(4, 5);

        let pub_inputs = SatsuPublicInputs {
            commitment,
            nullifier_hash: rescue_hash(BaseElement::new(1337), BaseElement::ZERO),
            root,
            recipient_hash: BaseElement::new(0x5555),
            relayer_fee: BaseElement::ZERO,
        };

        let priv_inputs = SatsuPrivateInputs {
            commitment,
            merkle_path,
            path_indices,
        };

        let options = ProofOptions::new(1, 2, 0, FieldExtension::None, 2, 1);
        let prover = MembershipProver::new(options, pub_inputs.clone());
        let trace = prover.build_trace(&priv_inputs);
        let proof = prover.prove(trace).expect("proof generation should succeed");

        // Tamper with the commitment
        let mut bad_inputs = pub_inputs;
        bad_inputs.commitment = BaseElement::new(0xBEEF);

        let result = verifier_impl::verify_membership_proof(proof, bad_inputs);
        assert!(result.is_err(), "verification should fail with wrong commitment");
    }

    #[test]
    fn test_proof_serialization_roundtrip() {
        let (commitment, root, merkle_path, path_indices) = build_test_tree(4, 5);

        let pub_inputs = SatsuPublicInputs {
            commitment,
            nullifier_hash: rescue_hash(BaseElement::new(1337), BaseElement::ZERO),
            root,
            recipient_hash: BaseElement::new(0x5555),
            relayer_fee: BaseElement::ZERO,
        };

        let priv_inputs = SatsuPrivateInputs {
            commitment,
            merkle_path,
            path_indices,
        };

        let options = ProofOptions::new(1, 2, 0, FieldExtension::None, 2, 1);
        let prover = MembershipProver::new(options, pub_inputs.clone());
        let trace = prover.build_trace(&priv_inputs);
        let proof = prover.prove(trace).expect("proof generation should succeed");

        // Serialize
        let bytes = proof.to_bytes();
        assert!(!bytes.is_empty());

        // Deserialize and verify
        let result = verifier_impl::verify_proof_from_bytes(&bytes, pub_inputs);
        assert!(result.is_ok(), "verification from bytes failed: {:?}", result.err());
    }
}
