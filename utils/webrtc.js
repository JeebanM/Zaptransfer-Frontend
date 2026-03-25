export const createPeerConnection = (iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' }
]) => {
  return new RTCPeerConnection({ iceServers });
};

export const waitForDrain = (channel, targetAmount = 0) => {
  return new Promise((resolve) => {
    // If the buffer is already drained below the threshold, resolve immediately
    if (channel.bufferedAmount <= targetAmount) {
      resolve();
      return;
    }

    // Set an event listener for when the buffer hits the threshold
    const initialHandler = channel.onbufferedamountlow;
    
    channel.onbufferedamountlow = () => {
      // Restore the old handler if any
      channel.onbufferedamountlow = initialHandler;
      
      resolve();
      
      // If there was an old handler, trigger it sequentially
      if (initialHandler) initialHandler();
    };
  });
};
