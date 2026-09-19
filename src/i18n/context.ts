/**
 * Reactive text lookup. English-only today, but the signal keeps components
 * reactive if a language switcher is added later.
 */

import { createSignal } from 'solid-js';
import { messages, translate, type MessageKey } from './strings';

export type Language = keyof typeof languages;

export const languages = { en: 'English' } as const;

const [language, setLanguage] = createSignal<Language>('en');

export { language, setLanguage, messages, translate };
export type { MessageKey };

/** Shorthand used throughout the components. */
export function t(key: MessageKey, params?: Record<string, string | number>): string {
  // Read the signal so callers inside reactive scopes re-run on change.
  language();
  return translate(key, params);
}
