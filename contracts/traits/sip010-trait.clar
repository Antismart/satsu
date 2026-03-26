;; sip010-trait - Standard SIP-010 fungible token trait
;;
;; This is the standard SIP-010 trait definition used by all fungible tokens
;; on Stacks. By accepting tokens via this trait, pool-v1 can work with both
;; the mock sbtc-token (devnet) and the real sBTC contract (testnet/mainnet)
;; without code changes.
;;
;; Reference: https://github.com/stacksgov/sips/blob/main/sips/sip-010/sip-010-fungible-token-standard.md

(define-trait sip010-ft-trait
  (
    ;; Transfer from the caller to a new principal
    (transfer (uint principal principal (optional (buff 34))) (response bool uint))

    ;; The human readable name of the token
    (get-name () (response (string-ascii 32) uint))

    ;; The ticker symbol
    (get-symbol () (response (string-ascii 32) uint))

    ;; The number of decimals used
    (get-decimals () (response uint uint))

    ;; The balance of the passed principal
    (get-balance (principal) (response uint uint))

    ;; The current total supply
    (get-total-supply () (response uint uint))

    ;; An optional URI for token metadata
    (get-token-uri () (response (optional (string-utf8 256)) uint))
  )
)
