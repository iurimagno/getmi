/**
 * getmi.ai — widget-library.js
 * Drawer lateral de widgets para o usuário.
 * Também gerencia a seção inline "Widgets do Perfil" em admin/links.html.
 *
 * Dependências: jQuery, Bootstrap 4, firebase.auth/firestore,
 *               widget-config-modal.js, widget-renderer.js
 */

(function (global) {
  'use strict';

  var CATS = ['essentials', 'whatsapp', 'media', 'social', 'utilities', 'monetization'];

  var state = {
    templates:  [],
    instances:  [],
    activeCat:  '',
    search:     '',
  };

  var currentUser = null;

  /* ─── INIT ───────────────────────────────────────────────────────────── */
  function init() {
    buildDrawer();
    buildInlineSection();

    firebase.auth().onAuthStateChanged(function (user) {
      if (!user) return;
      currentUser = user;
      loadTemplates();
      loadInstances(user.uid);
    });
  }

  /* ─── DRAWER DOM ─────────────────────────────────────────────────────── */
  function buildDrawer() {
    if ($('#wgtlibDrawer').length) return;

    var catPills = '<button class="wgtlib-cat-pill is-active" data-cat="">Todos</button>' +
      CATS.map(function (c) {
        return '<button class="wgtlib-cat-pill" data-cat="' + c + '">' + capFirst(c) + '</button>';
      }).join('');

    var $drawer = $([
      '<div class="wgtlib-overlay" id="wgtlibOverlay"></div>',
      '<aside class="wgtlib-drawer" id="wgtlibDrawer" aria-label="Widget Library">',
      '  <div class="wgtlib-header">',
      '    <h2 class="wgtlib-header__title">🧩 Widgets</h2>',
      '    <button class="wgtlib-header__close" id="wgtlibClose" aria-label="Fechar">×</button>',
      '  </div>',
      '  <div class="wgtlib-search-wrap">',
      '    <input class="wgtlib-search" type="search" id="wgtlibSearch" placeholder="Buscar widgets…">',
      '  </div>',
      '  <div class="wgtlib-cats" id="wgtlibCats">' + catPills + '</div>',
      '  <div class="wgtlib-body">',
      '    <div class="wgtlib-state" id="wgtlibLoading"><div class="wgtlib-state__icon">⏳</div>Carregando…</div>',
      '    <div class="wgtlib-grid" id="wgtlibGrid" style="display:none"></div>',
      '    <div class="wgtlib-state" id="wgtlibEmpty" style="display:none">',
      '      <div class="wgtlib-state__icon">🔍</div>Nenhum widget encontrado.',
      '    </div>',
      '  </div>',
      '</aside>',
    ].join('\n'));

    $('body').append($drawer);

    // Events
    $('#wgtlibOverlay, #wgtlibClose').on('click', close);
    $('#wgtlibSearch').on('input', function () {
      state.search = this.value.toLowerCase().trim();
      renderGrid();
    });
    $(document).on('click', '.wgtlib-cat-pill', function () {
      state.activeCat = $(this).data('cat');
      $('.wgtlib-cat-pill').removeClass('is-active');
      $(this).addClass('is-active');
      renderGrid();
    });
    $(document).on('click', '.wgtlib-card', function () {
      var id = $(this).data('id');
      var tpl = state.templates.find(function (t) { return t.id === id; });
      if (tpl && global.WidgetConfigModal) {
        WidgetConfigModal.open(tpl, null, function () {
          loadInstances(currentUser.uid);
          close();
          showToast('Widget adicionado!');
        });
      }
    });
  }

  /* ─── OPEN / CLOSE ───────────────────────────────────────────────────── */
  function open() {
    $('#wgtlibDrawer').addClass('is-open');
    $('#wgtlibOverlay').addClass('is-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    $('#wgtlibDrawer').removeClass('is-open');
    $('#wgtlibOverlay').removeClass('is-open');
    document.body.style.overflow = '';
  }

  /* ─── LOAD TEMPLATES ─────────────────────────────────────────────────── */
  function loadTemplates() {
    firebase.firestore()
      .collection('widget_templates')
      .where('status', '==', 'active')
      .orderBy('name')
      .get()
      .then(function (snap) {
        state.templates = [];
        snap.forEach(function (doc) {
          state.templates.push(Object.assign({ id: doc.id }, doc.data()));
        });
        renderGrid();
      })
      .catch(function (err) {
        console.error('Erro ao carregar templates:', err);
        $('#wgtlibLoading').html('<div class="wgtlib-state__icon">⚠️</div>Erro ao carregar widgets.');
      });
  }

  /* ─── RENDER GRID ────────────────────────────────────────────────────── */
  function renderGrid() {
    var filtered = state.templates.filter(function (t) {
      var matchCat  = !state.activeCat || t.category === state.activeCat;
      var matchSrch = !state.search   ||
        (t.name || '').toLowerCase().includes(state.search) ||
        (t.description || '').toLowerCase().includes(state.search);
      return matchCat && matchSrch;
    });

    $('#wgtlibLoading').hide();
    var $grid = $('#wgtlibGrid');
    $grid.empty();

    if (!filtered.length) {
      $grid.hide();
      $('#wgtlibEmpty').show();
      return;
    }

    $('#wgtlibEmpty').hide();
    $grid.show();

    filtered.forEach(function (t) {
      $grid.append(buildCard(t));
    });
  }

  function buildCard(t) {
    var iconBg    = t.iconBg    || '#F0EDE8';
    var iconColor = t.iconColor || '#4A5068';
    var iconEl    = t.icon && t.icon.length <= 4 ? t.icon : '🧩';
    var tierClass = 'wgtlib-card__tier--' + (t.tier || 'free');

    return $('<div class="wgtlib-card" data-id="' + t.id + '">').html(
      '<div class="wgtlib-card__icon" style="background:' + iconBg + ';color:' + iconColor + '">' + iconEl + '</div>' +
      '<span class="wgtlib-card__name">' + escHtml(t.name || '') + '</span>' +
      '<p class="wgtlib-card__desc">' + escHtml(t.description || '') + '</p>' +
      '<div class="wgtlib-card__meta">' +
        '<span class="wgtlib-card__size">' + (t.defaultSize || '2x1') + '</span>' +
        '<span class="wgtlib-card__tier ' + tierClass + '">' + (t.tier || 'free') + '</span>' +
      '</div>'
    );
  }

  /* ─── LOAD INSTANCES (inline section) ───────────────────────────────── */
  function loadInstances(uid) {
    firebase.firestore()
      .collection('widget_instances')
      .where('userId', '==', uid)
      .where('active', '==', true)
      .orderBy('order')
      .get()
      .then(function (snap) {
        state.instances = [];
        snap.forEach(function (doc) {
          state.instances.push(Object.assign({ id: doc.id }, doc.data()));
        });
        renderInstancesList();
      })
      .catch(function (err) {
        console.error('Erro ao carregar instâncias:', err);
      });
  }

  /* ─── INLINE SECTION ─────────────────────────────────────────────────── */
  function buildInlineSection() {
    if (!$('#wgtPanelSection').length) return; // só injeta se houver o anchor

    var $section = $([
      '<div class="admin-card wgt-panel-section">',
      '  <div class="wgt-panel-header">',
      '    <h2 class="wgt-panel-title">Widgets do Perfil</h2>',
      '    <button class="btn-primary-app" id="btnOpenWgtLib" type="button">+ Widget</button>',
      '  </div>',
      '  <div class="wgt-instances-list" id="wgtInstancesList">',
      '    <div class="wgtlib-state" id="wgtInstancesLoading"><div class="wgtlib-state__icon">⏳</div>Carregando…</div>',
      '  </div>',
      '</div>',
    ].join('\n'));

    $('#wgtPanelSection').replaceWith($section);

    $('#btnOpenWgtLib').on('click', open);
  }

  function renderInstancesList() {
    var $list = $('#wgtInstancesList');
    if (!$list.length) return;

    $list.empty();

    if (!state.instances.length) {
      $list.html(
        '<div class="wgtlib-state">' +
        '<div class="wgtlib-state__icon">🧩</div>' +
        'Nenhum widget adicionado ainda. Clique em "+ Widget".' +
        '</div>'
      );
      return;
    }

    state.instances.forEach(function (inst) {
      var tpl   = state.templates.find(function (t) { return t.id === inst.templateId; }) || {};
      var iconBg    = tpl.iconBg    || '#F0EDE8';
      var iconColor = tpl.iconColor || '#4A5068';
      var iconEl    = tpl.icon && tpl.icon.length <= 4 ? tpl.icon : '🧩';

      var $item = $([
        '<div class="wgt-instance-item" data-inst-id="' + inst.id + '">',
        '  <div class="wgt-instance-item__icon" style="background:' + iconBg + ';color:' + iconColor + '">' + iconEl + '</div>',
        '  <div class="wgt-instance-item__info">',
        '    <span class="wgt-instance-item__name">' + escHtml(tpl.name || 'Widget') + '</span>',
        '    <span class="wgt-instance-item__size">' + (inst.size || '2x1') + '</span>',
        '  </div>',
        '  <div class="wgt-instance-item__actions">',
        '    <button class="wgt-instance-btn js-edit-inst" data-id="' + inst.id + '" title="Editar">✏️</button>',
        '    <button class="wgt-instance-btn wgt-instance-btn--danger js-delete-inst" data-id="' + inst.id + '" title="Remover">🗑️</button>',
        '  </div>',
        '</div>',
      ].join('\n'));

      $list.append($item);
    });
  }

  /* ─── INSTANCE EVENTS ────────────────────────────────────────────────── */
  $(document).on('click', '.js-edit-inst', function () {
    var id   = $(this).data('id');
    var inst = state.instances.find(function (i) { return i.id === id; });
    if (!inst) return;
    var tpl = state.templates.find(function (t) { return t.id === inst.templateId; });
    if (!tpl || !global.WidgetConfigModal) return;

    WidgetConfigModal.open(tpl, inst, function () {
      loadInstances(currentUser.uid);
      showToast('Widget atualizado!');
    });
  });

  $(document).on('click', '.js-delete-inst', function () {
    if (!confirm('Remover este widget do seu perfil?')) return;
    var id = $(this).data('id');
    firebase.firestore().collection('widget_instances').doc(id).delete()
      .then(function () {
        state.instances = state.instances.filter(function (i) { return i.id !== id; });
        renderInstancesList();
        showToast('Widget removido.');
      })
      .catch(function (err) { console.error('Erro ao remover:', err); });
  });

  /* ─── HELPERS ────────────────────────────────────────────────────────── */
  function showToast(msg) {
    var $t = $('<div class="gm-toast">' + msg + '</div>').appendTo('body');
    setTimeout(function () { $t.addClass('is-visible'); }, 10);
    setTimeout(function () {
      $t.removeClass('is-visible');
      setTimeout(function () { $t.remove(); }, 300);
    }, 2500);
  }

  function capFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Public API ──────────────────────────────────────────────────── */
  global.WidgetLibrary = { init: init, open: open, close: close };

})(window);
