import { GetStaticProps } from 'next';
import Link from 'next/link';
import fs from 'node:fs';
import path from 'node:path';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';

import styles from '../styles/Markdown.module.css';

import MainLayout from '../layouts/MainLayout';

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

export const getStaticProps: GetStaticProps<TermsOfUsePageProps> = () => {
  const markdown = fs.readFileSync(path.join(process.cwd(), './public/terms.md'), 'utf-8');

  return {
    props: {
      markdown,
    },
    revalidate: 60 * 60 * 24,
  };
};

TermsOfUsePage.getLayout = (page) => <MainLayout>{page}</MainLayout>;

export default TermsOfUsePage;
