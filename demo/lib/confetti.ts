import confetti from 'canvas-confetti';

/**
 * Button-colored confetti for the demo push button. Palettes stay in the
 * monochrome zinc world: off-white/silver for the white "A" button, graphite
 * for the black "B". The black palette shifts toward lighter zinc in dark mode
 * so the particles still read against the #141414 background.
 */

const WHITE_COLORS = ['#fafafa', '#e4e4e7', '#d4d4d8', '#c0c0c8', '#a1a1aa'];
const BLACK_COLORS_LIGHT = ['#111111', '#18181b', '#27272a', '#3f3f46', '#52525b'];
const BLACK_COLORS_DARK = ['#3f3f46', '#52525b', '#71717a', '#8a8a93', '#a1a1aa'];

export function fireButtonConfetti(color: 'white' | 'black', button: HTMLElement) {
  const dark = document.documentElement.dataset.theme === 'dark';
  const colors =
    color === 'white' ? WHITE_COLORS : dark ? BLACK_COLORS_DARK : BLACK_COLORS_LIGHT;

  const rect = button.getBoundingClientRect();
  const origin = {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height * 0.4) / window.innerHeight,
  };

  // Main pop straight up off the dome, then two softer side sprays.
  confetti({ particleCount: 70, spread: 70, startVelocity: 38, gravity: 1, ticks: 220, origin, colors });
  confetti({ particleCount: 25, angle: 60, spread: 50, startVelocity: 30, gravity: 1, ticks: 200, origin, colors });
  confetti({ particleCount: 25, angle: 120, spread: 50, startVelocity: 30, gravity: 1, ticks: 200, origin, colors });
}
