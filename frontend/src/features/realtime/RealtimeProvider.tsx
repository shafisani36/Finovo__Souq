import { useEffect, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { apiClient } from '../../api/client';
import { env } from '../../config/env';
import { useAuth } from '../auth/context/useAuth';
import { RealtimeContext } from './realtime-context';

// The socket lives on the same server as the API
const SOCKET_ORIGIN = new URL(env.apiBaseUrl, window.location.origin).origin;

/** One live connection per signed-in tab; it reconnects with a fresh token after the access token expires */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return undefined;
    const connection = io(SOCKET_ORIGIN, {
      auth: (send) => send({ token: apiClient.getAccessToken() }),
      transports: ['websocket'],
    });

    connection.on('connect_error', async (error) => {
      if (error.message !== 'Unauthorized') return;
      if (await apiClient.refreshAccessToken()) connection.connect();
    });

    setSocket(connection);
    return () => {
      connection.disconnect();
      setSocket(null);
    };
  }, [userId]);

  return <RealtimeContext.Provider value={socket}>{children}</RealtimeContext.Provider>;
}
