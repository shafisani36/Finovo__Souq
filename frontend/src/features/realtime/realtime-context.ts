import { createContext, useContext, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { AppNotification, Conversation, Message } from '../../types';

/** Events the backend pushes to the signed-in user's private room (backend/src/realtime/socket.js) */
export interface ServerEvents {
  'message:new': { message: Message; conversation: Conversation };
  'message:deleted': { message: Message; conversation: Conversation };
  'conversation:read': { conversationId: string; readerId: string; readAt: string; conversation: Conversation };
  'conversation:updated': { conversation: Conversation };
  typing: { conversationId: string; userId: string };
  'notification:new': AppNotification;
}

export const RealtimeContext = createContext<Socket | null>(null);

export function useSocket(): Socket | null {
  return useContext(RealtimeContext);
}

/** Subscribes to a server event for as long as the component is on screen */
export function useSocketEvent<E extends keyof ServerEvents>(event: E, handler: (payload: ServerEvents[E]) => void): void {
  const socket = useSocket();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    if (!socket) return undefined;
    const listener = (payload: ServerEvents[E]) => handlerRef.current(payload);
    socket.on(event as string, listener);
    return () => {
      socket.off(event as string, listener);
    };
  }, [socket, event]);
}
