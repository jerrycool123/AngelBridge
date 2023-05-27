import { ReadCurrentUserRequest, ReadGuildRequest } from '@angel-bridge/common';
import { useSession } from 'next-auth/react';
import { Dispatch, ReactNode, SetStateAction, createContext, useEffect, useState } from 'react';

import api from '../libs/server';

export interface TUserContext {
  user: ReadCurrentUserRequest['res'] | null;
  setUser: Dispatch<SetStateAction<ReadCurrentUserRequest['res'] | null>>;
  guilds: ReadGuildRequest['res'] | null;
  setGuilds: Dispatch<SetStateAction<ReadGuildRequest['res'] | null>>;
}

export const UserContext = createContext<TUserContext>({
  user: null,
  setUser: () => undefined,
  guilds: null,
  setGuilds: () => undefined,
});

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const { status } = useSession();
  const [user, setUser] = useState<TUserContext['user']>(null);
  const [guilds, setGuilds] = useState<ReadGuildRequest['res'] | null>(null);

  useEffect(() => {
    if (status !== 'authenticated') return;
    (async () => {
      const { data } = await api.get<ReadCurrentUserRequest>('/users/@me');
      setUser(data);
    })().catch(console.error);
    (async () => {
      const { data } = await api.get<ReadGuildRequest>('/guilds');
      setGuilds(data);
    })().catch(console.error);
  }, [status]);

  return (
    <UserContext.Provider value={{ user, setUser, guilds, setGuilds }}>
      {children}
    </UserContext.Provider>
  );
};
