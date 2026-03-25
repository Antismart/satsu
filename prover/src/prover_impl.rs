// prover_impl.rs - STARK prover implementation for the Satsu Merkle membership proof
//
// This module implements the Winterfell `Prover` trait for the Satsu membership circuit.
// It builds the execution trace from the private inputs and generates a STARK proof.

use winterfell::{
    crypto::{hashers::Blake3_256, DefaultRandomCoin, MerkleTree},
    math::fields::f128::BaseElement,
    math::FieldElement,
    matrix::ColMatrix,
    AuxRandElements, CompositionPoly, CompositionPolyTrace,
    ConstraintCompositionCoefficients, DefaultConstraintCommitment, DefaultConstraintEvaluator,
    DefaultTraceLde, FieldExtension, PartitionOptions, Proof, ProofOptions, Prover, StarkDomain,
    TraceInfo, TracePolyTable, TraceTable,
};

use crate::air::{TRACE_WIDTH, trace_length_for_depth};
use crate::rescue::rescue_hash;
use crate::types::{SatsuPublicInputs, SatsuPrivateInputs};

use crate::air::MembershipAir;

/// The Satsu Merkle membership prover.
pub struct MembershipProver {
    options: ProofOptions,
    /// Public inputs that will be embedded in the proof.
    pub_inputs: SatsuPublicInputs,
}

impl MembershipProver {
    /// Create a new prover with the given proof options and public inputs.
    pub fn new(options: ProofOptions, pub_inputs: SatsuPublicInputs) -> Self {
        Self { options, pub_inputs }
    }

    /// Create a prover with default proof options suitable for ~96-bit security.
    pub fn with_default_options(pub_inputs: SatsuPublicInputs) -> Self {
        let options = ProofOptions::new(
            32,                     // num_queries
            8,                      // blowup_factor
            0,                      // grinding_factor
            FieldExtension::None,   // no field extension needed for f128
            8,                      // FRI folding factor
            31,                     // FRI max remainder polynomial degree
        );
        Self { options, pub_inputs }
    }

    /// Build the execution trace from private inputs.
    ///
    /// The trace has 3 columns and one row per Merkle level:
    /// - Col 0: hash accumulator (starts with commitment, ends with root)
    /// - Col 1: sibling hash at each level
    /// - Col 2: path index bit (0 or 1)
    ///
    /// Padding rows repeat the root value with zero siblings and bits.
    pub fn build_trace(&self, private_inputs: &SatsuPrivateInputs) -> TraceTable<BaseElement> {
        let merkle_depth = private_inputs.merkle_path.len();
        let trace_length = trace_length_for_depth(merkle_depth);

        // Encode merkle_depth in trace metadata
        let meta = (merkle_depth as u32).to_le_bytes().to_vec();

        let mut trace = TraceTable::with_meta(TRACE_WIDTH, trace_length, meta);

        // Pre-compute the hash chain
        let commitment = private_inputs.commitment;
        let merkle_path = &private_inputs.merkle_path;
        let path_indices = &private_inputs.path_indices;

        let mut hash_chain = Vec::with_capacity(merkle_depth + 1);
        hash_chain.push(commitment);

        let mut current = commitment;
        for level in 0..merkle_depth {
            let sibling = merkle_path[level];
            let is_right = path_indices[level] != BaseElement::ZERO;

            let (left, right) = if is_right {
                (sibling, current)
            } else {
                (current, sibling)
            };

            let hash_result = rescue_hash(left, right);
            hash_chain.push(hash_result);
            current = hash_result;
        }

        let root = *hash_chain.last().unwrap();

        // Fill the trace
        trace.fill(
            |state| {
                // Row 0: commitment with first sibling and bit
                state[0] = commitment;
                state[1] = if !merkle_path.is_empty() {
                    merkle_path[0]
                } else {
                    BaseElement::ZERO
                };
                state[2] = if !path_indices.is_empty() {
                    path_indices[0]
                } else {
                    BaseElement::ZERO
                };
            },
            |step, state| {
                let row = step + 1; // Current row being filled

                if row <= merkle_depth {
                    if row < merkle_depth {
                        // Active row: hash result from previous level, new sibling and bit
                        state[0] = hash_chain[row];
                        state[1] = merkle_path[row];
                        state[2] = path_indices[row];
                    } else {
                        // row == merkle_depth: the root row
                        state[0] = root;
                        state[1] = BaseElement::ZERO;
                        state[2] = BaseElement::ZERO;
                    }
                } else {
                    // Padding: repeat root
                    state[0] = root;
                    state[1] = BaseElement::ZERO;
                    state[2] = BaseElement::ZERO;
                }
            },
        );

        trace
    }

    /// Generate a STARK proof from private inputs.
    pub fn generate_proof(
        &self,
        private_inputs: &SatsuPrivateInputs,
    ) -> Result<Proof, String> {
        let trace = self.build_trace(private_inputs);
        self.prove(trace).map_err(|e| format!("Proof generation failed: {e}"))
    }
}

// Implement the Winterfell Prover trait
impl Prover for MembershipProver {
    type BaseField = BaseElement;
    type Air = MembershipAir;
    type Trace = TraceTable<Self::BaseField>;
    type HashFn = Blake3_256<Self::BaseField>;
    type VC = MerkleTree<Self::HashFn>;
    type RandomCoin = DefaultRandomCoin<Self::HashFn>;
    type TraceLde<E: FieldElement<BaseField = Self::BaseField>> =
        DefaultTraceLde<E, Self::HashFn, Self::VC>;
    type ConstraintCommitment<E: FieldElement<BaseField = Self::BaseField>> =
        DefaultConstraintCommitment<E, Self::HashFn, Self::VC>;
    type ConstraintEvaluator<'a, E: FieldElement<BaseField = Self::BaseField>> =
        DefaultConstraintEvaluator<'a, Self::Air, E>;

    fn get_pub_inputs(&self, _trace: &Self::Trace) -> SatsuPublicInputs {
        self.pub_inputs.clone()
    }

    fn options(&self) -> &ProofOptions {
        &self.options
    }

    fn new_trace_lde<E: FieldElement<BaseField = Self::BaseField>>(
        &self,
        trace_info: &TraceInfo,
        main_trace: &ColMatrix<Self::BaseField>,
        domain: &StarkDomain<Self::BaseField>,
        partition_option: PartitionOptions,
    ) -> (Self::TraceLde<E>, TracePolyTable<E>) {
        DefaultTraceLde::new(trace_info, main_trace, domain, partition_option)
    }

    fn build_constraint_commitment<E: FieldElement<BaseField = Self::BaseField>>(
        &self,
        composition_poly_trace: CompositionPolyTrace<E>,
        num_constraint_composition_columns: usize,
        domain: &StarkDomain<Self::BaseField>,
        partition_options: PartitionOptions,
    ) -> (Self::ConstraintCommitment<E>, CompositionPoly<E>) {
        DefaultConstraintCommitment::new(
            composition_poly_trace,
            num_constraint_composition_columns,
            domain,
            partition_options,
        )
    }

    fn new_evaluator<'a, E: FieldElement<BaseField = Self::BaseField>>(
        &self,
        air: &'a Self::Air,
        aux_rand_elements: Option<AuxRandElements<E>>,
        composition_coefficients: ConstraintCompositionCoefficients<E>,
    ) -> Self::ConstraintEvaluator<'a, E> {
        DefaultConstraintEvaluator::new(air, aux_rand_elements, composition_coefficients)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use winterfell::Trace;

    fn make_test_inputs() -> (SatsuPublicInputs, SatsuPrivateInputs) {
        // Use leaf_index=5 (binary 101) to get mixed path bits [1, 0, 1, 0]
        let secret = BaseElement::new(0xDEADBEEF);
        let nullifier = BaseElement::new(0xCAFEBABE);
        let commitment = rescue_hash(secret, nullifier);

        let depth = 4;
        let leaf_index = 5;
        let num_leaves = 1 << depth;
        let mut leaves = Vec::with_capacity(num_leaves);
        for i in 0..num_leaves {
            if i == leaf_index {
                leaves.push(commitment);
            } else {
                leaves.push(rescue_hash(
                    BaseElement::new(i as u128),
                    BaseElement::new(i as u128),
                ));
            }
        }

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

        let mut merkle_path = Vec::new();
        let mut path_indices = Vec::new();
        let mut index = leaf_index;

        for level in 0..depth {
            let sibling_index = if index % 2 == 0 { index + 1 } else { index - 1 };
            merkle_path.push(tree[level][sibling_index]);
            path_indices.push(if index % 2 == 0 {
                BaseElement::ZERO
            } else {
                BaseElement::ONE
            });
            index /= 2;
        }

        let nullifier_hash = rescue_hash(nullifier, BaseElement::ZERO);
        let recipient_hash = BaseElement::new(0x1234);
        let relayer_fee = BaseElement::new(0);

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

        (pub_inputs, priv_inputs)
    }

    #[test]
    fn test_build_trace() {
        let (pub_inputs, priv_inputs) = make_test_inputs();
        let prover = MembershipProver::with_default_options(pub_inputs);
        let trace = prover.build_trace(&priv_inputs);

        assert_eq!(trace.width(), TRACE_WIDTH);
        assert!(trace.length().is_power_of_two());
        assert!(trace.length() >= 5); // depth 4 + 1
    }

    #[test]
    fn test_proof_generation_and_verification() {
        let (pub_inputs, priv_inputs) = make_test_inputs();

        let options = ProofOptions::new(
            1,                      // num_queries (minimum for testing)
            2,                      // blowup_factor (minimum)
            0,                      // grinding_factor
            FieldExtension::None,
            2,                      // FRI folding factor
            1,                      // FRI max remainder polynomial degree
        );

        let prover = MembershipProver::new(options, pub_inputs.clone());
        let trace = prover.build_trace(&priv_inputs);
        let proof = prover.prove(trace).expect("proof generation should succeed");

        let result = crate::verifier_impl::verify_membership_proof(proof, pub_inputs);
        assert!(result.is_ok(), "proof verification should succeed: {:?}", result.err());
    }
}
