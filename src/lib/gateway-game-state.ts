import { useEffect, useRef } from 'react';

export function useGatewayGameState(
  setState: (state: 'betting_open' | 'drawing' | 'settled' | 'unknown') => void,
  provider?: string,
) {
  const setStateRef = useRef(setState);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setStateRef.current = setState;

    let mounted = true;

    const checkGameState = async () => {
      try {
        const qs = provider ? `?provider=${encodeURIComponent(provider)}` : '';
        const res = await fetch(`/api/gateway/game-state${qs}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          if (mounted && setStateRef.current) {
            setStateRef.current(data.state || 'unknown');
          }
        }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e:unknown) {
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
  }, [setState, provider]);
}