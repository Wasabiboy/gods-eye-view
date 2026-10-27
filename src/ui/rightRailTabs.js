/**
 * Vertical tab strip for the right context rail.
 *
 * The strip replaces the rail's collapsed launcher cards: one sideways tab per
 * rail panel, the open panel beside the strip, at most one panel open. The
 * panels' `collapsed` classes remain the only state. The strip mirrors them and
 * asks the owner (setPanelCollapsed) for every change, so persistence, share
 * links and the rail layout pass are untouched. Phones hide the strip and keep
 * their sheet shell (mobileShell.js).
 */
import { msg, t } from '../i18n/index.js';

export const RIGHT_RAIL_TABS_ID = 'right-rail-tabs';

/** Presentation variants, selected through `data-rail-tabs` on the rail. */
export const RIGHT_RAIL_TAB_VARIANTS = Object.freeze([
  'cards-down',
  'cards-up',
  'spine',
  'icons',
  'minimal',
]);
export const DEFAULT_RIGHT_RAIL_TAB_VARIANT = 'cards-down';

/** Glyphs for the icon variant; every name is in index.html's icon_names. */
const PANEL_ICONS = Object.freeze({
  'pp-toggles': 'tune',
  'cctv-panel': 'videocam',
  'street-level-panel': 'streetview',
  'global-context-panel': 'radar',
  'weather-panel': 'cloud',
  'recent-imagery-panel': 'satellite_alt',
});

/**
 * The tab keyboard navigation moves to in a vertical tablist: Down and Up
 * wrap, Home and End jump. Any other key keeps the current index.
 * @param {string} key KeyboardEvent.key.
 * @param {number} index Index of the focused tab.
 * @param {number} count Visible tab count.
 * @returns {number} Target index, or -1 when there is no tab.
 */
export function nextRailTabIndex(key, index, count) {
  if (!(count > 0)) return -1;
  const current = Math.max(0, Math.min(count - 1, index));
  switch (key) {
    case 'ArrowDown':
      return (current + 1) % count;
    case 'ArrowUp':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return current;
  }
}

/** The panels a rail presents as tabs, in rail order. */
export function railTabPanels(rail) {
  return [...(rail?.children || [])].filter(
    (panel) => panel.matches?.('[data-panel-id]') && !panel.hidden,
  );
}

/** The tab label: the panel's own header title, already translated. */
function panelTitle(panel) {
  return (
    panel
      .querySelector?.('.panel-title, .pp-header-label')
      ?.textContent?.trim() || panel.id
  );
}

/**
 * Build the strip inside `rail` and keep it in step with the rail's panels.
 * @param {object} input
 * @param {HTMLElement} input.rail The right context rail.
 * @param {(panelId: string, collapsed: boolean, options: object) => void} input.setPanelCollapsed
 *   Owner callback; the strip never touches panel classes itself.
 * @param {Document} [input.documentRef]
 * @param {string} [input.variant] Initial presentation variant.
 * @returns {{ element: HTMLElement, sync: () => void, destroy: () => void }}
 */
export function createRightRailTabs({
  rail,
  setPanelCollapsed,
  documentRef = rail?.ownerDocument,
  variant = DEFAULT_RIGHT_RAIL_TAB_VARIANT,
}) {
  if (!rail || !documentRef || typeof setPanelCollapsed !== 'function') {
    throw new TypeError(
      'Right rail tabs require a rail, a document and setPanelCollapsed',
    );
  }
  const strip = documentRef.createElement('div');
  strip.id = RIGHT_RAIL_TABS_ID;
  strip.className = 'right-rail-tabs';
  strip.setAttribute('role', 'tablist');
  strip.setAttribute('aria-orientation', 'vertical');
  strip.setAttribute('aria-label', t('Panels'));
  if (!rail.dataset.railTabs) rail.dataset.railTabs = variant;

  /** @type {Map<string, {tab: HTMLElement, label: HTMLElement}>} */
  const entries = new Map();
  const observed = new WeakSet();
  let destroyed = false;

  const entryFor = (panel) => {
    let entry = entries.get(panel.id);
    if (entry) return entry;
    const tab = documentRef.createElement('button');
    tab.type = 'button';
    tab.className = 'right-rail-tab';
    tab.dataset.railTab = panel.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    const icon = PANEL_ICONS[panel.id];
    if (icon) {
      const glyph = documentRef.createElement('span');
      glyph.className = 'material-symbols-outlined right-rail-tab-icon';
      glyph.setAttribute('aria-hidden', 'true');
      glyph.textContent = icon;
      tab.append(glyph);
    }
    const label = documentRef.createElement('span');
    label.className = 'right-rail-tab-label';
    tab.append(label);
    entry = { tab, label };
    entries.set(panel.id, entry);
    return entry;
  };

  const Observer =
    documentRef.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  const observer =
    typeof Observer === 'function' ? new Observer(() => sync()) : null;
  const observe = (panel) => {
    if (!observer || observed.has(panel)) return;
    observed.add(panel);
    observer.observe(panel, {
      attributes: true,
      attributeFilter: ['class', 'hidden'],
    });
  };

  /** Reconcile tabs with the rail: order, visibility, selection, labels. */
  function sync() {
    if (destroyed) return;
    // The tablist precedes its panels in the tab order, so Tab from the open
    // tab lands inside the open panel. The rail owner moves panels in at
    // start-up; keep the strip first afterwards too.
    if (rail.firstElementChild !== strip) rail.prepend(strip);
    const panels = railTabPanels(rail);
    const focusOwner =
      panels.find((panel) => !panel.classList.contains('collapsed')) ||
      panels[0];
    // Move a tab only when it is out of place: reinserting the focused tab
    // would drop keyboard focus on every class change.
    let cursor = strip.firstElementChild;
    for (const panel of panels) {
      const { tab, label } = entryFor(panel);
      if (tab !== cursor) strip.insertBefore(tab, cursor);
      else cursor = cursor.nextElementSibling;
      const collapsed = panel.classList.contains('collapsed');
      const name = panelTitle(panel);
      if (label.textContent !== name) label.textContent = name;
      tab.setAttribute('aria-selected', String(!collapsed));
      tab.tabIndex = panel === focusOwner ? 0 : -1;
      tab.title = t(collapsed ? msg('Expand {name}') : msg('Collapse {name}'), {
        name,
      });
      observe(panel);
    }
    const live = new Set(panels.map((panel) => panel.id));
    for (const [id, entry] of entries) {
      if (live.has(id)) continue;
      entry.tab.remove();
      entries.delete(id);
    }
  }

  const onClick = (event) => {
    const tab = event.target?.closest?.('[data-rail-tab]');
    if (!tab) return;
    const panel = documentRef.getElementById(tab.dataset.railTab);
    if (!panel) return;
    setPanelCollapsed(panel.id, !panel.classList.contains('collapsed'), {
      explicit: true,
    });
  };
  const onKeydown = (event) => {
    const current = event.target?.closest?.('[data-rail-tab]');
    if (!current) return;
    const visible = [...strip.children].filter((tab) => !tab.hidden);
    const index = visible.indexOf(current);
    const next = nextRailTabIndex(event.key, index, visible.length);
    if (next < 0 || next === index) return;
    event.preventDefault();
    visible[next].focus();
  };
  strip.addEventListener('click', onClick);
  strip.addEventListener('keydown', onKeydown);
  observer?.observe(rail, { childList: true });
  rail.prepend(strip);
  sync();

  return {
    element: strip,
    sync,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      strip.removeEventListener('click', onClick);
      strip.removeEventListener('keydown', onKeydown);
      strip.remove();
      entries.clear();
    },
  };
}
