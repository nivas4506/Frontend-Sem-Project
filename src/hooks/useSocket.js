import { useState, useEffect, useRef, useCallback } from 'react';
import { SocketService } from '../services/socketService';

export function useSocket({ session, onEvent }) {
  const [socketConnected, setSocketConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const socketRef = useRef(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const handleSocketEvent = useCallback((data) => {
    if (data.type === 'auth:success') {
      setSocketConnected(true);
      if (Array.isArray(data.activeUsers)) setActiveUsers(data.activeUsers);
    } else if (data.type === 'presence:update') {
      if (Array.isArray(data.activeUsers)) setActiveUsers(data.activeUsers);
    } else if (data.type === 'connection:closed') {
      setSocketConnected(false);
      setActiveUsers([]);
    }
    onEventRef.current?.(data);
  }, []);

  useEffect(() => {
    const s = new SocketService(handleSocketEvent);
    socketRef.current = s;
    const startTimer = setTimeout(() => {
      if (socketRef.current === s && session) {
        s.start(session);
      }
    }, 0);
    return () => {
      clearTimeout(startTimer);
      s.stop();
    };
  }, [handleSocketEvent, session]);

  const send = useCallback((type, payload = {}) => {
    return socketRef.current?.send(type, payload);
  }, []);

  return {
    socketConnected,
    activeUsers,
    send,
    socket: socketRef.current
  };
}
