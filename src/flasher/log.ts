/**
 * Bounded, reactive operation log.
 */

import { createSignal } from 'solid-js';

export type LogLevel = 'info' | 'success' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  time: string;
  level: LogLevel;
  message: string;
}

export interface Logger {
  entries: () => LogEntry[];
  append(message: string, level?: LogLevel): void;
  clear(): void;
}

export function createLogger(limit = 500): Logger {
  const [entries, setEntries] = createSignal<LogEntry[]>([]);
  let counter = 0;

  const append = (message: string, level: LogLevel = 'info') => {
    const entry: LogEntry = {
      id: ++counter,
      time: new Date().toLocaleTimeString(),
      level,
      message,
    };
    setEntries((previous) => {
      const next = [...previous, entry];
      return next.length > limit ? next.slice(next.length - limit) : next;
    });
  };

  const clear = () => setEntries([]);

  return { entries, append, clear };
}
