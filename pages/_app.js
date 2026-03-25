import "@/styles/globals.css";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        {/* Google Site Verification */}
        <meta
          name="google-site-verification"
          content="4Klq89JtcGdB5adRxgxwLPOiW_RpU_SnXrrbyHHoRAY"
        />

        {/* Basic SEO (recommended) */}
        <title>ZapTransfer - QR File Sharing</title>
        <meta
          name="description"
          content="Fast QR-based file sharing with face recognition. Upload, scan, and find your photos instantly."
        />

        {/* Mobile responsiveness */}
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <Component {...pageProps} />
    </>
  );
}