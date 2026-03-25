import Head from 'next/head';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getLoginUrl, isLoggedIn, setToken } from '@/utils/auth';
import { LogIn, Shield, Zap, QrCode } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if already logged in
    if (isLoggedIn()) {
      router.replace('/');
      return;
    }

    // Check for token in URL (redirect from OAuth callback)
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      router.replace('/');
      return;
    }

    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <Head>
        <title>Login - ZapTransfer</title>
        <meta name="description" content="Login to ZapTransfer — secure P2P file sharing via QR codes" />
      </Head>

      <main className="w-full max-w-md flex flex-col items-center text-center space-y-10">
        {/* Logo */}
        <div className="space-y-4">
          <div className="flex items-center justify-center space-x-3">
            <Zap className="w-10 h-10 text-blue-400" />
            <h1 className="text-4xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
              ZapTransfer
            </h1>
          </div>
          <p className="text-slate-400 text-lg">
            Secure P2P file sharing via QR codes
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full glass-card p-8 rounded-3xl space-y-8">
          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-center space-x-4 text-left">
              <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <QrCode className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-slate-200 font-medium">QR Code Sharing</p>
                <p className="text-sm text-slate-400">Upload files, scan QR, receive instantly</p>
              </div>
            </div>
            <div className="flex items-center space-x-4 text-left">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-slate-200 font-medium">End-to-End Encrypted</p>
                <p className="text-sm text-slate-400">Direct P2P transfer, no server storage</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-700/50 pt-6">
            <a
              href={getLoginUrl()}
              className="flex items-center justify-center space-x-3 w-full py-4 px-6 bg-white hover:bg-gray-100 text-slate-900 font-semibold rounded-2xl transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continue with Google</span>
            </a>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          By logging in, you agree to share files securely via peer-to-peer connections.
        </p>
      </main>
    </div>
  );
}
