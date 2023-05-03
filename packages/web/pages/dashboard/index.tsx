import {
  GoogleAuthRequest,
  ReadCurrentUserRequest,
  ReadGuildRequest,
  VerifyMembershipRequest,
} from '@angel-bridge/common';
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { useGoogleLogin } from '@react-oauth/google';
import message from 'antd/lib/message';
import Modal from 'antd/lib/modal';
import Spin from 'antd/lib/spin';
import axios from 'axios';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { DiscordLoginButton } from 'react-social-login-buttons';

import styles from '../../styles/MainApp.module.css';

import GoogleOAuthButton from '../../components/GoogleOAuthButton';
import MainLayout from '../../layouts/MainLayout';
import api from '../../libs/server';

dayjs.extend(utc);

const AppPage: NextPageWithLayout = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedMembershipRole, setSelectedMembershipRole] = useState<
    ReadGuildRequest['res'][0]['membershipRoles'][0] | null
  >(null);
  const [user, setUser] = useState<ReadCurrentUserRequest['res'] | null>(null);
  const [guilds, setGuilds] = useState<ReadGuildRequest['res'] | null>(null);
  const [hoveredRoleId, setHoveredRoleId] = useState<string | null>(null);
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [verifyingMembership, setVerifyingMembership] = useState(false);

  const [messageApi, contextHolder] = message.useMessage();
  const authorize = useGoogleLogin({
    onSuccess: async ({ code }) => {
      setLinkingAccount(true);
      try {
        const { data } = await api.post<GoogleAuthRequest>('/auth/google', { code });
        setUser((oldUser) =>
          oldUser !== null
            ? {
                ...oldUser,
                youTube: data,
              }
            : null,
        );
        void messageApi.success('Successfully linked your YouTube channel');
      } catch (error) {
        console.error(error);
        if (axios.isAxiosError(error) && error.response !== undefined) {
          const data = error.response.data as unknown;
          if (
            typeof data === 'object' &&
            data !== null &&
            'message' in data &&
            typeof data.message === 'string'
          ) {
            void messageApi.error(data.message);
          }
        }
      } finally {
        setLinkingAccount(false);
      }
    },
    onError: ({ error, error_description }) => {
      console.error(error);
      void messageApi.error(`${error ?? ''}: ${error_description ?? '[Unknown Error]'}`);
    },
    flow: 'auth-code',
    scope: 'https://www.googleapis.com/auth/youtube.force-ssl',
    select_account: true,
  });

  useEffect(() => {
    (async () => {
      const { data } = await api.get<ReadCurrentUserRequest>('/users/@me');
      setUser(data);
    })().catch(console.error);
    (async () => {
      const { data } = await api.get<ReadGuildRequest>('/guilds');
      setGuilds(data);
    })().catch(console.error);
  }, []);

  if (guilds === null) {
    return (
      <div className="h-100 d-flex flex-column justify-content-center align-items-center">
        <div className="poppins mb-4 fs-5 fw-medium text-white">Loading...</div>
        <Spin className="mb-5" indicator={<LoadingOutlined className="text-white fs-2" spin />} />
      </div>
    );
  }

  return (
    <>
      {contextHolder}
      <Modal
        title={<div className="text-white">Choose a Verification Mode</div>}
        className={styles.modal}
        open={isModalOpen}
        footer={null}
        centered
        onCancel={() => {
          setIsModalOpen(false);
          setSelectedMembershipRole(null);
        }}
      >
        {selectedMembershipRole !== null && (
          <>
            <div className="mt-3 mb-4">
              <div className={`fs-6 mb-2 text-white fw-bold ${styles.modalSubTitle}`}>
                OAuth Mode
              </div>
              <div className="mb-3">
                <div className="mb-1">
                  You can link your YouTube channel and authorize Angel Bridge to verify your
                  membership for{' '}
                  <span
                    role="button"
                    className={styles.modalChannelTitle}
                    onClick={() => {
                      window.open(
                        `https://www.youtube.com/${selectedMembershipRole.youTubeChannel.customUrl}`,
                        '_blank',
                      );
                    }}
                  >
                    {selectedMembershipRole?.youTubeChannel.title}
                  </span>
                  .
                </div>
                {user?.youTube == null && (
                  <div className="fw-medium text-white">
                    Please link your YouTube account to continue.
                  </div>
                )}
              </div>
              <div className="my-3 d-flex justify-content-center align-items-center">
                {linkingAccount ? (
                  <div
                    className="flex-grow-1 d-flex justify-content-center"
                    style={{ height: '40px' }}
                  >
                    <Spin indicator={<LoadingOutlined className="text-white fs-4" spin />} />
                  </div>
                ) : user?.youTube == null ? (
                  <>
                    <GoogleOAuthButton className="flex-grow-1" onClick={() => authorize()} />
                  </>
                ) : (
                  <div className={`px-3 py-2 rounded d-flex flex-column ${styles.channelWrapper}`}>
                    <div className={`mb-2 text-white ${styles.linkedChannelTitle}`}>
                      Your linked YouTube channel
                    </div>
                    <div className="d-flex align-items-center">
                      <Image
                        className="flex-shrink-0 rounded-circle"
                        src={user.youTube.thumbnail}
                        alt={`${user.youTube.title}'s icon`}
                        width={40}
                        height={40}
                      />
                      <div className={`flex-grow-1 ps-3 ${styles.channelInfo}`}>
                        <div
                          role="button"
                          className={`fs-6 text-truncate ${styles.channelTitle}`}
                          onClick={() =>
                            user.youTube !== null &&
                            window.open(
                              `https://www.youtube.com/${user.youTube.customUrl}`,
                              '_blank',
                            )
                          }
                        >
                          {user.youTube.title}
                        </div>
                        <div className="fs-8 text-truncate">{user.youTube.customUrl}</div>
                      </div>
                      <div
                        role="button"
                        className={`flex-shrink-0 ms-2 btn btn-success btn-sm ${
                          verifyingMembership ? 'disabled' : ''
                        }`}
                        onClick={async () => {
                          setVerifyingMembership(true);
                          void messageApi.open({
                            key: 'verify-membership',
                            type: 'loading',
                            content: 'Verifying your membership...',
                          });
                          try {
                            const { data } = await api.post<VerifyMembershipRequest>(
                              `/memberships/${selectedMembershipRole.id}`,
                              {},
                            );
                            setGuilds((oldGuilds) =>
                              oldGuilds !== null
                                ? oldGuilds.map((guild) =>
                                    guild.id !== selectedMembershipRole.guild
                                      ? guild
                                      : {
                                          ...guild,
                                          membershipRoles: guild.membershipRoles.map(
                                            (membershipRole) =>
                                              membershipRole.id !== selectedMembershipRole.id
                                                ? membershipRole
                                                : {
                                                    ...membershipRole,
                                                    membership: data,
                                                  },
                                          ),
                                        },
                                  )
                                : null,
                            );
                            void messageApi.open({
                              key: 'verify-membership',
                              type: 'success',
                              content: 'Successfully verified your membership',
                            });
                            setIsModalOpen(false);
                          } catch (error) {
                            console.error(error);
                            if (axios.isAxiosError(error) && error.response !== undefined) {
                              const data = error.response.data as unknown;
                              if (
                                typeof data === 'object' &&
                                data !== null &&
                                'message' in data &&
                                typeof data.message === 'string'
                              ) {
                                void messageApi.open({
                                  key: 'verify-membership',
                                  type: 'error',
                                  content: `[Error ${error.response.status}]: ${data.message}`,
                                });
                              } else {
                                void messageApi.open({
                                  key: 'verify-membership',
                                  type: 'error',
                                  content: `[Error ${error.response.status}]: ${error.response.statusText}}`,
                                });
                              }
                            } else if (error instanceof Error) {
                              void messageApi.open({
                                key: 'verify-membership',
                                type: 'error',
                                content: `[${error.name}]: ${error.message}`,
                              });
                            } else {
                              void messageApi.open({
                                key: 'verify-membership',
                                type: 'error',
                                content: 'An unknown error has occurred',
                              });
                            }
                          } finally {
                            setTimeout(() => {
                              messageApi.destroy('verify-membership');
                            }, 3000);
                            setVerifyingMembership(false);
                          }
                        }}
                      >
                        Verify
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <div className={`fs-6 mb-2 text-white fw-bold ${styles.modalSubTitle}`}>OCR Mode</div>
              <div className="mb-3">
                <div className="mb-1">
                  Alternatively, You can to go to the Discord server{' '}
                  <span className={styles.modalGuildName}>
                    {guilds.find(({ id }) => id === selectedMembershipRole.guild)?.name ??
                      '[Unknown Server]'}
                  </span>{' '}
                  and use the slash command{' '}
                  <span className={`text-white mx-1 ${styles.modalCommand}`}>/verify</span> to
                  submit your membership screenshot.
                </div>
                <div>Your request will be manually handled by the server moderators.</div>
              </div>
              <div className="d-flex justify-content-center">
                <DiscordLoginButton
                  className={`${styles.modalGotoServer}`}
                  text="Go to Discord Server"
                  onClick={() =>
                    window.open(
                      `https://discord.com/channels/${selectedMembershipRole.guild}`,
                      '_blank',
                    )
                  }
                />
              </div>
            </div>
          </>
        )}
      </Modal>
      <div className="my-5">
        <div className={`container ${styles.container}`}>
          <div className="row">
            <div className={`fs-5 ms-2 mt-4 mb-3 ${styles.title}`}>
              Membership Roles in your servers
            </div>
          </div>
          <div className="row">
            {guilds.map((guild) => {
              return (
                <div key={guild.id} className="my-2">
                  <div className={styles.card}>
                    <div className="mb-4 mx-2 d-flex justify-content-between align-items-center">
                      <div
                        role="button"
                        className={`flex-grow-1 d-flex align-items-center ${styles.cardHeader}`}
                        onClick={() =>
                          window.open(`https://discord.com/channels/${guild.id}`, '_blank')
                        }
                      >
                        {guild.icon !== null && (
                          <Image
                            className="flex-shrink-0 rounded-circle"
                            src={guild.icon}
                            alt={`${guild.name}'s icon`}
                            width={40}
                            height={40}
                          />
                        )}
                        <div className="flex-grow-1 text-truncate fw-bold fs-4 mx-3">
                          {guild.name}
                        </div>
                      </div>
                      <div
                        className={`flex-shrink-0 ${styles.membershipRoleCount}`}
                      >{`Roles: ${guild.membershipRoles.length}`}</div>
                    </div>
                    <div className={`pb-1 d-flex overflow-auto ${styles.cardBody}`}>
                      {guild.membershipRoles.slice(0).map((membershipRole) => {
                        return (
                          <div
                            key={membershipRole.id}
                            className={`flex-shrink-0 mx-2 p-3 ${styles.membershipRole} ${
                              membershipRole.membership !== null
                                ? styles.verifiedMembershipRole
                                : ''
                            } d-flex flex-column`}
                          >
                            <div className="flex-shrink-0 mb-3 d-flex">
                              <Image
                                className="flex-shrink-0 rounded-circle"
                                src={membershipRole.youTubeChannel.thumbnail}
                                alt={`${guild.name}'s icon`}
                                width={64}
                                height={64}
                              />
                              <div className={`flex-grow-1 ps-3 ${styles.channelInfo}`}>
                                <div className="d-flex align-items-center">
                                  {membershipRole.membership !== null && (
                                    <CheckCircleOutlined
                                      className={`fs-5 me-2 ${styles.checked}`}
                                    />
                                  )}
                                  <div
                                    role="button"
                                    className={`fs-5 text-truncate ${styles.channelTitle}`}
                                    onClick={() =>
                                      window.open(
                                        `https://www.youtube.com/${membershipRole.youTubeChannel.customUrl}`,
                                        '_blank',
                                      )
                                    }
                                  >
                                    {membershipRole.youTubeChannel.title}
                                  </div>
                                </div>
                                <div>{membershipRole.youTubeChannel.customUrl}</div>
                              </div>
                            </div>
                            <div className="flex-shrink-0 mb-1 d-flex align-items-center">
                              Membership Role:
                              <div
                                className={`ms-2 ${styles.membershipRolePill}`}
                                onMouseEnter={() => setHoveredRoleId(membershipRole.id)}
                                onMouseLeave={() => setHoveredRoleId(null)}
                                style={{
                                  color: `#${
                                    membershipRole.color === 0
                                      ? 'c9cdfb'
                                      : membershipRole.color.toString(16).padStart(6, '0')
                                  }`,
                                  backgroundColor: `#${
                                    membershipRole.color === 0
                                      ? '5865f24c'
                                      : membershipRole.color.toString(16).padStart(6, '0') +
                                        (membershipRole.id === hoveredRoleId ? '4D' : '1A')
                                  }`,
                                }}
                              >
                                @{membershipRole.name}
                              </div>
                            </div>
                            {membershipRole.membership === null ? (
                              <div className="flex-grow-1 d-flex align-items-end">
                                <div
                                  role="button"
                                  className={`rounded-1 btn-custom ${styles.verify}`}
                                  onClick={() => {
                                    setSelectedMembershipRole(membershipRole);
                                    setIsModalOpen(true);
                                  }}
                                >
                                  Apply
                                </div>
                              </div>
                            ) : membershipRole.membership.type === 'oauth' ? (
                              <>
                                <div className="flex-shrink-0 mb-1">Verification Mode: OAuth</div>
                              </>
                            ) : (
                              <>
                                <div className="flex-shrink-0 mb-1">Verification Mode: OCR</div>
                                <div className="flex-shrink-0">
                                  Next Billing Date:{' '}
                                  <span className={`fw-bold ${styles.billingDate}`}>
                                    {dayjs
                                      .utc(membershipRole.membership.billingDate)
                                      .format('YYYY-MM-DD')}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
};

AppPage.getLayout = (page) => <MainLayout>{page}</MainLayout>;

export default AppPage;