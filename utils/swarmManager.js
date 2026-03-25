export class SwarmManager {
  constructor(totalChunks) {
    this.totalChunks = totalChunks;
    // Map of peerId -> Set of chunk indices they have
    this.peerBitfields = new Map();
  }

  addPeer(peerId) {
    if (!this.peerBitfields.has(peerId)) {
      this.peerBitfields.set(peerId, new Set());
    }
  }

  removePeer(peerId) {
    this.peerBitfields.delete(peerId);
  }

  // Handle incoming BITFIELD message
  updatePeerBitfield(peerId, chunkArray) {
    this.peerBitfields.set(peerId, new Set(chunkArray));
  }

  // Handle incoming HAVE message
  markPeerHasChunk(peerId, chunkIndex) {
    if (!this.peerBitfields.has(peerId)) {
      this.addPeer(peerId);
    }
    this.peerBitfields.get(peerId).add(chunkIndex);
  }

  // Get how many peers have a specific chunk (for rarest-first calculations)
  getChunkRarity(chunkIndex) {
    let count = 0;
    for (const [peerId, bitfield] of this.peerBitfields.entries()) {
      if (bitfield.has(chunkIndex)) count++;
    }
    return count;
  }

  // Return list of peers who have a specific chunk
  getPeersWithChunk(chunkIndex) {
    const peers = [];
    for (const [peerId, bitfield] of this.peerBitfields.entries()) {
      if (bitfield.has(chunkIndex)) peers.push(peerId);
    }
    return peers;
  }
}
