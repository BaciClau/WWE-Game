// Automatic "fit to viewport" safety net. Some players run the game in smaller browser
// windows / laptop screens than it was designed on, and a few "single view" screens (menu,
// opponent select, deck edit, match) are meant to show everything at once without scrolling.
// Rather than hand-tuning spacing for every possible window size, this detects when the real
// content doesn't fit the actual browser viewport and shrinks the WHOLE app uniformly (header
// + active screen) via transform:scale() until it does. List-heavy screens (card catalog,
// collection, missions, store, draft board, ladder rewards) are deliberately excluded — those
// are supposed to scroll internally when there's a lot of content, shrinking them into
// illegibility would be worse than the scrollbar they already have.
//
// NOTE: an earlier version of this used CSS `zoom` on <html>, which turned out not to work —
// zoom doesn't affect scrollHeight/clientHeight measurements (they stay in the element's own
// local/logical px), so overflow-y:auto still triggered internally even once "zoomed out",
// since body's height:100vh/100dvh doesn't respond to zoom either. transform:scale() on a
// dedicated wrapper (#app-viewport, see index.html/styles.css) actually works because the
// SCROLL/OVERFLOW DECISION happens on body (outer, unscaled, real-viewport-sized,
// overflow:hidden) comparing against the WRAPPER's rendered (post-transform) footprint, not
// against a local, transform-blind measurement.
const AUTOSCALE_SCREEN_IDS = ['main-menu', 'opp-select-screen', 'deck-edit-screen', 'match-screen'];
const AUTOSCALE_MIN = 0.55;

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

    const header = document.querySelector('header');
    const headerH = header ? header.getBoundingClientRect().height : 0;
    const naturalW = Math.max(wrapper.scrollWidth, activeScreen.scrollWidth);
    const naturalH = headerH + activeScreen.scrollHeight;

    let scale = Math.min(1, window.innerHeight / naturalH, window.innerWidth / naturalW);
    if (!isFinite(scale) || scale <= 0) scale = 1;
    // Below this, give up shrinking further and let the screen's own overflow-y:auto take
    // over as a last resort — better a normal scrollbar than unreadably tiny text.
    scale = Math.max(AUTOSCALE_MIN, scale);

    const stillOverflowsAtFloor = scale <= AUTOSCALE_MIN + 1e-6 &&
        (naturalH * scale > window.innerHeight + 0.5 || naturalW * scale > window.innerWidth + 0.5);

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
        wrapper.style.width = (window.innerWidth / scale) + 'px';
        wrapper.style.height = (window.innerHeight / scale) + 'px';
        wrapper.style.transform = 'scale(' + scale + ')';
    } else {
        wrapper.style.width = naturalW + 'px';
        wrapper.style.height = naturalH + 'px';
        wrapper.style.transform = 'scale(' + scale + ')';
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
}
