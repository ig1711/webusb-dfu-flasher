import { createSignal, onCleanup } from 'solid-js';
import { t } from '../i18n/context';

/** A shell/PowerShell command with a retro copy button. */
export default function CodeSnippet(props: { code: string }) {
  const [copied, setCopied] = createSignal(false);
  let timer: number | undefined;

  onCleanup(() => {
    if (timer !== undefined) window.clearTimeout(timer);
  });

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.code);
      setCopied(true);
      if (timer !== undefined) window.clearTimeout(timer);
      timer = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be denied; the command stays selectable by hand.
    }
  }

  return (
    <div class="codeblock">
      <pre>
        <code>{props.code}</code>
      </pre>
      <button type="button" class="copy" onClick={() => void copy()}>
        {copied() ? t('setup.copied') : t('setup.copy')}
      </button>
    </div>
  );
}
