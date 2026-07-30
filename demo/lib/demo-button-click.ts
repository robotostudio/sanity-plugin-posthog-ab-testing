/**
 * Client-side contract between the big push button (DemoPushButton) and the live
 * stats panel (ExperimentStatsCards): the button announces each press on
 * `window` so the stats can bump their numbers optimistically without the two
 * components sharing a React parent.
 */

export const DEMO_BUTTON_CLICK_EVENT = 'demo-button-clicked';

export type DemoButtonClickDetail = { color: 'white' | 'black' };

export function emitDemoButtonClick(color: 'white' | 'black') {
  window.dispatchEvent(
    new CustomEvent<DemoButtonClickDetail>(DEMO_BUTTON_CLICK_EVENT, { detail: { color } }),
  );
}
