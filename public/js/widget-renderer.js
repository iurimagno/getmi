/**
 * getmi.ai — widget-renderer.js
 * Engine de renderização de widget_instances na bio page (p.html).
 * Substitui {{placeholders}} no renderTemplate com valores do config.
 * Injeta renderCSS via <style> tag única por template.
 */

(function (global) {
  'use strict';

  var injectedStyles = {};   // templateId → true (evita duplicatas)

  /**
   * Renderiza uma lista de instâncias de widget no container dado.
   * @param {Array}   instances  Array de widget_instance docs (com .template anexado)
   * @param {Element} container  Elemento DOM onde inserir
   */
  function renderWidgets(instances, container) {
    if (!instances || !instances.length || !container) return;

    instances.forEach(function (inst) {
      var el = renderOne(inst);
      if (el) container.appendChild(el);
    });
  }

  /**
   * Renderiza uma única instância e retorna o elemento DOM.
   * @param  {Object} inst  { templateId, config, size, template: {...} }
   * @return {Element|null}
   */
  function renderOne(inst) {
    var tpl = inst.template;
    if (!tpl || !tpl.renderTemplate) return null;

    // Injeta CSS do template (uma vez por tipo)
    if (tpl.renderCSS && !injectedStyles[inst.templateId]) {
      injectStyle(inst.templateId, tpl.renderCSS);
      injectedStyles[inst.templateId] = true;
    }

    var html = interpolate(tpl.renderTemplate, inst.config || {});

    var wrapper = document.createElement('div');
    wrapper.className = 'g-wgt-wrap g-wgt-wrap--' + (tpl.type || 'unknown');
    wrapper.setAttribute('data-widget-id', inst.id || '');
    wrapper.setAttribute('data-template-id', inst.templateId || '');
    wrapper.innerHTML = sanitize(html);

    return wrapper;
  }

  /**
   * Substitui {{key}} pelo valor correspondente no config.
   * Valores ausentes ficam como string vazia.
   */
  function interpolate(template, config) {
    return template.replace(/\{\{([^}]+)\}\}/g, function (_, key) {
      var val = config[key.trim()];
      if (val === undefined || val === null) return '';
      return String(val);
    });
  }

  /**
   * Sanitização básica: remove <script> e event handlers on*.
   * Para produção, carregar DOMPurify via CDN e usar DOMPurify.sanitize().
   */
  function sanitize(html) {
    if (global.DOMPurify && typeof DOMPurify.sanitize === 'function') {
      return DOMPurify.sanitize(html, { ADD_ATTR: ['target', 'loading', 'allow', 'allowfullscreen'] });
    }
    // Fallback manual simples
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');
  }

  /**
   * Injeta um bloco <style> no <head> para o CSS do widget.
   */
  function injectStyle(templateId, css) {
    var style = document.createElement('style');
    style.setAttribute('data-wgt-template', templateId);
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ── Public API ──────────────────────────────────────────────────── */
  global.WidgetRenderer = {
    renderWidgets: renderWidgets,
    renderOne:     renderOne,
    interpolate:   interpolate,
  };

})(window);
