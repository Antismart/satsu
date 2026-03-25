;; sbtc-token — Mock SIP-010 compliant sBTC token for devnet testing
;; This contract simulates the sBTC token for local development and testing.
;; On testnet/mainnet, the real sBTC contract address is used instead.

(define-constant CONTRACT-OWNER tx-sender)

;; Error codes
(define-constant ERR-NOT-AUTHORIZED (err u5001))
(define-constant ERR-INSUFFICIENT-BALANCE (err u5002))
(define-constant ERR-INSUFFICIENT-ALLOWANCE (err u5003))

;; SIP-010 trait implementation
(define-fungible-token sbtc)

;; Token metadata
(define-data-var token-name (string-ascii 32) "sBTC")
(define-data-var token-symbol (string-ascii 10) "sBTC")
(define-data-var token-uri (optional (string-utf8 256)) none)
(define-constant TOKEN-DECIMALS u8)

;; Allowance map (for pool contract approval pattern)
(define-map allowances
  { owner: principal, spender: principal }
  { amount: uint }
)

;; SIP-010 functions

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (or (is-eq tx-sender sender) (is-eq contract-caller sender)
                  (>= (get-allowance sender tx-sender) amount))
              ERR-NOT-AUTHORIZED)
    ;; Deduct allowance if spending on behalf
    (if (and (not (is-eq tx-sender sender)) (not (is-eq contract-caller sender)))
      (set-allowance sender tx-sender (- (get-allowance sender tx-sender) amount))
      true
    )
    (try! (ft-transfer? sbtc amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

(define-read-only (get-name)
  (ok (var-get token-name))
)

(define-read-only (get-symbol)
  (ok (var-get token-symbol))
)

(define-read-only (get-decimals)
  (ok TOKEN-DECIMALS)
)

(define-read-only (get-balance (account principal))
  (ok (ft-get-balance sbtc account))
)

(define-read-only (get-total-supply)
  (ok (ft-get-supply sbtc))
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; Allowance functions (for pool approval pattern)

(define-public (approve (spender principal) (amount uint))
  (begin
    (set-allowance tx-sender spender amount)
    (ok true)
  )
)

(define-read-only (get-allowance-of (owner principal) (spender principal))
  (ok (get-allowance owner spender))
)

;; Private helpers

(define-private (get-allowance (owner principal) (spender principal))
  (default-to u0 (get amount (map-get? allowances { owner: owner, spender: spender })))
)

(define-private (set-allowance (owner principal) (spender principal) (amount uint))
  (map-set allowances { owner: owner, spender: spender } { amount: amount })
)

;; Mint function (devnet only — for testing)
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (ft-mint? sbtc amount recipient)
  )
)
