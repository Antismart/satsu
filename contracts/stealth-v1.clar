;; stealth-v1 - Stealth address meta-address registry for Satsu privacy pool
;;
;; This contract implements EIP-5564-style stealth address registration
;; adapted for the Stacks blockchain. Users publish their stealth
;; meta-addresses (a pair of compressed secp256k1 public keys: spend + view)
;; so that anyone can derive a one-time stealth address to send them
;; private payments through the Satsu shielded pool.
;;
;; The spend key controls fund ownership; the view key enables passive
;; payment detection without spending authority. Together they form a
;; "meta-address" - a stable identity from which unlimited ephemeral
;; stealth addresses can be derived client-side via ECDH.
;;
;; Optionally, users may link a .btc BNS name to their principal for
;; human-readable lookups (e.g., "alice.btc" -> meta-address).
;;
;; Error code range: 2000s (stealth module)
;; ---------------------------------------------------------------

;; --------------------
;; Error constants
;; --------------------

(define-constant ERR-NOT-AUTHORIZED (err u2001))
(define-constant ERR-INVALID-PUBKEY (err u2002))
(define-constant ERR-NO-META-ADDRESS (err u2003))
(define-constant ERR-NAME-ALREADY-LINKED (err u2004))
(define-constant ERR-PUBKEY-REQUIRED (err u2005))
(define-constant ERR-BNS-VERIFICATION-FAILED (err u2006))

;; Contract deployer
(define-constant CONTRACT-OWNER tx-sender)

;; --------------------
;; Compressed pubkey prefix bytes
;; --------------------

(define-constant COMPRESSED-EVEN 0x02)
(define-constant COMPRESSED-ODD 0x03)

;; --------------------
;; Data maps
;; --------------------

;; Meta-address: two compressed public keys (33 bytes each)
;; The spend-pubkey controls fund ownership at derived stealth addresses.
;; The view-pubkey enables passive scanning for incoming payments.
(define-map stealth-meta-addresses
  { owner: principal }
  {
    spend-pubkey: (buff 33),
    view-pubkey: (buff 33)
  }
)

;; Link .btc BNS names to principals for UX.
;; Names must be verified by an authorized verifier before they can be linked.
;; The verifier checks BNS ownership off-chain and attests on-chain.
(define-map btc-name-to-owner
  { name: (buff 48) }
  { owner: principal }
)

;; BNS ownership verification state.
;; An authorized verifier attests that a principal owns a given BNS name.
;; This is the oracle pattern -- the verifier service reads BNS state and
;; writes attestations that this contract can trust.
(define-data-var bns-verification-enabled bool false)

(define-map authorized-verifiers
  { verifier: principal }
  { authorized: bool }
)

;; Maps a BNS name to its verified owner (attested by a verifier).
;; Only verified names can be linked via link-btc-name.
(define-map verified-bns-names
  { name: (buff 48) }
  { owner: principal, verified-at: uint }
)

;; --------------------
;; Private helpers
;; --------------------

;; validate-compressed-pubkey: checks that a buffer is a valid
;; compressed secp256k1 public key (33 bytes, prefix 0x02 or 0x03).
;; Returns (ok true) on success, or ERR-INVALID-PUBKEY / ERR-PUBKEY-REQUIRED.
(define-private (validate-compressed-pubkey (pubkey (buff 33)))
  (let
    (
      (key-len (len pubkey))
      (prefix (element-at? pubkey u0))
    )
    ;; Must be exactly 33 bytes
    (asserts! (is-eq key-len u33) ERR-INVALID-PUBKEY)
    ;; Must have a readable first byte
    (asserts! (is-some prefix) ERR-PUBKEY-REQUIRED)
    ;; First byte must be 0x02 or 0x03
    (let
      (
        (prefix-byte (unwrap! prefix ERR-PUBKEY-REQUIRED))
      )
      (asserts!
        (or
          (is-eq prefix-byte COMPRESSED-EVEN)
          (is-eq prefix-byte COMPRESSED-ODD)
        )
        ERR-INVALID-PUBKEY
      )
      (ok true)
    )
  )
)

;; validate-meta-address-keys: validates both spend and view pubkeys.
;; Returns (ok true) if both are valid compressed keys.
(define-private (validate-meta-address-keys
    (spend-pubkey (buff 33))
    (view-pubkey (buff 33)))
  (begin
    (try! (validate-compressed-pubkey spend-pubkey))
    (try! (validate-compressed-pubkey view-pubkey))
    (ok true)
  )
)

;; --------------------
;; Public functions
;; --------------------

;; register-meta-address: publish a stealth meta-address for tx-sender.
;; This is a one-time public action that reveals nothing about future
;; payments. Anyone can then derive one-time stealth addresses for the
;; registrant using ECDH with the view key.
;;
;; Parameters:
;;   spend-pubkey - compressed secp256k1 public key (33 bytes, 0x02/0x03 prefix)
;;   view-pubkey  - compressed secp256k1 public key (33 bytes, 0x02/0x03 prefix)
;;
;; Returns: (ok true)
;; Errors: ERR-INVALID-PUBKEY (u2002), ERR-PUBKEY-REQUIRED (u2005)
(define-public (register-meta-address
    (spend-pubkey (buff 33))
    (view-pubkey (buff 33)))
  (begin
    ;; Validate both keys
    (try! (validate-meta-address-keys spend-pubkey view-pubkey))
    ;; Store meta-address keyed by tx-sender
    (map-set stealth-meta-addresses
      { owner: tx-sender }
      {
        spend-pubkey: spend-pubkey,
        view-pubkey: view-pubkey
      }
    )
    ;; Emit print event for off-chain indexers (scanner service)
    (print {
      event: "meta-address-registered",
      owner: tx-sender,
      spend-pubkey: spend-pubkey,
      view-pubkey: view-pubkey
    })
    (ok true)
  )
)

;; update-meta-address: replace an existing stealth meta-address.
;; The caller must already have a registered meta-address.
;; This is useful for key rotation without changing one's principal.
;;
;; Parameters:
;;   spend-pubkey - new compressed secp256k1 spend public key (33 bytes)
;;   view-pubkey  - new compressed secp256k1 view public key (33 bytes)
;;
;; Returns: (ok true)
;; Errors: ERR-NO-META-ADDRESS (u2003), ERR-INVALID-PUBKEY (u2002),
;;         ERR-PUBKEY-REQUIRED (u2005)
(define-public (update-meta-address
    (spend-pubkey (buff 33))
    (view-pubkey (buff 33)))
  (begin
    ;; Must already have a registered meta-address
    (asserts!
      (is-some (map-get? stealth-meta-addresses { owner: tx-sender }))
      ERR-NO-META-ADDRESS
    )
    ;; Validate both keys
    (try! (validate-meta-address-keys spend-pubkey view-pubkey))
    ;; Overwrite existing entry
    (map-set stealth-meta-addresses
      { owner: tx-sender }
      {
        spend-pubkey: spend-pubkey,
        view-pubkey: view-pubkey
      }
    )
    ;; Emit print event for off-chain indexers
    (print {
      event: "meta-address-updated",
      owner: tx-sender,
      spend-pubkey: spend-pubkey,
      view-pubkey: view-pubkey
    })
    (ok true)
  )
)

;; enable-bns-verification: toggle BNS verification on or off (owner only).
;; When enabled, link-btc-name requires a prior attestation from a verifier.
;; When disabled (default), names can be linked without verification (devnet).
;;
;; Returns: (ok true)
;; Errors: ERR-NOT-AUTHORIZED (u2001)
(define-public (enable-bns-verification (enabled bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set bns-verification-enabled enabled)
    (print { event: "bns-verification-toggled", enabled: enabled })
    (ok true)
  )
)

;; set-authorized-verifier: grant or revoke verifier privileges (owner only).
;; Verifiers can attest BNS name ownership on behalf of the protocol.
;;
;; Parameters:
;;   verifier   - principal to authorize/deauthorize
;;   authorized - true to grant, false to revoke
;;
;; Returns: (ok true)
;; Errors: ERR-NOT-AUTHORIZED (u2001)
(define-public (set-authorized-verifier (verifier principal) (authorized bool))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (map-set authorized-verifiers
      { verifier: verifier }
      { authorized: authorized }
    )
    (print {
      event: "verifier-updated",
      verifier: verifier,
      authorized: authorized
    })
    (ok true)
  )
)

;; verify-bns-name: attest that a principal owns a given BNS name.
;; Only callable by authorized verifiers. The verifier service reads BNS
;; state off-chain and writes attestations here.
;;
;; Parameters:
;;   name  - BNS name buffer (up to 48 bytes)
;;   owner - the principal who owns this name according to BNS
;;
;; Returns: (ok true)
;; Errors: ERR-NOT-AUTHORIZED (u2001)
(define-public (verify-bns-name (name (buff 48)) (owner principal))
  (begin
    (asserts!
      (default-to false
        (get authorized (map-get? authorized-verifiers { verifier: tx-sender })))
      ERR-NOT-AUTHORIZED
    )
    (map-set verified-bns-names
      { name: name }
      { owner: owner, verified-at: stacks-block-height }
    )
    (print {
      event: "bns-name-verified",
      name: name,
      owner: owner,
      verifier: tx-sender
    })
    (ok true)
  )
)

;; link-btc-name: associate a .btc BNS name with the caller's principal.
;; Enables human-readable lookups: "alice.btc" -> meta-address.
;; The caller must have a registered meta-address first.
;;
;; When BNS verification is enabled (production), the name must have been
;; verified by an authorized verifier attesting that tx-sender owns it.
;; When disabled (devnet), names can be linked without verification.
;;
;; Parameters:
;;   name - BNS name as a buffer (up to 48 bytes, e.g., 0x616c6963652e627463)
;;
;; Returns: (ok true)
;; Errors: ERR-NO-META-ADDRESS (u2003), ERR-NAME-ALREADY-LINKED (u2004),
;;         ERR-BNS-VERIFICATION-FAILED (u2006)
(define-public (link-btc-name (name (buff 48)))
  (begin
    ;; Caller must have a registered meta-address
    (asserts!
      (is-some (map-get? stealth-meta-addresses { owner: tx-sender }))
      ERR-NO-META-ADDRESS
    )
    ;; When BNS verification is enabled, require a verifier attestation
    (if (var-get bns-verification-enabled)
      (asserts!
        (match (map-get? verified-bns-names { name: name })
          verification (is-eq (get owner verification) tx-sender)
          false
        )
        ERR-BNS-VERIFICATION-FAILED
      )
      true
    )
    ;; Name must not already be linked to a different principal
    (match (map-get? btc-name-to-owner { name: name })
      existing-entry
        (asserts!
          (is-eq (get owner existing-entry) tx-sender)
          ERR-NAME-ALREADY-LINKED
        )
      true
    )
    ;; Store the name -> principal mapping
    (map-set btc-name-to-owner
      { name: name }
      { owner: tx-sender }
    )
    ;; Emit print event
    (print {
      event: "btc-name-linked",
      name: name,
      owner: tx-sender
    })
    (ok true)
  )
)

;; unlink-btc-name: remove the association between a .btc name and tx-sender.
;; Only the principal who linked the name can unlink it.
;;
;; Parameters:
;;   name - BNS name to unlink (must be currently linked to tx-sender)
;;
;; Returns: (ok true)
;; Errors: ERR-NOT-AUTHORIZED (u2001)
(define-public (unlink-btc-name (name (buff 48)))
  (let
    (
      (existing (map-get? btc-name-to-owner { name: name }))
    )
    ;; Name must be linked to tx-sender
    (asserts!
      (and
        (is-some existing)
        (is-eq (get owner (unwrap! existing ERR-NOT-AUTHORIZED)) tx-sender)
      )
      ERR-NOT-AUTHORIZED
    )
    ;; Remove the mapping
    (map-delete btc-name-to-owner { name: name })
    ;; Emit print event
    (print {
      event: "btc-name-unlinked",
      name: name,
      owner: tx-sender
    })
    (ok true)
  )
)

;; --------------------
;; Read-only functions
;; --------------------

;; get-meta-address: look up a stealth meta-address by principal.
;; Returns none if the principal has not registered.
;;
;; Parameters:
;;   owner - the principal to look up
;;
;; Returns: (optional { spend-pubkey: (buff 33), view-pubkey: (buff 33) })
(define-read-only (get-meta-address (owner principal))
  (map-get? stealth-meta-addresses { owner: owner })
)

;; get-meta-address-by-name: look up a stealth meta-address by .btc BNS name.
;; First resolves the name to a principal, then looks up the meta-address.
;; Returns none if the name is not linked or the principal has no meta-address.
;;
;; Parameters:
;;   name - BNS name buffer (up to 48 bytes)
;;
;; Returns: (optional { spend-pubkey: (buff 33), view-pubkey: (buff 33) })
(define-read-only (get-meta-address-by-name (name (buff 48)))
  (match (map-get? btc-name-to-owner { name: name })
    entry (get-meta-address (get owner entry))
    none
  )
)

;; has-meta-address: check whether a principal has a registered meta-address.
;;
;; Parameters:
;;   owner - the principal to check
;;
;; Returns: bool
(define-read-only (has-meta-address (owner principal))
  (is-some (map-get? stealth-meta-addresses { owner: owner }))
)

;; is-bns-verification-enabled: check if BNS verification is required.
(define-read-only (is-bns-verification-enabled)
  (var-get bns-verification-enabled)
)

;; is-authorized-verifier: check if a principal is an authorized BNS verifier.
(define-read-only (is-authorized-verifier (verifier principal))
  (default-to false
    (get authorized (map-get? authorized-verifiers { verifier: verifier })))
)

;; get-verified-bns-name: look up the verified owner of a BNS name.
;;
;; Returns: (optional { owner: principal, verified-at: uint })
(define-read-only (get-verified-bns-name (name (buff 48)))
  (map-get? verified-bns-names { name: name })
)
