'use client';

import posthog from 'posthog-js';
import { fireButtonConfetti } from '@/lib/confetti';
import { emitDemoButtonClick } from '@/lib/demo-button-click';
import type { Page } from '@/sanity/lib/fetch';

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
  // PostHog flag keys are frozen: control = white "A", blue = black "B".
  const variantKey = buttonColor === 'black' ? 'blue' : 'control';
  return (
    <button
      type="button"
      className="push-button"
      data-button-color={buttonColor}
      onClick={(event) => {
        // variant_shown records the page actually rendered — with the
        // homepage re-rolling variants per refresh, the visitor's sticky flag
        // assignment can differ from what's on screen.
        posthog.capture('demo_button_clicked', { variant_shown: variantKey });
        fireButtonConfetti(buttonColor, event.currentTarget);
        emitDemoButtonClick(buttonColor);
      }}
    >
      <span className="push-button-label">{page.buttonLabel ?? '?'}</span>
    </button>
  );
}
