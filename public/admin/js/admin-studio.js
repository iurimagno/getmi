/**
 * getmi.ai — admin-studio.js
 * Widget Studio: cria e edita widget_templates no Firestore.
 */

/* ─── STATE ──────────────────────────────────────────────────────────────── */
let editingId    = null;   // null = novo, string = editar
let schemaFields = [];     // [{key, label, type, required, default, placeholder}]

/* ─── FIREBASE ───────────────────────────────────────────────────────────── */
const auth = firebase.auth();
const db   = firebase.firestore();

/* ─── AUTH GUARD ─────────────────────────────────────────────────────────── */
auth.onAuthStateChanged(function (user) {
  if (!user) {
    window.location.replace('/login.html');
    return;
  }
  if (user.photoURL) $('#topbarAvatar').attr('src', user.photoURL);
  initSidebar();

  var params = new URLSearchParams(window.location.search);
  editingId  = params.get('id') || null;

  if (editingId) {
    $('#studioTitle').text('Editar Widget');
    loadTemplate(editingId);
  }
});

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

/* ─── LOAD EXISTING TEMPLATE ─────────────────────────────────────────────── */
function loadTemplate(id) {
  db.collection('widget_templates').doc(id).get()
    .then(function (doc) {
      if (!doc.exists) {
        alert('Widget não encontrado.');
        return;
      }
      var t = doc.data();
      $('#wgtName').val(t.name || '');
      $('#wgtCategory').val(t.category || 'essentials');
      $('#wgtTier').val(t.tier || 'free');
      $('#wgtDesc').val(t.description || '');
      $('#wgtVersion').val(t.version || '1.0.0');
      $('#wgtStatus').val(t.status || 'active');
      $('#wgtIconBg').val(t.iconBg || '#F0EDE8');
      $('#wgtIconBgHex').val(t.iconBg || '#F0EDE8');
      $('#wgtIconColor').val(t.iconColor || '#4A5068');
      $('#wgtIconColorHex').val(t.iconColor || '#4A5068');
      $('#wgtIcon').val(t.icon || '');
      $('#wgtDefaultSize').val(t.defaultSize || '2x1');
      $('#wgtRenderTemplate').val(t.renderTemplate || '');
      $('#wgtRenderCSS').val(t.renderCSS || '');
      $('#wgtApiService').val((t.apiConfig && t.apiConfig.service) || '');
      $('#wgtApiEndpoint').val((t.apiConfig && t.apiConfig.endpointPattern) || '');

      // Checkboxes de tamanho
      $('#wgtSizes input[type=checkbox]').prop('checked', false);
      (t.sizes || []).forEach(function (s) {
        $('#wgtSizes input[value="' + s + '"]').prop('checked', true);
      });

      // Schema
      schemaFields = t.configSchema || [];
      renderSchema();
      updatePreview();
    })
    .catch(function (err) {
      console.error('Erro ao carregar template:', err);
    });
}

/* ─── COLOR SYNC ─────────────────────────────────────────────────────────── */
$('#wgtIconBg').on('input', function () { $('#wgtIconBgHex').val(this.value); updatePreview(); });
$('#wgtIconBgHex').on('input', function () {
  if (/^#[0-9a-fA-F]{6}$/.test(this.value)) $('#wgtIconBg').val(this.value);
});
$('#wgtIconColor').on('input', function () { $('#wgtIconColorHex').val(this.value); updatePreview(); });
$('#wgtIconColorHex').on('input', function () {
  if (/^#[0-9a-fA-F]{6}$/.test(this.value)) $('#wgtIconColor').val(this.value);
});

/* ─── LIVE PREVIEW ───────────────────────────────────────────────────────── */
$('#wgtRenderTemplate, #wgtRenderCSS').on('input', updatePreview);

function updatePreview() {
  var html    = $('#wgtRenderTemplate').val().trim();
  var css     = $('#wgtRenderCSS').val().trim();
  var $body   = $('#studioPreviewBody');

  if (!html) {
    $body.html('<p class="studio-preview-placeholder">Preencha o template HTML ao lado para ver o preview ao vivo.</p>');
    return;
  }

  // Substituir placeholders com valores default do schema
  var rendered = html;
  schemaFields.forEach(function (f) {
    var val = f.default !== undefined ? String(f.default) : f.placeholder || f.key;
    rendered = rendered.split('{{' + f.key + '}}').join(val);
  });
  // Fallback: substituir qualquer {{xxx}} restante
  rendered = rendered.replace(/\{\{[^}]+\}\}/g, '…');

  var styleTag = css ? '<style>' + css + '</style>' : '';
  $body.html(styleTag + rendered);
}

/* ─── SCHEMA BUILDER ─────────────────────────────────────────────────────── */
$('#btnAddField').on('click', function () {
  schemaFields.push({ key: '', label: '', type: 'text', required: false, default: '', placeholder: '' });
  renderSchema();
});

function renderSchema() {
  var $list = $('#schemaBuilder');
  $list.empty();

  if (!schemaFields.length) {
    $('#schemaEmpty').show();
    return;
  }
  $('#schemaEmpty').hide();

  schemaFields.forEach(function (f, idx) {
    var row = $('<div class="studio-field-row" data-idx="' + idx + '">').html(
      '<input class="form-control-app studio-field-row__key js-field-key" ' +
             'type="text" placeholder="key" value="' + escHtml(f.key) + '">' +
      '<input class="form-control-app studio-field-row__label js-field-label" ' +
             'type="text" placeholder="Label" value="' + escHtml(f.label) + '">' +
      '<select class="form-control-app studio-field-row__type js-field-type">' +
        ['text','url','number','color','select','textarea','toggle','image'].map(function (o) {
          return '<option value="' + o + '"' + (f.type === o ? ' selected' : '') + '>' + o + '</option>';
        }).join('') +
      '</select>' +
      '<button type="button" class="studio-field-remove js-remove-field" title="Remover">×</button>'
    );
    $list.append(row);
  });
}

$(document).on('input change', '.js-field-key', function () {
  var idx = parseInt($(this).closest('.studio-field-row').data('idx'));
  schemaFields[idx].key = this.value;
  updatePreview();
});
$(document).on('input', '.js-field-label', function () {
  var idx = parseInt($(this).closest('.studio-field-row').data('idx'));
  schemaFields[idx].label = this.value;
});
$(document).on('change', '.js-field-type', function () {
  var idx = parseInt($(this).closest('.studio-field-row').data('idx'));
  schemaFields[idx].type = this.value;
});
$(document).on('click', '.js-remove-field', function () {
  var idx = parseInt($(this).closest('.studio-field-row').data('idx'));
  schemaFields.splice(idx, 1);
  renderSchema();
  updatePreview();
});

/* ─── COLLECT FORM DATA ──────────────────────────────────────────────────── */
function collectData(status) {
  var sizes = [];
  $('#wgtSizes input:checked').each(function () { sizes.push(this.value); });
  if (!sizes.length) sizes = ['2x1'];

  var apiService  = $('#wgtApiService').val().trim();
  var apiEndpoint = $('#wgtApiEndpoint').val().trim();

  var data = {
    type:        slugify($('#wgtName').val().trim()),
    name:        $('#wgtName').val().trim(),
    category:    $('#wgtCategory').val(),
    description: $('#wgtDesc').val().trim(),
    version:     $('#wgtVersion').val().trim() || '1.0.0',
    tier:        $('#wgtTier').val(),
    status:      status || $('#wgtStatus').val(),
    icon:        $('#wgtIcon').val().trim(),
    iconBg:      $('#wgtIconBg').val(),
    iconColor:   $('#wgtIconColor').val(),
    sizes:       sizes,
    defaultSize: $('#wgtDefaultSize').val(),
    configSchema: schemaFields,
    renderTemplate: $('#wgtRenderTemplate').val().trim(),
    renderCSS:      $('#wgtRenderCSS').val().trim(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
  };

  if (apiService) {
    data.apiConfig = { service: apiService, endpointPattern: apiEndpoint };
  }

  if (!editingId) {
    data.stats     = { installs: 0, clicks: 0 };
    data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    data.createdBy = auth.currentUser ? auth.currentUser.uid : '';
  }

  return data;
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/* ─── SAVE / PUBLISH ─────────────────────────────────────────────────────── */
$('#btnSaveDraft').on('click', function () {
  save('draft');
});

$('#btnPublish').on('click', function () {
  save('active');
});

function save(status) {
  if (!$('#wgtName').val().trim()) {
    alert('Preencha o nome do widget.');
    return;
  }
  if (!$('#wgtRenderTemplate').val().trim()) {
    alert('Preencha o Render Template HTML.');
    return;
  }

  var data = collectData(status);
  var promise;

  if (editingId) {
    promise = db.collection('widget_templates').doc(editingId).update(data);
  } else {
    promise = db.collection('widget_templates').add(data)
      .then(function (ref) {
        editingId = ref.id;
        history.replaceState(null, '', '/admin/widget-studio.html?id=' + editingId);
      });
  }

  promise
    .then(function () {
      var msg = status === 'active' ? 'Widget publicado!' : 'Rascunho salvo.';
      showToast(msg);
    })
    .catch(function (err) {
      console.error('Erro ao salvar:', err);
      alert('Erro ao salvar: ' + err.message);
    });
}

/* ─── IMPORT SEED ────────────────────────────────────────────────────────── */
$('#btnImportSeed').on('click', function () {
  if (!confirm('Importar os 7 widgets iniciais? Isso adicionará templates ao Firestore.')) return;

  fetch('/data/seed-widgets.json')
    .then(function (res) { return res.json(); })
    .then(function (seeds) {
      var batch = db.batch();
      seeds.forEach(function (seed) {
        var ref = db.collection('widget_templates').doc();
        var data = Object.assign({}, seed, {
          createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt:  firebase.firestore.FieldValue.serverTimestamp(),
          createdBy:  auth.currentUser ? auth.currentUser.uid : '',
        });
        batch.set(ref, data);
      });
      return batch.commit();
    })
    .then(function () {
      showToast('7 widgets importados com sucesso!');
      setTimeout(function () {
        window.location.href = '/admin/widgets.html';
      }, 1500);
    })
    .catch(function (err) {
      console.error('Erro ao importar seed:', err);
      alert('Erro ao importar: ' + err.message);
    });
});

/* ─── TOAST ──────────────────────────────────────────────────────────────── */
function showToast(msg) {
  var $t = $('<div class="gm-toast">' + msg + '</div>').appendTo('body');
  setTimeout(function () { $t.addClass('is-visible'); }, 10);
  setTimeout(function () {
    $t.removeClass('is-visible');
    setTimeout(function () { $t.remove(); }, 300);
  }, 2500);
}

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
