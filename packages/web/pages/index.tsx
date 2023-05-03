import Image from 'next/image';

import styles from '../styles/Home.module.css';

import MainLayout from '../layouts/MainLayout';

const HomePage: NextPageWithLayout = () => {
  return (
    <main className="text-white">
      <section className={styles.heroSection}>
        <div className="container h-100">
          <div className="row h-100">
            <div className="col-xl-8 col-lg-9 h-100 d-flex flex-column justify-content-center">
              <h1 className={`mb-4 fw-bold ${styles.heroText}`}>Angel Bridge</h1>
              <h2 className={`fs-5 ${styles.subText}`}>
                <span className="d-inline-block">A bridge between&nbsp;</span>
                <span className={`d-inline-block ${styles.youTube}`}>
                  YouTube Channel Membership
                </span>
                <span className="d-inline-block">&nbsp;and&nbsp;</span>
                <span className={`d-inline-block ${styles.discord}`}>Discord Role</span>.
              </h2>
            </div>
            <div
              className={`col-xl-4 col-lg-3 h-100 flex-column justify-content-center align-items-center ${styles.heroImage}`}
            >
              <Image src="/certification.svg" alt="" width={200} height={200} />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

HomePage.getLayout = (page) => <MainLayout>{page}</MainLayout>;

export default HomePage;
