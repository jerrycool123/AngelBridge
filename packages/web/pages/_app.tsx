import { GoogleOAuthProvider } from '@react-oauth/google';
import { Session } from 'next-auth';
import { SessionProvider } from 'next-auth/react';

import 'bootstrap/dist/css/bootstrap.css';

import '../styles/globals.css';

import publicEnv from '../libs/public-env';

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppPropsWithLayout<{ session: Session } & Record<string, unknown>>) {
  const getLayout = Component.getLayout ?? ((page) => page);
  return (
    <SessionProvider session={session}>
      <GoogleOAuthProvider clientId={publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
        {getLayout(<Component {...pageProps} />)}
      </GoogleOAuthProvider>
    </SessionProvider>
  );
}
