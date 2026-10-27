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

/**
 * Marks the rail while its strip is mounted; styles/right-rail-tabs.css keys
 * the rail's tab geometry on it so a rail without a strip keeps its legacy
 * layout.
 */
export const RIGHT_RAIL_TABS_ATTRIBUTE = 'data-rail-tabs';

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
 * @returns {{ element: HTMLElement, sync: () => void, destroy: () => void }}
 */
export function createRightRailTabs({
  rail,
  setPanelCollapsed,
  documentRef = rail?.ownerDocument,
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
  rail.setAttribute(RIGHT_RAIL_TABS_ATTRIBUTE, 'vertical');

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
    const label = documentRef.createElement('span');
    label.className = 'right-rail-tab-label';
    tab.append(label);
    resizer?.observe(tab);
    entry = { tab, label };
    entries.set(panel.id, entry);
    return entry;
  };

  const Observer =
    documentRef.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  const observer =
    typeof Observer === 'function' ? new Observer(() => sync()) : null;
  // Tab heights follow their labels (fonts, locale) and panel heights their
  // content and the rail's allocation, so the join is re-measured whenever
  // the strip, a tab or a panel changes size or the strip scrolls.
  const Resize = documentRef.defaultView?.ResizeObserver;
  const resizer =
    typeof Resize === 'function' ? new Resize(() => sync()) : null;
  resizer?.observe(strip);
  const observe = (panel) => {
    if (observed.has(panel)) return;
    observed.add(panel);
    resizer?.observe(panel);
    observer?.observe(panel, {
      attributes: true,
      attributeFilter: ['class', 'hidden'],
    });
  };

  /**
   * Publish the join on the rail for styles/right-rail-tabs.css: the open
   * tab's extent (--rail-tab-top, --rail-tab-bottom) and the open panel's
   * height (--rail-panel-height), in rail pixels. The panel outline is drawn
   * at that height with a notch at the tab, and the panel reaches down to it.
   * The rail itself can be taller than its panel in the focus layout.
   */
  function placeJoin(tab, panel) {
    const style = rail.style;
    if (typeof style?.setProperty !== 'function') return;
    if (!tab || !Number.isFinite(tab.offsetTop)) {
      style.removeProperty('--rail-tab-top');
      style.removeProperty('--rail-tab-bottom');
      style.removeProperty('--rail-panel-height');
      return;
    }
    const top = tab.offsetTop - (strip.scrollTop || 0);
    style.setProperty('--rail-tab-top', `${top}px`);
    style.setProperty('--rail-tab-bottom', `${top + tab.offsetHeight}px`);
    style.setProperty('--rail-panel-height', `${panel.offsetHeight}px`);
  }

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
    let open = null;
    for (const panel of panels) {
      const { tab, label } = entryFor(panel);
      if (tab !== cursor) strip.insertBefore(tab, cursor);
      else cursor = cursor.nextElementSibling;
      const collapsed = panel.classList.contains('collapsed');
      if (!collapsed && !open) open = { tab, panel };
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
      resizer?.unobserve(entry.tab);
      entry.tab.remove();
      entries.delete(id);
    }
    placeJoin(open?.tab, open?.panel);
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
  const onScroll = () => sync();
  strip.addEventListener('click', onClick);
  strip.addEventListener('keydown', onKeydown);
  strip.addEventListener('scroll', onScroll, { passive: true });
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
      resizer?.disconnect();
      strip.removeEventListener('click', onClick);
      strip.removeEventListener('keydown', onKeydown);
      strip.removeEventListener('scroll', onScroll);
      strip.remove();
      rail.removeAttribute(RIGHT_RAIL_TABS_ATTRIBUTE);
      placeJoin(null, null);
      entries.clear();
    },
  };
}
