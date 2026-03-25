// 1MB chunks for stable datachannel transfers
export const CHUNK_SIZE = 1024 * 1024; 

/**
 * Encode a chunk with fileIndex and chunkIndex headers.
 * Format: [2 bytes fileIndex (uint16 LE) | 4 bytes chunkIndex (uint32 LE) | data]
 * @param {number} fileIndex
 * @param {number} chunkIndex 
 * @param {ArrayBuffer} buffer 
 * @returns {ArrayBuffer}
 */
export const encodeChunk = (fileIndex, chunkIndex, buffer) => {
  const header = new ArrayBuffer(6);
  const dv = new DataView(header);
  dv.setUint16(0, fileIndex, true);
  dv.setUint32(2, chunkIndex, true);

  const combined = new Uint8Array(6 + buffer.byteLength);
  combined.set(new Uint8Array(header), 0);
  combined.set(new Uint8Array(buffer), 6);
  
  return combined.buffer;
};

/**
 * Decode a chunk buffer into fileIndex, chunkIndex, and data
 * @param {ArrayBuffer} buffer 
 * @returns {{ fileIndex: number, chunkIndex: number, data: ArrayBuffer }}
 */
export const decodeChunk = (buffer) => {
  const dv = new DataView(buffer, 0, 6);
  const fileIndex = dv.getUint16(0, true);
  const chunkIndex = dv.getUint32(2, true);
  const data = buffer.slice(6);
  return { fileIndex, chunkIndex, data };
};

export const MathUtils = {
  calculateChunks: (fileSize) => {
    return Math.ceil(fileSize / CHUNK_SIZE);
  }
};

/**
 * SHA-256 hashing utilities using Web Crypto API
 */
export const CryptoUtils = {
  hashBlob: async (blob) => {
    const SAFE_SLICE_LIMIT = 5 * 1024 * 1024;
    let bufferToHash;
    
    if (blob.size <= SAFE_SLICE_LIMIT * 2) {
      bufferToHash = await blob.arrayBuffer();
    } else {
      const head = await blob.slice(0, SAFE_SLICE_LIMIT).arrayBuffer();
      const tail = await blob.slice(blob.size - SAFE_SLICE_LIMIT, blob.size).arrayBuffer();
      const combined = new Uint8Array(head.byteLength + tail.byteLength);
      combined.set(new Uint8Array(head), 0);
      combined.set(new Uint8Array(tail), head.byteLength);
      bufferToHash = combined.buffer;
    }

    const hashBuffer = await crypto.subtle.digest('SHA-256', bufferToHash);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return `${hashHex}-${blob.size}`;
  },
  
  hashChunk: async (arrayBuffer) => {
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
};
