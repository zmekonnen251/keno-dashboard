/* eslint-disable @typescript-eslint/no-unused-vars */
import { useEffect, useRef } from 'react';

export function useGatewayGameState(setState: (state: 'betting_open' | 'drawing' | 'settled' | 'unknown') => void) {
  const setStateRef = useRef(setState);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setStateRef.current = setState;

    let mounted = true;

    const checkGameState = async () => {
      try {
        const res = await fetch('/api/gateway/game-state', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (mounted && setStateRef.current) {
            setStateRef.current(data.state || 'unknown');
          }
        }
      } catch (e) {
        // silently retry on network errors
      }
    };

    // Initial check
    checkGameState();

    // Poll every 3 seconds
    const intervalId = setInterval(checkGameState, 3000);

    // Return unsubscribe function
    unsubRef.current = () => {
      mounted = false;
      clearInterval(intervalId);
    };

    return () => {
      unsubRef.current?.();
    };
  }, [setState]);
}