import { Show } from 'solid-js';
import type { JSX } from '@solidjs/web';

export type StepState = 'active' | 'done' | 'upcoming';

/**
 * Numbered step in the linear tutorial. The badge shows the step number, a
 * check once done; upcoming steps collapse to just their title and hint.
 */
export default function TutorialStep(props: {
  index: number;
  title: string;
  state: StepState;
  hint?: string;
  children: JSX.Element;
}) {
  return (
    <section
      class={`card step step-${props.state}`}
      aria-current={props.state === 'active' ? 'step' : undefined}
    >
      <span class="step-num" aria-hidden="true">
        {props.state === 'done' ? '✓' : props.index}
      </span>
      <div class="step-head">
        <div class="step-title">
          <h2>{props.title}</h2>
          <Show when={props.hint}>
            <p class="step-hint">{props.hint}</p>
          </Show>
        </div>
      </div>
      <Show when={props.state !== 'upcoming'}>
        <div class="step-body">{props.children}</div>
      </Show>
    </section>
  );
}
