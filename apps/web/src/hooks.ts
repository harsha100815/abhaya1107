import { useEffect, useRef, useState } from 'react';
import { tokens } from './api';

export function useRealtime(onEvent: (event: { type: string; payload?: any }) => void) {
  const callback = useRef(onEvent);
  callback.current = onEvent;
  useEffect(() => {
    const token = tokens.access;
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`);
    socket.onmessage = (message) => { try { callback.current(JSON.parse(message.data)); } catch { /* ignore malformed event */ } };
    return () => socket.close();
  }, []);
}

export function useInterval(callback: () => void, delay: number | null) {
  const saved = useRef(callback);
  saved.current = callback;
  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(() => saved.current(), delay);
    return () => window.clearInterval(id);
  }, [delay]);
}

export function useCountdown(until: string | null) {
  const [remaining, setRemaining] = useState(() => until ? Math.max(0, new Date(until).getTime() - Date.now()) : 0);
  useEffect(() => { if (!until) { setRemaining(0); return; } const tick = () => setRemaining(Math.max(0, new Date(until).getTime() - Date.now())); tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer); }, [until]);
  return remaining;
}
