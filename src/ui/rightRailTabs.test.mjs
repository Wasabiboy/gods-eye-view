import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RIGHT_RAIL_TABS_ATTRIBUTE,
  RIGHT_RAIL_TABS_ID,
  createRightRailTabs,
  nextRailTabIndex,
  railJoinPath,
  railTabPanels,
} from './rightRailTabs.js';

/** Just enough DOM for the strip: tree, classes, attributes, events, focus. */
function makeDocument() {
  const doc = { activeElement: null };
  const findIn = (node, predicate) => {
    for (const child of node.children) {
      if (predicate(child)) return child;
      const nested = findIn(child, predicate);
      if (nested) return nested;
    }
    return null;
  };
  doc.createElement = (tag) => {
    const el = new EventTarget();
    const attrs = new Map();
    const classes = new Set();
    const props = new Map();
    Object.assign(el, {
      tagName: tag.toUpperCase(),
      ownerDocument: doc,
      children: [],
      parentElement: null,
      dataset: {},
      style: {
        props,
        setProperty: (key, value) => props.set(key, value),
        removeProperty: (key) => props.delete(key),
      },
      hidden: false,
      textContent: '',
      tabIndex: -1,
      title: '',
      type: '',
      id: '',
      classList: {
        add: (...names) => names.forEach((name) => classes.add(name)),
        remove: (...names) => names.forEach((name) => classes.delete(name)),
        contains: (name) => classes.has(name),
        toggle(name, on) {
          if (on) classes.add(name);
          else classes.delete(name);
        },
      },
      setAttribute: (key, value) => attrs.set(key, String(value)),
      getAttribute: (key) => attrs.get(key) ?? null,
      removeAttribute: (key) => attrs.delete(key),
      insertBefore(child, reference) {
        child.remove();
        const index = reference ? el.children.indexOf(reference) : -1;
        el.children.splice(index < 0 ? el.children.length : index, 0, child);
        child.parentElement = el;
        return child;
      },
      append(...nodes) {
        for (const node of nodes) el.insertBefore(node, null);
      },
      prepend(...nodes) {
        for (const node of nodes.reverse())
          el.insertBefore(node, el.children[0] ?? null);
      },
      remove() {
        const parent = el.parentElement;
        if (!parent) return;
        parent.children.splice(parent.children.indexOf(el), 1);
        el.parentElement = null;
      },
      matches(selector) {
        if (selector === '[data-panel-id]') return 'panelId' in el.dataset;
        if (selector === '[data-rail-tab]') return 'railTab' in el.dataset;
        return false;
      },
      closest(selector) {
        return el.matches(selector)
          ? el
          : (el.parentElement?.closest(selector) ?? null);
      },
      querySelector(selector) {
        const wanted = selector.split(',').map((part) => part.trim().slice(1));
        return findIn(el, (node) =>
          wanted.some((name) => node.classList.contains(name)),
        );
      },
      focus() {
        doc.activeElement = el;
      },
    });
    Object.defineProperties(el, {
      className: {
        get: () => [...classes].join(' '),
        set(value) {
          classes.clear();
          for (const name of String(value).split(/\s+/).filter(Boolean))
            classes.add(name);
        },
      },
      firstElementChild: { get: () => el.children[0] ?? null },
      nextElementSibling: {
        get: () => {
          const siblings = el.parentElement?.children;
          if (!siblings) return null;
          return siblings[siblings.indexOf(el) + 1] ?? null;
        },
      },
    });
    return el;
  };
  doc.body = doc.createElement('body');
  doc.getElementById = (id) => findIn(doc.body, (node) => node.id === id);
  return doc;
}

/** Dispatch a bubbling event with `target` fixed to `el`. */
function fire(el, type, props = {}) {
  const event = Object.assign(new Event(type, { cancelable: true }), props);
  Object.defineProperty(event, 'target', { value: el });
  for (let node = el; node; node = node.parentElement)
    node.dispatchEvent(event);
  return event;
}

function panel(
  doc,
  id,
  { title, titleClass = 'panel-title', collapsed = true, hidden = false },
) {
  const node = doc.createElement('div');
  node.id = id;
  node.dataset.panelId = id;
  node.hidden = hidden;
  if (collapsed) node.classList.add('collapsed');
  const header = doc.createElement('div');
  header.className = 'panel-header';
  const label = doc.createElement('span');
  label.className = titleClass;
  label.textContent = title;
  header.append(label);
  node.append(header);
  return node;
}

function fixture() {
  const doc = makeDocument();
  const rail = doc.createElement('aside');
  rail.id = 'right-context-rail';
  const display = panel(doc, 'pp-toggles', {
    title: 'DISPLAY',
    titleClass: 'pp-header-label',
  });
  const cctv = panel(doc, 'cctv-panel', { title: 'CCTV' });
  const weather = panel(doc, 'weather-panel', {
    title: 'WEATHER',
    collapsed: false,
    hidden: true,
  });
  const context = panel(doc, 'global-context-panel', { title: 'CONTEXT' });
  rail.append(display, cctv, weather, context);
  doc.body.append(rail);
  const calls = [];
  const tabs = createRightRailTabs({
    rail,
    documentRef: doc,
    setPanelCollapsed: (...args) => calls.push(args),
  });
  const strip = tabs.element;
  const tabFor = (id) =>
    strip.children.find((tab) => tab.dataset.railTab === id);
  const labelOf = (tab) =>
    tab.children.find((child) =>
      child.classList.contains('right-rail-tab-label'),
    ).textContent;
  return {
    doc,
    rail,
    display,
    cctv,
    weather,
    context,
    tabs,
    strip,
    calls,
    tabFor,
    labelOf,
  };
}

test('builds one tab per visible rail panel, in rail order, labelled from the panel header', () => {
  const f = fixture();
  assert.equal(
    f.rail.children[0],
    f.strip,
    'the tablist precedes its panels in the tab order',
  );
  assert.equal(f.strip.id, RIGHT_RAIL_TABS_ID);
  assert.equal(f.strip.getAttribute('role'), 'tablist');
  assert.equal(f.strip.getAttribute('aria-orientation'), 'vertical');
  assert.equal(f.rail.getAttribute(RIGHT_RAIL_TABS_ATTRIBUTE), 'vertical');
  assert.deepEqual(
    f.strip.children.map((tab) => [
      tab.dataset.railTab,
      f.labelOf(tab),
      tab.getAttribute('aria-controls'),
    ]),
    [
      ['pp-toggles', 'DISPLAY', 'pp-toggles'],
      ['cctv-panel', 'CCTV', 'cctv-panel'],
      ['global-context-panel', 'CONTEXT', 'global-context-panel'],
    ],
    'a hidden panel (Weather off) has no tab',
  );
  for (const tab of f.strip.children) {
    assert.equal(tab.getAttribute('role'), 'tab');
    assert.equal(tab.type, 'button');
  }
  assert.deepEqual(
    railTabPanels(f.rail).map((p) => p.id),
    ['pp-toggles', 'cctv-panel', 'global-context-panel'],
  );
});

test('mirrors collapsed state into aria-selected, a roving tabindex and titles', () => {
  const f = fixture();
  assert.deepEqual(
    f.strip.children.map((tab) => tab.getAttribute('aria-selected')),
    ['false', 'false', 'false'],
  );
  assert.deepEqual(
    f.strip.children.map((tab) => tab.tabIndex),
    [0, -1, -1],
    'nothing open: the first tab is reachable',
  );
  assert.equal(f.tabFor('cctv-panel').title, 'Expand CCTV');
  f.cctv.classList.remove('collapsed');
  f.tabs.sync();
  assert.deepEqual(
    f.strip.children.map((tab) => tab.getAttribute('aria-selected')),
    ['false', 'true', 'false'],
  );
  assert.deepEqual(
    f.strip.children.map((tab) => tab.tabIndex),
    [-1, 0, -1],
    'the open panel owns the tab stop',
  );
  assert.equal(f.tabFor('cctv-panel').title, 'Collapse CCTV');
});

test('a click asks the owner for an explicit toggle and never touches the panel itself', () => {
  const f = fixture();
  fire(f.tabFor('cctv-panel'), 'click');
  assert.deepEqual(f.calls, [['cctv-panel', false, { explicit: true }]]);
  assert.equal(
    f.cctv.classList.contains('collapsed'),
    true,
    'the strip leaves the class to the owner',
  );
  f.cctv.classList.remove('collapsed');
  f.tabs.sync();
  fire(f.tabFor('cctv-panel'), 'click');
  assert.deepEqual(f.calls.at(-1), ['cctv-panel', true, { explicit: true }]);
  fire(f.strip, 'click');
  assert.equal(f.calls.length, 2, 'a click beside the tabs does nothing');
});

test('arrow keys move focus through the visible tabs and wrap; Home and End jump', () => {
  assert.equal(nextRailTabIndex('ArrowDown', 2, 3), 0);
  assert.equal(nextRailTabIndex('ArrowUp', 0, 3), 2);
  assert.equal(nextRailTabIndex('Home', 2, 3), 0);
  assert.equal(nextRailTabIndex('End', 0, 3), 2);
  assert.equal(nextRailTabIndex('Enter', 1, 3), 1);
  assert.equal(nextRailTabIndex('ArrowDown', 0, 0), -1);
  const f = fixture();
  const first = f.tabFor('pp-toggles');
  first.focus();
  const down = fire(first, 'keydown', { key: 'ArrowDown' });
  assert.equal(f.doc.activeElement, f.tabFor('cctv-panel'));
  assert.equal(down.defaultPrevented, true);
  fire(f.doc.activeElement, 'keydown', { key: 'ArrowUp' });
  fire(f.doc.activeElement, 'keydown', { key: 'ArrowUp' });
  assert.equal(
    f.doc.activeElement,
    f.tabFor('global-context-panel'),
    'Up from the first tab wraps to the last',
  );
  const enter = fire(f.doc.activeElement, 'keydown', { key: 'Enter' });
  assert.equal(
    enter.defaultPrevented,
    false,
    'activation keys stay with the button',
  );
  assert.deepEqual(f.calls, [], 'moving focus opens nothing');
});

test('a panel that appears gets its tab in rail order; one that leaves loses it', () => {
  const f = fixture();
  f.weather.hidden = false;
  f.tabs.sync();
  assert.deepEqual(
    f.strip.children.map((tab) => tab.dataset.railTab),
    ['pp-toggles', 'cctv-panel', 'weather-panel', 'global-context-panel'],
  );
  assert.equal(f.tabFor('weather-panel').getAttribute('aria-selected'), 'true');
  const cctvTab = f.tabFor('cctv-panel');
  f.cctv.remove();
  f.tabs.sync();
  assert.deepEqual(
    f.strip.children.map((tab) => tab.dataset.railTab),
    ['pp-toggles', 'weather-panel', 'global-context-panel'],
  );
  assert.equal(cctvTab.parentElement, null);
  assert.equal(f.tabFor('pp-toggles').tabIndex, -1);
  assert.equal(f.tabFor('weather-panel').tabIndex, 0);
});

test('a sync that changes nothing keeps the same tab elements in place', () => {
  const f = fixture();
  const before = [...f.strip.children];
  f.tabFor('cctv-panel').focus();
  f.tabs.sync();
  assert.deepEqual([...f.strip.children], before);
  assert.equal(f.doc.activeElement, f.tabFor('cctv-panel'));
});

test('publishes the open tab extent on the rail and keeps a join element under the panels', () => {
  const f = fixture();
  const { props } = f.rail.style;
  assert.equal(f.tabs.join.parentElement, f.rail);
  assert.equal(f.tabs.join.getAttribute('aria-hidden'), 'true');
  assert.equal(f.tabs.join.hidden, true, 'nothing open, nothing to join');
  assert.deepEqual(
    f.tabs.join.children.map((layer) => layer.getAttribute('class')),
    [
      'right-rail-join-shadow',
      'right-rail-join-glass',
      'right-rail-join-outline',
    ],
  );
  const tab = f.tabFor('cctv-panel');
  Object.assign(tab, {
    offsetTop: 86,
    offsetLeft: 0,
    offsetHeight: 56,
    offsetWidth: 42,
  });
  Object.assign(f.cctv, {
    offsetTop: 0,
    offsetLeft: 0,
    offsetHeight: 300,
    offsetWidth: 330,
  });
  f.strip.scrollTop = 0;
  f.cctv.classList.remove('collapsed');
  f.tabs.sync();
  assert.deepEqual([...props], [['--rail-tab-bottom', '142px']]);
  assert.equal(f.tabs.join.hidden, false);
  const [, glass] = f.tabs.join.children;
  assert.match(
    glass.style.clipPath,
    /^path\('M 16 0 L 314 0 A 16 16 0 0 1 330 16 L 330 78 /,
  );
  f.strip.scrollTop = 20;
  f.tabs.sync();
  assert.equal(
    props.get('--rail-tab-bottom'),
    '122px',
    'strip scroll is subtracted',
  );
  f.cctv.classList.add('collapsed');
  f.tabs.sync();
  assert.deepEqual([...props], [], 'no open panel, no join');
  assert.equal(f.tabs.join.hidden, true);
  f.tabs.destroy();
  assert.equal(f.tabs.join.parentElement, null);
});

test('railJoinPath traces the panel with the tab attached: corners, fillets, tab corners', () => {
  const geometry = {
    panel: { x0: 0, y0: 0, x1: 330, y1: 378 },
    tab: { top: 85, bottom: 141, right: 372 },
    corner: 16,
    tabRadius: 10,
    fillet: 8,
  };
  assert.equal(
    railJoinPath(geometry),
    'M 16 0 L 314 0 A 16 16 0 0 1 330 16 L 330 77 A 8 8 0 0 0 338 85 ' +
      'L 362 85 A 10 10 0 0 1 372 95 L 372 131 A 10 10 0 0 1 362 141 ' +
      'L 338 141 A 8 8 0 0 0 330 149 L 330 362 A 16 16 0 0 1 314 378 ' +
      'L 16 378 A 16 16 0 0 1 0 362 L 0 16 A 16 16 0 0 1 16 0 Z',
  );
  assert.equal(
    railJoinPath({ ...geometry, tab: { top: 0, bottom: 79, right: 372 } }),
    'M 16 0 L 362 0 A 10 10 0 0 1 372 10 L 372 69 A 10 10 0 0 1 362 79 ' +
      'L 338 79 A 8 8 0 0 0 330 87 L 330 362 A 16 16 0 0 1 314 378 ' +
      'L 16 378 A 16 16 0 0 1 0 362 L 0 16 A 16 16 0 0 1 16 0 Z',
    'a tab level with the top shares the top edge: no corner, no upper fillet',
  );
  const stroke = railJoinPath({ ...geometry, inset: 0.5 });
  assert.match(stroke, /^M 16 0\.5 L 314 0\.5 A 15\.5 15\.5 0 0 1 329\.5 16 /);
  assert.match(
    stroke,
    / L 329\.5 77 A 8\.5 8\.5 0 0 0 338 85\.5 /,
    'an inset grows the concave fillets and shrinks the convex corners',
  );
  const chamfer = railJoinPath({
    ...geometry,
    panel: { x0: 0, y0: 0, x1: 312, y1: 374 },
    corner: 10,
    style: 'chamfer',
  });
  assert.equal(
    chamfer,
    'M 0 10 L 10 0 L 131 0 L 138 6 L 174 6 L 181 0 L 302 0 L 312 10 ' +
      'L 312 85 L 372 85 L 372 141 L 312 141 L 312 364 L 302 374 ' +
      'L 10 374 L 0 364 Z',
    'Cyber: chamfers, the calibration bay and a square tab',
  );
});

test('destroy removes the strip and stops listening', () => {
  const f = fixture();
  const tab = f.tabFor('cctv-panel');
  f.tabs.destroy();
  assert.equal(f.strip.parentElement, null);
  assert.equal(f.rail.children.includes(f.strip), false);
  assert.equal(f.rail.getAttribute(RIGHT_RAIL_TABS_ATTRIBUTE), null);
  fire(tab, 'click');
  assert.deepEqual(f.calls, []);
  f.tabs.destroy();
});

test('refuses to build without a rail, a document or an owner callback', () => {
  const doc = makeDocument();
  assert.throws(
    () => createRightRailTabs({ rail: null, setPanelCollapsed() {} }),
    TypeError,
  );
  assert.throws(
    () =>
      createRightRailTabs({
        rail: doc.createElement('aside'),
        documentRef: doc,
      }),
    TypeError,
  );
});
