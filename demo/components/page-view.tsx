'use client';

import posthog from 'posthog-js';
import { fireButtonConfetti } from '@/lib/confetti';
import { emitDemoButtonClick } from '@/lib/demo-button-click';
import type { Page } from '@/sanity/lib/fetch';

export const EXPERIMENT_URL = 'https://us.posthog.com/project/535024/experiments/393767';

/**
 * The big sprite push button, the centerpiece of every demo page. Color and
 * label come from the Sanity page document.
 *
 * The sprite (/button-sprite.png) is two frames side by side (left = resting,
 * right = pressed) of a translucent glass dome; the white/black comes from a
 * solid disc layered beneath it — the same construction myinstants.com uses.
 * Frame switching and layering live in globals.css (.push-button rules).
 *
 * Each press captures the PostHog goal event, fires variant-colored confetti,
 * and announces itself on window so the stats panel can bump optimistically.
 */
export function DemoPushButton({ page }: { page: Page }) {
  const buttonColor = page.buttonColor ?? 'white';
  return (
    <button
      type="button"
      className="push-button"
      data-button-color={buttonColor}
      onClick={(event) => {
        posthog.capture('demo_button_clicked');
        fireButtonConfetti(buttonColor, event.currentTarget);
        emitDemoButtonClick(buttonColor);
      }}
    >
      <span className="push-button-label">{page.buttonLabel ?? '?'}</span>
    </button>
  );
}
