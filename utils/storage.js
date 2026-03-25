import localforage from 'localforage';

localforage.config({
  name: 'ZapTransfer',
  storeName: 'chunks_storage',
  description: 'Stores file chunks for multi-file resume capability'
});

export const StorageManager = {
  /**
   * Save a chunk arraybuffer (keyed by transferId + fileIndex + chunkIndex)
   */
  saveChunk: async (transferId, fileIndex, chunkIndex, arrayBuffer) => {
    const key = `${transferId}_f${fileIndex}_c${chunkIndex}`;
    await localforage.setItem(key, arrayBuffer);
  },

  /**
   * Get a chunk arraybuffer
   */
  getChunk: async (transferId, fileIndex, chunkIndex) => {
    const key = `${transferId}_f${fileIndex}_c${chunkIndex}`;
    return await localforage.getItem(key);
  },

  /**
   * Save metadata for all files in this transfer
   */
  saveMetadata: async (transferId, metadata) => {
    const key = `${transferId}_meta`;
    await localforage.setItem(key, metadata);
  },

  getMetadata: async (transferId) => {
    const key = `${transferId}_meta`;
    return await localforage.getItem(key);
  },

  /**
   * Get available chunk indices for a specific file in the transfer
   */
  getAvailableChunks: async (transferId, fileIndex) => {
    const available = [];
    const keys = await localforage.keys();
    const prefix = `${transferId}_f${fileIndex}_c`;
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        const idx = parseInt(key.replace(prefix, ''), 10);
        if (!isNaN(idx)) {
          available.push(idx);
        }
      }
    }
    return available.sort((a, b) => a - b);
  },

  /**
   * Cleanup all data for a transfer
   */
  deleteTransferId: async (transferId) => {
    const keys = await localforage.keys();
    for (const key of keys) {
      if (key.startsWith(`${transferId}_`)) {
        await localforage.removeItem(key);
      }
    }
  }
};
