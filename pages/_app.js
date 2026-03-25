import "@/styles/globals.css";
import Head from "next/head";

export default function App({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="google-site-verification" content="4Klq89JtcGdB5adRxgxwLPOiW_RpU_SnXrrbyHHoRAY" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
