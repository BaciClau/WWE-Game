window.onload = initGame;

// Small, non-intrusive version tag in the corner — DISPLAY_VERSION comes from
// src/core/display-version.js, updated by running scripts/update-version.js (or
// update-version.bat) after a commit.
(function () {
    var badge = document.getElementById('version-badge');
    if (badge && typeof DISPLAY_VERSION !== 'undefined') badge.innerText = DISPLAY_VERSION;
})();
