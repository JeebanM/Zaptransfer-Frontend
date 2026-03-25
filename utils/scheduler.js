export class Scheduler {
  constructor(swarmManager) {
    this.swarmManager = swarmManager;
    // Track chunks currently being requested so we don't ask multiple peers for the same chunk
    this.inFlightRequests = new Set();
  }

  /**
   * Determine the next rarest chunk to request
   * @param {Array<number>} missingChunks - List of chunk indices we still need
   * @param {string} specificPeerId - Optional, if we only want a chunk this peer has
   * @returns {number | null} chunkIndex to request
   */
  getNextChunk(missingChunks, specificPeerId = null) {
    let candidateChunks = missingChunks.filter(idx => !this.inFlightRequests.has(idx));

    if (candidateChunks.length === 0) return null;

    if (specificPeerId) {
      // Filter candidates to only those the peer actually possesses
      const peerSet = this.swarmManager.peerBitfields.get(specificPeerId);
      if (peerSet) {
         candidateChunks = candidateChunks.filter(idx => peerSet.has(idx));
      }
    }

    if (candidateChunks.length === 0) return null;

    // Sort by rarity: ascending order of how many peers possess the chunk
    // Rarest-first ensures the swarm doesn't bottleneck on a single rare chunk at the end
    candidateChunks.sort((a, b) => {
      return this.swarmManager.getChunkRarity(a) - this.swarmManager.getChunkRarity(b);
    });

    // Pick the most rare
    return candidateChunks[0];
  }

  markRequested(chunkIndex) {
    this.inFlightRequests.add(chunkIndex);
  }

  clearRequest(chunkIndex) {
    this.inFlightRequests.delete(chunkIndex);
  }
}
