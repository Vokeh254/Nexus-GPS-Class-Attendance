/**
 * Placeholder hook for future blockchain attestation integration.
 * Returns a stable no-op interface — isAvailable is always false.
 */
export function useBlockchainAttestation() {
  const attest = async (): Promise<void> => {
    // no-op placeholder
  };

  return {
    attest,
    txHash: null as string | null,
    isPending: false as const,
    isAvailable: false as const,
  };
}
