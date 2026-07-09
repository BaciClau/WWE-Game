window.onload = initGame;

// Small, non-intrusive version tag in the corner — DISPLAY_VERSION comes from
// src/core/display-version.js, auto-written by .git/hooks/commit-msg from the commit title.
(function () {
    var badge = document.getElementById('version-badge');
    if (badge && typeof DISPLAY_VERSION !== 'undefined') badge.innerText = DISPLAY_VERSION;
})();
