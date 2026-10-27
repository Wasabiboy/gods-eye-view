/**
 * Vertical tab strip for the right context rail: one sideways tab per rail
 * panel, the open panel beside the strip, at most one panel open. The panels'
 * `collapsed` classes remain the only state; the strip mirrors them and asks
 * the owner (setPanelCollapsed) for every change, so persistence, share links
 * and the rail layout pass are untouched. Phones hide the strip and keep their
 * sheet shell (mobileShell.js).
 *
 * The open tab and its panel are one surface: the strip measures both, traces
 * their joined silhouette as an SVG path (railJoinPath) and keeps a join
 * element under the panels whose layers blur, tint, outline and shadow that
 * shape (styles/right-rail-tabs.css).
 */
import { msg, t } from '../i18n/index.js';

export const RIGHT_RAIL_TABS_ID = 'right-rail-tabs';

/**
 * Marks the rail while its strip is mounted; styles/right-rail-tabs.css keys
 * the tab geometry on it, so a rail without a strip keeps its plain layout.
 */
export const RIGHT_RAIL_TABS_ATTRIBUTE = 'data-rail-tabs';

const SVG_NS = 'http://www.w3.org/2000/svg';

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

/**
 * SVG path of the panel with the open tab attached to its right edge, traced
 * clockwise from the top-left corner, in rail pixels.
 *
 * Round: the panel's corners and the tab's outer corners are convex arcs and
 * the two inner corners where the tab's top and bottom edges meet the panel's
 * right edge are concave fillets. A tab level with the panel's top shares its
 * top edge, so that corner and the upper fillet are dropped. Chamfer (Cyber):
 * the frame's 10px chamfers and 6px calibration bay (cyber.css,
 * --cyber-panel-frame) and a square tab. `inset` moves the whole outline
 * inward; 0.5 centres a one-pixel stroke just inside the edge.
 *
 * @param {object} g
 * @param {{x0: number, y0: number, x1: number, y1: number}} g.panel
 * @param {{top: number, bottom: number, right: number}} g.tab The tab's
 *   extent; its left edge is the panel's right edge.
 * @param {number} [g.corner] Panel corner radius, or the chamfer size.
 * @param {number} [g.tabRadius] The tab's outer corner radius.
 * @param {number} [g.fillet] Concave fillet radius at the junction.
 * @param {'round'|'chamfer'} [g.style]
 * @param {number} [g.inset]
 * @returns {string}
 */
export function railJoinPath({
  panel,
  tab,
  corner = 16,
  tabRadius = 10,
  fillet = 8,
  style = 'round',
  inset = 0,
}) {
  const n = (value) => Math.round(value * 100) / 100;
  const P = (x, y) => `${n(x)} ${n(y)}`;
  const x0 = panel.x0 + inset;
  const y0 = panel.y0 + inset;
  const x1 = panel.x1 - inset;
  const y1 = panel.y1 - inset;
  const ty0 = tab.top + inset;
  const ty1 = tab.bottom - inset;
  const tx1 = tab.right - inset;
  if (style === 'chamfer') {
    const c = corner;
    const cx = (panel.x0 + panel.x1) / 2;
    return [
      `M ${P(x0, y0 + c)}`,
      `L ${P(x0 + c, y0)}`,
      `L ${P(cx - 25, y0)}`,
      `L ${P(cx - 18, y0 + 6)}`,
      `L ${P(cx + 18, y0 + 6)}`,
      `L ${P(cx + 25, y0)}`,
      `L ${P(x1 - c, y0)}`,
      `L ${P(x1, y0 + c)}`,
      `L ${P(x1, ty0)}`,
      `L ${P(tx1, ty0)}`,
      `L ${P(tx1, ty1)}`,
      `L ${P(x1, ty1)}`,
      `L ${P(x1, y1 - c)}`,
      `L ${P(x1 - c, y1)}`,
      `L ${P(x0 + c, y1)}`,
      `L ${P(x0, y1 - c)}`,
      'Z',
    ].join(' ');
  }
  const R = Math.max(0, corner - inset);
  const r = Math.max(0, tabRadius - inset);
  const f = fillet + inset;
  // sweep 1 turns clockwise (convex), 0 counter-clockwise (concave).
  const arc = (radius, sweep, x, y) =>
    `A ${n(radius)} ${n(radius)} 0 0 ${sweep} ${P(x, y)}`;
  const first = tab.top - panel.y0 < 0.5;
  const d = [`M ${P(x0 + R, y0)}`];
  if (first) {
    d.push(`L ${P(tx1 - r, y0)}`, arc(r, 1, tx1, y0 + r));
  } else {
    d.push(
      `L ${P(x1 - R, y0)}`,
      arc(R, 1, x1, y0 + R),
      `L ${P(x1, ty0 - f)}`,
      arc(f, 0, x1 + f, ty0),
      `L ${P(tx1 - r, ty0)}`,
      arc(r, 1, tx1, ty0 + r),
    );
  }
  d.push(
    `L ${P(tx1, ty1 - r)}`,
    arc(r, 1, tx1 - r, ty1),
    `L ${P(x1 + f, ty1)}`,
    arc(f, 0, x1, ty1 + f),
    `L ${P(x1, y1 - R)}`,
    arc(R, 1, x1 - R, y1),
    `L ${P(x0 + R, y1)}`,
    arc(R, 1, x0, y1 - R),
    `L ${P(x0, y0 + R)}`,
    arc(R, 1, x0 + R, y0),
    'Z',
  );
  return d.join(' ');
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
  strip.setAttribute('role', 'tablist');
  strip.setAttribute('aria-orientation', 'vertical');
  strip.setAttribute('aria-label', t('Panels'));
  rail.setAttribute(RIGHT_RAIL_TABS_ATTRIBUTE, 'vertical');

  // The join: shadow under, glass, outline over; all shaped by one path.
  const svg = (tag) =>
    documentRef.createElementNS?.(SVG_NS, tag) ??
    documentRef.createElement(tag);
  const join = documentRef.createElement('div');
  join.className = 'right-rail-join';
  join.setAttribute('aria-hidden', 'true');
  join.hidden = true;
  const shadow = svg('svg');
  shadow.setAttribute('class', 'right-rail-join-shadow');
  const shadowPath = svg('path');
  shadow.append(shadowPath);
  const glass = documentRef.createElement('div');
  glass.setAttribute('class', 'right-rail-join-glass');
  const outline = svg('svg');
  outline.setAttribute('class', 'right-rail-join-outline');
  const outlinePath = svg('path');
  outline.append(outlinePath);
  join.append(shadow, glass, outline);

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
    entry = { tab, label };
    entries.set(panel.id, entry);
    return entry;
  };

  const Observer =
    documentRef.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  const observer =
    typeof Observer === 'function' ? new Observer(() => sync()) : null;
  // Tab heights follow their labels (fonts, locale) and panel heights their
  // content and allocation: re-measure the join when the strip or a panel
  // changes size and on strip scroll.
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

  /** A join token from the stylesheet (--right-rail-*), in pixels. */
  const token = (computed, name, fallback) => {
    const value = parseFloat(computed?.getPropertyValue?.(name));
    return Number.isFinite(value) ? value : fallback;
  };

  /**
   * Publish the join: the open tab's bottom on the rail (--rail-tab-bottom,
   * rail pixels; the stylesheet sets the panel's minimum height from it) and
   * the joined silhouette on the join's layers. The rail can be taller than
   * its panel in the focus layout, so the join is sized from the panel,
   * extended down to cover the tab if that is shorter.
   */
  function placeJoin(tab, panel) {
    if (!tab) {
      rail.style.removeProperty('--rail-tab-bottom');
      join.hidden = true;
      return;
    }
    const top = tab.offsetTop - (strip.scrollTop || 0);
    rail.style.setProperty('--rail-tab-bottom', `${top + tab.offsetHeight}px`);
    const computed = documentRef.defaultView?.getComputedStyle?.(rail);
    const corner = token(computed, '--right-rail-corner', 16);
    const tabRadius = token(computed, '--right-rail-tab-radius', 10);
    const fillet = token(computed, '--right-rail-fillet', 8);
    const chamfer =
      computed?.getPropertyValue?.('--right-rail-join-style').trim() ===
      'chamfer';
    const tabTop = (strip.offsetTop || 0) + top;
    const tabBottom = tabTop + tab.offsetHeight;
    const geometry = {
      panel: {
        x0: panel.offsetLeft,
        y0: panel.offsetTop,
        x1: panel.offsetLeft + panel.offsetWidth,
        y1: Math.max(
          panel.offsetTop + panel.offsetHeight,
          tabBottom + fillet + 4 + corner,
        ),
      },
      tab: {
        top: tabTop,
        bottom: tabBottom,
        right: (strip.offsetLeft || 0) + tab.offsetLeft + tab.offsetWidth,
      },
      corner,
      tabRadius,
      fillet,
      style: chamfer ? 'chamfer' : 'round',
    };
    const shape = railJoinPath(geometry);
    const width = rail.clientWidth;
    const height = geometry.panel.y1;
    join.style.height = `${height}px`;
    glass.style.clipPath = `path('${shape}')`;
    shadowPath.setAttribute('d', shape);
    // Everything but the silhouette: the shadow it casts stays, the fill goes.
    shadow.style.clipPath = `path(evenodd, 'M -80 -80 H ${width + 80} V ${height + 80} H -80 Z ${shape}')`;
    outlinePath.setAttribute('d', railJoinPath({ ...geometry, inset: 0.5 }));
    join.hidden = false;
  }

  /** Reconcile tabs with the rail: order, visibility, selection, labels. */
  function sync() {
    if (destroyed) return;
    // The tablist precedes its panels in the tab order, so Tab from the open
    // tab lands inside the open panel. The rail owner moves panels in at
    // start-up; keep the strip first afterwards too.
    if (rail.firstElementChild !== strip) rail.prepend(strip);
    if (join.parentElement !== rail) rail.append(join);
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
  rail.append(join);
  sync();

  return {
    element: strip,
    join,
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
      join.remove();
      rail.removeAttribute(RIGHT_RAIL_TABS_ATTRIBUTE);
      placeJoin(null, null);
      entries.clear();
    },
  };
}
