/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';

export function useSocket(channel: string, setData: (data: any) => void) {
  const setDataRef = useRef(setData);
  const unsubRef = useRef<(() => void) | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    setDataRef.current = setData;

    let mounted = true;

    // Connect to the gateway WebSocket
    const socket = new WebSocket(`wss://${window.location.host}/autoplay${channel}`);

    socketRef.current = socket;

    socket.onopen = () => {
      if (mounted && setDataRef.current) {
        setDataRef.current({ type: 'connected', channel });
      }
    };

    socket.onmessage = (event) => {
      if (mounted && setDataRef.current) {
        try {
          const data = JSON.parse(event.data);
          setDataRef.current(data);
        } catch {
          setDataRef.current({ type: 'raw', raw: event.data });
        }
      }
    };

    socket.onclose = () => {
      if (mounted && setDataRef.current) {
        setDataRef.current({ type: 'disconnected', channel });
      }
    };

    socket.onerror = (error: Event) => {
      if (mounted && setDataRef.current) {
        setDataRef.current({ type: 'error', error: error.type });
      }
    };

    // Return unsubscribe function
    unsubRef.current = () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };

    return () => {
      unsubRef.current?.();
    };
  }, [channel, setData]);
}