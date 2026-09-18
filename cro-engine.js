/**
 * Mini CRO Engine — MVP
 * Loads experiments.json, buckets the visitor deterministically,
 * runs the matching variation function (from cro-variations.js),
 * then reveals the page.
 *
 * Load order in <head>:
 *   1. anti-flicker inline snippet (hides <html>)
 *   2. cro-variations.js   (defines window.croVariations)
 *   3. cro-engine.js       (this file)
 */
(function () {
  var CONFIG_URL = 'experiments.json';
  var COOKIE_NAME = '_cro_vid';
  var BUCKET_SIZE = 10000; // same resolution Optimizely uses internally

  // 1. Get or create a persistent visitor ID (180-day cookie)
  function getVisitorId() {
    var match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
    if (match) return match[1];
    var id = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    var expires = new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = COOKIE_NAME + '=' + id + '; expires=' + expires + '; path=/';
    return id;
  }

  // 2. Deterministic string hash -> integer bucket (0 to BUCKET_SIZE-1)
  //    Same visitorId + experimentId always produces the same bucket.
  function hashToBucket(str) {
    var hash = 0;
    for (var i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) >>> 0; // unsigned 32-bit
    }
    return hash % BUCKET_SIZE;
  }

  // 3. Decide which variation (if any) this visitor falls into
  function assignVariation(visitorId, experiment) {
    var bucket = hashToBucket(visitorId + experiment.id);
    if (bucket >= experiment.trafficAllocation) return null; // outside the test entirely

    var cumulative = 0;
    for (var i = 0; i < experiment.variations.length; i++) {
      cumulative += experiment.variations[i].weight;
      if (bucket < cumulative) return experiment.variations[i].id;
    }
    return null;
  }

  // 4. Remove the anti-flicker hide class
  function revealPage() {
    document.documentElement.classList.remove('cro-hide');
  }

  function init(config) {
    var visitorId = getVisitorId();
    var assignments = {};

    (config.experiments || []).forEach(function (experiment) {
      var variationId = assignVariation(visitorId, experiment);
      assignments[experiment.id] = variationId || 'control';

      if (variationId && variationId !== 'control') {
        var action =
          window.croVariations &&
          window.croVariations[experiment.id] &&
          window.croVariations[experiment.id][variationId];

        if (typeof action === 'function') {
          try {
            action();
          } catch (e) {
            console.error('[CRO] variation error in', experiment.id, variationId, e);
          }
        }
      }
    });

    // Stash assignments globally — next step (event tracking) will read this
    window.croAssignments = assignments;
    window.croVisitorId = visitorId;
    console.log('[CRO] visitor', visitorId, 'assignments', assignments);

    revealPage();
  }

  fetch(CONFIG_URL)
    .then(function (r) {
      return r.json();
    })
    .then(init)
    .catch(function (err) {
      console.error('[CRO] failed to load config, showing original page', err);
      revealPage(); // never leave the page hidden if something breaks
    });
})();
