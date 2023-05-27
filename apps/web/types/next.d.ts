/* eslint-disable @typescript-eslint/no-explicit-any */

// eslint-disable-next-line @typescript-eslint/ban-types
type NextPageWithLayout<P = {}, IP = P> = import('next').NextPage<P, IP> & {
  getLayout?: (page: import('react').ReactElement) => import('react').ReactNode;
};

type AppPropsWithLayout<P> = import('next/app').AppProps<P> & {
  Component: NextPageWithLayout;
};
