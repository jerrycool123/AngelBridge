import { GetStaticProps } from 'next';
import Link from 'next/link';
import fs from 'node:fs';
import path from 'node:path';
import { ReactMarkdown } from 'react-markdown/lib/react-markdown';

import styles from '../styles/Markdown.module.css';

import MainLayout from '../layouts/MainLayout';

interface PrivacyPageProps {
  markdown: string;
}

const PrivacyPage: NextPageWithLayout<PrivacyPageProps> = ({ markdown }) => (
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

export const getStaticProps: GetStaticProps<PrivacyPageProps> = () => {
  const markdown = fs.readFileSync(path.join(process.cwd(), './public/privacy.md'), 'utf-8');

  return {
    props: {
      markdown,
    },
    revalidate: 60 * 60 * 24,
  };
};

PrivacyPage.getLayout = (page) => <MainLayout>{page}</MainLayout>;

export default PrivacyPage;
