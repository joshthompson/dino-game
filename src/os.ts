/**
 * Talking to Josh OS.
 *
 * The desktop at joshthompson.github.io/toys frames this game in a window, flags it
 * with `#embedded` on the URL, and then talks postMessage: the game hands over a menu
 * bar to draw, and hears back when someone picks something off it.
 *
 * None of it is required. Open the game on its own and `embedded()` is false, every
 * call below turns into nothing, and the game plays exactly as it always did.
 */

/** Stamped on every message in both directions, so other traffic on the window is ignored. */
const PROTOCOL = 'josh-os';
const VERSION = 1;

/** One line in a menu. A separator is a rule between groups, not something to pick. */
export type MenuItem = { separator: true } | { id: string; label: string; disabled?: boolean };

/** One heading in the bar — Game, Help — with everything that drops down from it. */
export type Menu = { label: string; items: MenuItem[] };

/**
 * Are we in a Josh OS window? The hash is the flag the desktop sets, and the parent
 * check is what stops a hand-typed URL from posting messages at itself.
 */
export const embedded = () => window.location.hash === '#embedded' && window.parent !== window;

const send = (message: object) => {
  if (!embedded()) return;
  // '*' because a game has no business knowing which host framed it — and there's
  // nothing in any of these messages that everyone can't already see on screen.
  window.parent.postMessage({ protocol: PROTOCOL, version: VERSION, ...message }, '*');
};

/** Hand the OS a menu bar to draw. Sending again replaces whatever was there. */
export const setMenus = (menus: Menu[]) => send({ type: 'menus', menus });

/** Ask the OS to open one of its own text windows: the rules, an about box, credits. */
export const showText = (title: string, body: string) => send({ type: 'text', title, body });

/** Rename the window this game is sitting in. */
export const setTitle = (title: string) => send({ type: 'title', title });

/** Called with the id of whichever menu item was picked, for as long as the game runs. */
export const onMenu = (handler: (id: string) => void) => {
  if (!embedded()) return;
  window.addEventListener('message', (e: MessageEvent) => {
    if (e.source !== window.parent) return;
    const data = e.data;
    if (!data || typeof data !== 'object') return;
    if (data.protocol !== PROTOCOL || data.version !== VERSION) return;
    if (data.type === 'menu' && typeof data.id === 'string') handler(data.id);
  });
};
