/**
 * getmi.ai — admin-widgets.js
 * Widget Management: lê widget_templates do Firestore, renderiza tabela.
 */

/* ─── STATE ──────────────────────────────────────────────────────────────── */
const PAGE_SIZE      = 10;
let allTemplates     = [];   // cache completo
let filteredTemplates = [];
let currentPage      = 1;
let pendingDeleteId  = null;

/* ─── FIREBASE REFS ──────────────────────────────────────────────────────── */
const auth = firebase.auth();
const db   = firebase.firestore();

/* ─── AUTH GUARD ─────────────────────────────────────────────────────────── */
auth.onAuthStateChanged(function (user) {
  if (!user) {
    window.location.replace('/login.html');
    return;
  }
  initTopbar(user);
  initSidebar();
  loadTemplates();
});

/* ─── TOPBAR ─────────────────────────────────────────────────────────────── */
function initTopbar(user) {
  $('#topbarName').text(user.displayName || user.email || '');
  if (user.photoURL) $('#topbarAvatar').attr('src', user.photoURL);
}

/* ─── SIDEBAR MOBILE ─────────────────────────────────────────────────────── */
function initSidebar() {
  $('#btnMenuToggle').on('click', function () {
    $('#adminSidebar').toggleClass('is-open');
    $('#sidebarOverlay').toggleClass('is-visible');
  });
  $('#sidebarOverlay').on('click', function () {
    $('#adminSidebar').removeClass('is-open');
    $('#sidebarOverlay').removeClass('is-visible');
  });
  $('#btnSignOut').on('click', function (e) {
    e.preventDefault();
    auth.signOut().then(function () {
      window.location.replace('/login.html');
    });
  });
}

/* ─── LOAD TEMPLATES ─────────────────────────────────────────────────────── */
function loadTemplates() {
  db.collection('widget_templates').orderBy('name').get()
    .then(function (snap) {
      allTemplates = [];
      snap.forEach(function (doc) {
        allTemplates.push(Object.assign({ id: doc.id }, doc.data()));
      });
      updateStats();
      applyFilters();
    })
    .catch(function (err) {
      console.error('Erro ao carregar templates:', err);
      showEmpty();
    });
}

/* ─── STATS ──────────────────────────────────────────────────────────────── */
function updateStats() {
  var total  = allTemplates.length;
  var pro    = allTemplates.filter(function (t) { return t.tier !== 'free'; }).length;
  var apis   = allTemplates.filter(function (t) { return t.apiConfig && t.apiConfig.service; }).length;
  var clicks = allTemplates.reduce(function (acc, t) {
    return acc + ((t.stats && t.stats.clicks) || 0);
  }, 0);

  $('#statTotal').text(total);
  $('#statPro').text(pro);
  $('#statApis').text(apis);
  $('#statClicks').text(clicks.toLocaleString('pt-BR'));
}

/* ─── FILTERS ────────────────────────────────────────────────────────────── */
function applyFilters() {
  var search = $('#wgtSearch').val().toLowerCase().trim();
  var cat    = $('#wgtCatFilter').val();
  var status = $('#wgtStatusFilter').val();

  filteredTemplates = allTemplates.filter(function (t) {
    var matchSearch = !search ||
      (t.name || '').toLowerCase().includes(search) ||
      (t.description || '').toLowerCase().includes(search) ||
      (t.type || '').toLowerCase().includes(search);
    var matchCat    = !cat    || t.category === cat;
    var matchStatus = !status || t.status   === status;
    return matchSearch && matchCat && matchStatus;
  });

  currentPage = 1;
  renderTable();
}

$('#wgtSearch, #wgtCatFilter, #wgtStatusFilter').on('input change', applyFilters);

/* ─── RENDER TABLE ───────────────────────────────────────────────────────── */
function renderTable() {
  var $body = $('#wgtTableBody');
  $body.empty();

  if (!filteredTemplates.length) {
    showEmpty();
    return;
  }

  $('#stateLoading').addClass('d-none');
  $('#stateEmpty').addClass('d-none');
  $('#wgtTableWrap').removeClass('d-none');

  var start = (currentPage - 1) * PAGE_SIZE;
  var page  = filteredTemplates.slice(start, start + PAGE_SIZE);

  page.forEach(function (t) {
    $body.append(buildRow(t));
  });

  renderPagination();
}

function buildRow(t) {
  var iconBg    = t.iconBg    || '#F0EDE8';
  var iconColor = t.iconColor || '#4A5068';
  var sizes     = (t.sizes || []).map(function (s) {
    return '<span class="wgt-pill-size">' + s + '</span>';
  }).join('');
  var catClass  = 'wgt-badge-cat--' + (t.category || 'essentials');
  var tierClass = 'wgt-badge-tier--' + (t.tier || 'free');
  var hasApi    = t.apiConfig && t.apiConfig.service;
  var isActive  = t.status === 'active';
  var checked   = isActive ? 'checked' : '';

  return $('<tr data-id="' + t.id + '">').html(
    '<td>' +
      '<div class="wgt-cell-widget">' +
        '<div class="wgt-icon-wrap" style="background:' + iconBg + ';color:' + iconColor + '">' +
          (t.icon && t.icon.length <= 4 ? t.icon : '🧩') +
        '</div>' +
        '<div>' +
          '<span class="wgt-cell-widget__name">' + escHtml(t.name || '') + '</span>' +
          '<span class="wgt-cell-widget__version">v' + escHtml(t.version || '1.0.0') + '</span>' +
        '</div>' +
      '</div>' +
    '</td>' +
    '<td><span class="wgt-badge-cat ' + catClass + '">' + escHtml(t.category || '') + '</span></td>' +
    '<td><div class="wgt-sizes">' + sizes + '</div></td>' +
    '<td>' +
      (hasApi
        ? '<span class="wgt-badge-api wgt-badge-api--ok">● ' + escHtml(t.apiConfig.service) + '</span>'
        : '<span class="wgt-badge-api wgt-badge-api--none">— sem API</span>') +
    '</td>' +
    '<td><span class="wgt-badge-tier ' + tierClass + '">' + escHtml(t.tier || 'free') + '</span></td>' +
    '<td>' +
      '<div class="wgt-toggle-wrap">' +
        '<label class="wgt-toggle">' +
          '<input type="checkbox" class="js-toggle-status" data-id="' + t.id + '" ' + checked + '>' +
          '<span class="wgt-toggle__slider"></span>' +
        '</label>' +
        '<span>' + (isActive ? 'Ativo' : 'Inativo') + '</span>' +
      '</div>' +
    '</td>' +
    '<td>' +
      '<div class="wgt-actions">' +
        '<button class="wgt-btn-action js-edit-widget" data-id="' + t.id + '" title="Editar">✏️</button>' +
        '<button class="wgt-btn-action wgt-btn-action--danger js-delete-widget" data-id="' + t.id + '" data-name="' + escHtml(t.name || '') + '" title="Excluir">🗑️</button>' +
      '</div>' +
    '</td>'
  );
}

/* ─── TABLE EVENTS ───────────────────────────────────────────────────────── */
$(document).on('change', '.js-toggle-status', function () {
  var id       = $(this).data('id');
  var newStatus = this.checked ? 'active' : 'archived';
  var $label    = $(this).closest('.wgt-toggle-wrap').find('span');
  $label.text(this.checked ? 'Ativo' : 'Inativo');
  db.collection('widget_templates').doc(id)
    .update({ status: newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp() })
    .catch(function (err) { console.error('Erro ao atualizar status:', err); });
});

$(document).on('click', '.js-edit-widget', function () {
  var id = $(this).data('id');
  window.location.href = '/admin/widget-studio.html?id=' + id;
});

$(document).on('click', '.js-delete-widget', function () {
  pendingDeleteId = $(this).data('id');
  $('#deleteWidgetName').text('"' + $(this).data('name') + '"');
  $('#modalDeleteWidget').modal('show');
});

$('#btnConfirmDeleteWidget').on('click', function () {
  if (!pendingDeleteId) return;
  db.collection('widget_templates').doc(pendingDeleteId).delete()
    .then(function () {
      allTemplates = allTemplates.filter(function (t) { return t.id !== pendingDeleteId; });
      pendingDeleteId = null;
      $('#modalDeleteWidget').modal('hide');
      updateStats();
      applyFilters();
    })
    .catch(function (err) { console.error('Erro ao excluir:', err); });
});

/* ─── PAGINATION ─────────────────────────────────────────────────────────── */
function renderPagination() {
  var $pag   = $('#wgtPagination');
  var total  = Math.ceil(filteredTemplates.length / PAGE_SIZE);
  $pag.empty();
  if (total <= 1) return;

  for (var i = 1; i <= total; i++) {
    var $btn = $('<button class="wgt-page-btn">' + i + '</button>');
    if (i === currentPage) $btn.addClass('is-active');
    $btn.on('click', (function (p) {
      return function () {
        currentPage = p;
        renderTable();
      };
    })(i));
    $pag.append($btn);
  }
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function showEmpty() {
  $('#stateLoading').addClass('d-none');
  $('#wgtTableWrap').addClass('d-none');
  $('#stateEmpty').removeClass('d-none');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
