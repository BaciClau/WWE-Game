// Automatic "fit to viewport" safety net. Some players run the game in smaller browser
// windows / laptop screens than it was designed on, and a few "single view" screens (menu,
// opponent select, match) are meant to show everything at once without scrolling.
// Rather than hand-tuning spacing for every possible window size, this detects when the real
// content doesn't fit the actual browser viewport and shrinks it via transform:scale() until
// it does. The header is NEVER part of this — it's a sibling of #app-viewport, always full
// width at its natural size, so it stays a normal fixed toolbar instead of shrinking/growing
// along with the content. List-heavy screens (card catalog, collection, missions, store,
// draft board, ladder rewards) are deliberately excluded from scaling — those are supposed to
// scroll internally when there's a lot of content, shrinking them into illegibility would be
// worse than the scrollbar they already have.
//
// NOTE: an earlier version of this used CSS `zoom` on <html>, which turned out not to work —
// zoom doesn't affect scrollHeight/clientHeight measurements (they stay in the element's own
// local/logical px), so overflow-y:auto still triggered internally even once "zoomed out",
// since body's height:100vh/100dvh doesn't respond to zoom either. transform:scale() on a
// dedicated wrapper (#app-viewport, see index.html/styles.css) actually works because the
// SCROLL/OVERFLOW DECISION happens on body (outer, unscaled, real-viewport-sized,
// overflow:hidden) comparing against the WRAPPER's rendered (post-transform) footprint, not
// against a local, transform-blind measurement.
// deck-edit-screen is deliberately NOT in this list — it has both a fixed "your deck" section
// AND an unbounded collection grid below it, and toggling edit mode changes its content height
// (toolbar/banner + "IN DECK" labels), which kept nudging the computed scale every time edit
// mode was entered/exited — a small but constant, distracting resize. A normal scrollbar there
// is the better tradeoff, same as the other list-heavy screens below.
const AUTOSCALE_SCREEN_IDS = ['main-menu', 'opp-select-screen', 'match-screen'];
// 0.40, not the old 0.55: real portrait phones need ~0.50-0.53 for these screens (e.g. a
// 360x640 device), and at 0.55 they fell into the "give up and scroll" branch — which set
// the wrapper WIDER than the device, made mobile browsers auto-zoom-out (inflating
// innerWidth past the 480px mobile-stylesheet breakpoint), and visibly wrecked the whole
// layout. The floor now only catches genuinely pathological shapes (tiny landscape panes),
// where an internal scrollbar beats unreadably microscopic text.
const AUTOSCALE_MIN = 0.40;

let _autoscaleRaf = null;
let _autoscaleResizeObserver = null;
let _autoscaleObservedScreen = null;
// While true, the ResizeObserver ignores notifications — set around every wrapper/screen
// style write below, since those themselves resize the observed element and would otherwise
// re-trigger the observer recursively.
let _autoscaleSuppressObserver = false;

function _autoscaleReset(wrapper, activeScreen) {
    wrapper.style.transform = '';
    wrapper.style.width = '';
    wrapper.style.height = '';
    document.querySelectorAll('.autoscale-native-size').forEach(el => {
        if (el !== activeScreen) el.classList.remove('autoscale-native-size');
    });
}

// Builds a transform that scales from the wrapper's true (0,0) origin — which always matches
// the real viewport's top-left corner — and then translates the SCALED result to center it
// horizontally within the viewport. Using an explicit translate instead of a percentage
// transform-origin avoids depending on how wide the wrapper's own box happens to be (it's
// sometimes wider than the viewport on purpose, see the "still overflows at floor" case
// below), which a percentage origin would get wrong.
function _autoscaleTransform(wrapW, scale) {
    const renderedW = wrapW * scale;
    const translateX = Math.max(0, (window.innerWidth - renderedW) / 2);
    return 'translate(' + translateX + 'px, 0px) scale(' + scale + ')';
}

function _autoscaleCompute() {
    const activeScreen = document.querySelector('.screen.active');
    const wrapper = document.getElementById('app-viewport');
    if (!wrapper) return;

    if (!activeScreen || AUTOSCALE_SCREEN_IDS.indexOf(activeScreen.id) === -1) {
        _autoscaleReset(wrapper, null);
        if (activeScreen) activeScreen.classList.remove('autoscale-native-size');
        return;
    }

    _autoscaleSuppressObserver = true;

    // Always measure from a clean baseline: no transform, and let this screen grow to its
    // true natural content height (autoscale-native-size overrides its own overflow-y:auto)
    // instead of being clipped to whatever space was available under a previous scale.
    _autoscaleReset(wrapper, activeScreen);
    activeScreen.classList.add('autoscale-native-size');

    // header is now a sibling of #app-viewport (not inside it) so it always renders at its
    // natural 1:1 size, full-width, never scaled — only the space BELOW it is available for
    // the wrapper to fill.
    const header = document.querySelector('header');
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const availH = window.innerHeight - headerH;
    // Content is usually narrower than the viewport (.screen has max-width + margin:auto to
    // stay centered) — sizing the wrapper to the CONTENT's own width instead of the viewport
    // would shrink it down to that narrower box and, since transform-origin is top-left, pin
    // everything to the top-left corner with a big empty gap on the right instead of staying
    // centered. Always keep at least the viewport width; only grow wider if content genuinely
    // needs more.
    const naturalW = Math.max(window.innerWidth, activeScreen.scrollWidth);
    const naturalH = activeScreen.scrollHeight;

    let scale = Math.min(1, availH / naturalH, window.innerWidth / naturalW);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    // Below this, give up shrinking further and let the screen's own overflow-y:auto take
    // over as a last resort — better a normal scrollbar than unreadably tiny text.
    scale = Math.max(AUTOSCALE_MIN, scale);

    const stillOverflowsAtFloor = scale <= AUTOSCALE_MIN + 1e-6 &&
        (naturalH * scale > availH + 0.5 || naturalW * scale > window.innerWidth + 0.5);

    if (scale >= 0.999) {
        // Fits natively — leave everything at rest, normal overflow-y:auto stays harmless
        // since it won't actually trigger.
        activeScreen.classList.remove('autoscale-native-size');
    } else if (stillOverflowsAtFloor) {
        // Even the minimum readable scale isn't enough (e.g. a huge card collection on
        // deck-edit-screen) — restore the screen's OWN overflow-y:auto instead of forcing its
        // native size, and size the wrapper to exactly fill the viewport at this scale. That
        // way the leftover excess still scrolls normally within the screen, instead of being
        // silently clipped off-screen by body's overflow:hidden with nothing to reach it.
        activeScreen.classList.remove('autoscale-native-size');
        const floorW = window.innerWidth / scale;
        wrapper.style.width = floorW + 'px';
        wrapper.style.height = (availH / scale) + 'px';
        wrapper.style.transform = _autoscaleTransform(floorW, scale);
    } else {
        wrapper.style.width = naturalW + 'px';
        wrapper.style.height = naturalH + 'px';
        wrapper.style.transform = _autoscaleTransform(naturalW, scale);
    }

    // Give the browser two frames to deliver (and let us ignore) any ResizeObserver
    // notifications caused by our own style writes above before listening again for real ones.
    requestAnimationFrame(() => requestAnimationFrame(() => { _autoscaleSuppressObserver = false; }));
}

function scheduleAutoScale() {
    if (_autoscaleRaf) cancelAnimationFrame(_autoscaleRaf);
    _autoscaleRaf = requestAnimationFrame(() => {
        _autoscaleRaf = null;
        _autoscaleCompute();
        _autoscaleWatchActiveScreen();
    });
}

// Keeps watching the currently active screen for content-size changes (round transitions,
// deck edits, card reveals, etc.) so the scale stays correct without needing a manual hook in
// every place that can change a screen's content — a resize/mutation anywhere it matters
// re-triggers this automatically.
function _autoscaleWatchActiveScreen() {
    const activeScreen = document.querySelector('.screen.active');
    if (activeScreen === _autoscaleObservedScreen) return;
    if (_autoscaleResizeObserver) _autoscaleResizeObserver.disconnect();
    _autoscaleObservedScreen = activeScreen;
    if (!activeScreen || AUTOSCALE_SCREEN_IDS.indexOf(activeScreen.id) === -1) return;
    _autoscaleResizeObserver = new ResizeObserver(() => {
        if (_autoscaleSuppressObserver) return;
        scheduleAutoScale();
    });
    _autoscaleResizeObserver.observe(activeScreen);
}

if (typeof ResizeObserver !== 'undefined') {
    window.addEventListener('resize', scheduleAutoScale);
    window.addEventListener('DOMContentLoaded', scheduleAutoScale);
    // Mobile browsers resize the usable viewport when the URL bar / toolbars slide in and
    // out (and on rotation) without always firing a window resize — visualViewport does.
    if (window.visualViewport) window.visualViewport.addEventListener('resize', scheduleAutoScale);
    window.addEventListener('orientationchange', scheduleAutoScale);
}
