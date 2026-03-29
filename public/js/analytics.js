/**
 * getmi.ai — analytics.js
 * Firebase Analytics (GA4 via compat SDK).
 * Requer firebase-analytics-compat.js carregado ANTES deste arquivo.
 *
 * Debug mode: instale "Google Analytics Debugger" no Chrome e ative.
 * Ou acesse: https://console.firebase.google.com → Analytics → DebugView
 */
(function () {
  var analytics = null;

  /* Inicializa se o SDK de analytics estiver presente */
  try {
    if (typeof firebase !== 'undefined' && typeof firebase.analytics === 'function') {
      analytics = firebase.analytics();
    }
  } catch (e) {
    console.warn('[getmi analytics] SDK não disponível:', e.message);
  }

  /* ── API pública ────────────────────────────────────────────────────── */
  window.gmTrack = function (eventName, params) {
    if (!analytics) return;
    try {
      analytics.logEvent(eventName, params || {});
    } catch (e) {
      console.warn('[getmi analytics] logEvent falhou:', e.message);
    }
  };

  /* ── Pageview automático ────────────────────────────────────────────── */
  window.gmTrack('page_view', {
    page_path:     window.location.pathname,
    page_title:    document.title,
    page_location: window.location.href,
  });

  /* ── Eventos customizados (chamados pelos módulos) ──────────────────── */

  /**
   * Disparar após createUserWithEmailAndPassword ou Google register.
   * @param {string} method  'email' | 'google'
   */
  window.gmTrackPageCreated = function (method) {
    window.gmTrack('page_created', { method: method || 'unknown' });
  };

  /**
   * Disparar após addDoc em users/{uid}/links.
   * @param {string} type  'monetization' | 'secondary' | 'social' | 'whatsapp'
   */
  window.gmTrackLinkAdded = function (type) {
    window.gmTrack('link_added', { link_type: type || 'unknown' });
  };

  /**
   * Disparar no clique de um link na p.html.
   * @param {string} linkId
   * @param {string} type
   */
  window.gmTrackLinkClicked = function (linkId, type) {
    window.gmTrack('link_clicked', {
      link_id:   linkId || '',
      link_type: type   || 'unknown',
    });
  };

  /**
   * Disparar após updateDoc do tema em admin-design.js.
   * @param {string} preset  nome do preset ou 'custom'
   */
  window.gmTrackThemeChanged = function (preset) {
    window.gmTrack('theme_changed', { preset: preset || 'custom' });
  };

})();
