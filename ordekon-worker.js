'use strict';

/* Ordekon körs utanför gränssnittstråden. Alla resurser är lokala och
   cachelagras av VävR:s service worker. */
importScripts('./ordekon-kelly.js', './ordekon-engine.js');

self.addEventListener('message', event => {
  const requestId = event.data?.requestId;
  const blocks = Array.isArray(event.data?.blocks) ? event.data.blocks : [];
  try {
    self.postMessage({ requestId, result: self.Ordekon.analyze(blocks) });
  } catch (error) {
    self.postMessage({
      requestId,
      error: error?.message || 'Ordekon kunde inte analysera texten.'
    });
  }
});
