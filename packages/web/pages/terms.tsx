import { GetStaticProps } from 'next';
import Link from 'next/link';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';

import styles from '../styles/Markdown.module.css';

import MainLayout from '../layouts/MainLayout';
import publicEnv from '../libs/public-env';

interface TermsOfUsePageProps {
  markdown: string;
}

const TermsOfUsePage: NextPageWithLayout<TermsOfUsePageProps> = ({ markdown }) => (
  <div className={`my-5 container text-white ${styles.markdownRoot}`}>
    <ReactMarkdown
      components={{
        a: ({ children, href }) => (
          <Link href={href ?? '/'} className="link">
            {children}
          </Link>
        ),
      }}
    >
      {markdown}
    </ReactMarkdown>
  </div>
);

export const getStaticProps: GetStaticProps<TermsOfUsePageProps> = async () => {
  const res = await fetch(`
  ${publicEnv.NEXT_PUBLIC_FRONTEND_URL}/terms.md`);
  const markdown = await res.text();

  return {
    props: {
      markdown,
    },
    revalidate: 60 * 60 * 24,
  };
};

TermsOfUsePage.getLayout = (page) => <MainLayout>{page}</MainLayout>;

export default TermsOfUsePage;
