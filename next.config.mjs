/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,
  
  // Proxy API and WebSocket requests to the signaling server
  // This lets us use a SINGLE ngrok tunnel (for port 3000) that covers everything
  async rewrites() {
    const signalingServer = process.env.SIGNALING_SERVER_INTERNAL || process.env.NEXT_PUBLIC_SIGNALING_SERVER || 'http://localhost:10000';
    return [
      {
        source: '/api/:path*',
        destination: `${signalingServer}/api/:path*`
      },
      {
        source: '/auth/:path*',
        destination: `${signalingServer}/auth/:path*`
      },
      {
        source: '/socket.io/:path*',
        destination: `${signalingServer}/socket.io/:path*`
      },
      {
        source: '/health',
        destination: `${signalingServer}/health`
      }
    ];
  }
};

export default nextConfig;
