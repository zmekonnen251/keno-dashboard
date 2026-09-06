import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
	[key: string]: unknown;
}

interface WebSocketData {
	[key: string]: unknown;
}

export function useWebSocket(url:string) {
	const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const wsRef = useRef<WebSocket | null>(null);

	useEffect(() => {
		const ws = new WebSocket(url);
		wsRef.current = ws;

		ws.onopen = () => setIsConnected(true);
		ws.onmessage = (event) => setLastMessage(JSON.parse(event.data));
		ws.onclose = () => setIsConnected(false);

		return () => {
			ws.close();
			wsRef.current = null;
		};
	}, [url]);

	// Stable send function using useRef to target the active socket
	const sendMessage = useCallback((data: WebSocketData): void => {
		if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
			wsRef.current.send(JSON.stringify(data));
		} else {
			console.warn('WebSocket is not connected');
		}
	}, []);

	return { lastMessage, isConnected, sendMessage };
}
