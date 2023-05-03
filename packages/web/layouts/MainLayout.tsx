import { CaretDownOutlined } from '@ant-design/icons';
import Dropdown from 'antd/lib/dropdown';
import { MenuProps } from 'antd/lib/menu';
import { signIn, signOut, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { ReactElement } from 'react';
import { DiscordLoginButton } from 'react-social-login-buttons';

import styles from '../styles/MainLayout.module.css';

const MainLayout = ({ children }: { children: ReactElement }) => {
  const { data: session, status } = useSession();

  const items: MenuProps['items'] = [
    {
      key: 'dashboard',
      label: (
        <Link className="text-decoration-none" href="/dashboard">
          Dashboard
        </Link>
      ),
    },
    {
      key: 'sign-out',
      label: (
        <div role="button" className="text-danger" onClick={() => signOut({ redirect: false })}>
          Sign Out
        </div>
      ),
    },
  ];

  return (
    <>
      <nav className={`navbar navbar-expand-lg bg-body-tertiary ${styles.navbar}`}>
        <div className="container">
          <Link className={`fs-5 text-decoration-none fw-bold ${styles.brand}`} href="/">
            Angel Bridge
          </Link>

          {status === 'loading' ? (
            <></>
          ) : status === 'authenticated' ? (
            <Dropdown menu={{ items }}>
              <div
                role="button"
                className={`user-select-none d-flex align-items-center ${styles.user}`}
              >
                <div className={`${styles.avatar} position-relative me-2`}>
                  <Image className="rounded-circle" src={session.user.avatar} alt="avatar" fill />
                </div>
                <div className={`fs-7 me-2 ${styles.username}`}>{session.user.username}</div>
                <CaretDownOutlined />
              </div>
            </Dropdown>
          ) : (
            <div>
              <DiscordLoginButton
                text="Sign in"
                className={`${styles.signInButton} text-nowrap`}
                iconSize="1.5rem"
                onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
              />
            </div>
          )}
        </div>
      </nav>
      <div className={styles.children}>{children}</div>
    </>
  );
};

export default MainLayout;
