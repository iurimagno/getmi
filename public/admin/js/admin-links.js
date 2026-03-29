/**
 * getmi.ai — admin-links.js
 * Gerencia a coleção users/{uid}/links no Firestore.
 */

/* ─── CONSTANTS ──────────────────────────────────────────────────────────── */
const FREE_LIMIT = 5;

const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/;

const EMOJIS = [
  '✨','🔥','⚡','🎯','💡','🎉','🌟','💎',
  '🛒','💰','💳','🏷️','🎁','📦','🔑','🏆',
  '📱','💻','🎮','🎵','🎨','📸','🎬','📚',
  '💬','📲','🟢','📞','✉️','📣','📢','🔔',
  '🌍','🚀','🌈','🦋','🌸','🍀','⭐','🎪',
  '👋','🙌','💪','🤝','❤️','🧡','💛','💚',
  '🔗','🖇️','📌','📍','🏠','🏢','🎓','🔬',
  '📊','📈','💹','🧮','⚙️','🛠️','🔧','🎯',
];

/* ─── STATE ──────────────────────────────────────────────────────────────── */
let currentUser   = null;
let userPlan      = 'free';
let linksCache    = [];   // [{id, ...data}]
let editingLinkId = null; // null = new, string = edit
let pendingDelete = null; // link id pending deletion

/* ─── FIREBASE REFS ──────────────────────────────────────────────────────── */
const auth = firebase.auth();
const db   = firebase.firestore();

function linksRef(uid) {
  return db.collection('users').doc(uid).collection('links');
}

/* ─── AUTH GUARD ─────────────────────────────────────────────────────────── */
auth.onAuthStateChanged(function (user) {
  if (!user) {
    window.location.replace('/login.html');
    return;
  }
  currentUser = user;
  $('#topbarName').text(user.displayName || user.email);
  if (user.photoURL) {
    $('#topbarAvatar').attr('src', user.photoURL);
  }
  loadUserPlanThenLinks();
});

/* ─── LOAD USER PLAN ─────────────────────────────────────────────────────── */
function loadUserPlanThenLinks() {
  db.collection('users').doc(currentUser.uid).get()
    .then(function (doc) {
      if (doc.exists) {
        var data = doc.data();
        userPlan = data.plan || 'free';
        if (data.username) {
          window.gmProfileUrl = 'https://getmi.ai/@' + data.username;
        }
      }
      loadLinks();
    })
    .catch(function () {
      loadLinks();
    });
}

/* ─── LOAD LINKS ─────────────────────────────────────────────────────────── */
function loadLinks() {
  $('#stateLoading').show();
  $('#stateEmpty').addClass('d-none');
  $('#linkList').empty();

  linksRef(currentUser.uid)
    .orderBy('order')
    .get()
    .then(function (snapshot) {
      linksCache = [];
      snapshot.forEach(function (doc) {
        linksCache.push(Object.assign({ id: doc.id }, doc.data()));
      });
      renderLinks();
    })
    .catch(function (err) {
      console.error('Erro ao carregar links:', err);
      $('#stateLoading').hide();
    });
}

/* ─── RENDER LIST ────────────────────────────────────────────────────────── */
function renderLinks() {
  $('#stateLoading').hide();
  var $list = $('#linkList').empty();

  if (linksCache.length === 0) {
    $('#stateEmpty').removeClass('d-none');
    updateLimitBanner();
    return;
  }

  $('#stateEmpty').addClass('d-none');

  linksCache.forEach(function (link) {
    $list.append(buildLinkItem(link));
  });

  updateLimitBanner();
  initDragAndDrop();
}

function buildLinkItem(link) {
  var checked  = link.active !== false ? 'checked' : '';
  var typeClass = 'link-type-dot--' + (link.type || 'secondary');
  var clicks    = link.clicks || 0;
  var icon      = link.icon || '';

  var $item = $('<li>', {
    class: 'link-item',
    'data-id': link.id,
    draggable: true,
  });

  $item.html(
    '<span class="link-drag-handle" title="Arrastar para reordenar" aria-hidden="true">⠿</span>' +
    '<span class="link-type-dot ' + typeClass + '" aria-hidden="true"></span>' +
    '<span class="link-icon">' + escapeHtml(icon) + '</span>' +
    '<div class="link-info">' +
      '<div class="link-title">' + escapeHtml(link.title || '') + '</div>' +
      '<div class="link-url">' + escapeHtml(link.url || '') + '</div>' +
    '</div>' +
    '<span class="link-clicks" title="Cliques totais">👆 ' + clicks + '</span>' +
    '<label class="toggle-switch link-toggle" title="' + (link.active !== false ? 'Ativo' : 'Inativo') + '">' +
      '<input type="checkbox" class="js-toggle" data-id="' + link.id + '" ' + checked + ' aria-label="Ativar/desativar ' + escapeHtml(link.title || '') + '">' +
      '<span class="toggle-track"></span>' +
    '</label>' +
    '<div class="link-actions">' +
      '<button class="btn-icon js-edit" data-id="' + link.id + '" title="Editar" aria-label="Editar ' + escapeHtml(link.title || '') + '">✏️</button>' +
      '<button class="btn-icon btn-icon--delete js-delete" data-id="' + link.id + '" title="Excluir" aria-label="Excluir ' + escapeHtml(link.title || '') + '">🗑️</button>' +
    '</div>'
  );

  return $item;
}

/* ─── LIMIT BANNER ───────────────────────────────────────────────────────── */
function updateLimitBanner() {
  var atLimit = (userPlan === 'free' && linksCache.length >= FREE_LIMIT);
  $('#limitBanner').toggleClass('is-visible', atLimit);
  $('#btnAddLink').prop('disabled', atLimit);
}

/* ─── ADD LINK ───────────────────────────────────────────────────────────── */
$('#btnAddLink').on('click', function () {
  if (userPlan === 'free' && linksCache.length >= FREE_LIMIT) return;
  openModal(null);
});

/* ─── EDIT LINK ──────────────────────────────────────────────────────────── */
$(document).on('click', '.js-edit', function () {
  var id = $(this).data('id');
  openModal(id);
});

/* ─── DELETE LINK ────────────────────────────────────────────────────────── */
$(document).on('click', '.js-delete', function () {
  var id   = $(this).data('id');
  var link = linksCache.find(function (l) { return l.id === id; });
  if (!link) return;

  pendingDelete = id;
  $('#deleteLinkName').text('"' + (link.title || 'este link') + '"');
  $('#modalDelete').modal('show');
});

$('#btnConfirmDelete').on('click', function () {
  if (!pendingDelete || !currentUser) return;

  var $btn = $(this);
  $btn.prop('disabled', true).text('Excluindo...');

  linksRef(currentUser.uid).doc(pendingDelete).delete()
    .then(function () {
      linksCache = linksCache.filter(function (l) { return l.id !== pendingDelete; });
      pendingDelete = null;
      $('#modalDelete').modal('hide');
      renderLinks();
    })
    .catch(function (err) {
      console.error('Erro ao excluir:', err);
      $btn.prop('disabled', false).text('Excluir');
    });
});

$('#modalDelete').on('hidden.bs.modal', function () {
  pendingDelete = null;
  $('#btnConfirmDelete').prop('disabled', false).text('Excluir');
});

/* ─── TOGGLE ACTIVE ──────────────────────────────────────────────────────── */
$(document).on('change', '.js-toggle', function () {
  if (!currentUser) return;
  var id     = $(this).data('id');
  var active = $(this).is(':checked');

  linksRef(currentUser.uid).doc(id)
    .update({ active: active })
    .then(function () {
      var link = linksCache.find(function (l) { return l.id === id; });
      if (link) link.active = active;
    })
    .catch(function (err) {
      console.error('Erro ao atualizar toggle:', err);
      /* Reverte UI */
      $(this).prop('checked', !active);
    }.bind(this));
});

/* ─── MODAL OPEN ─────────────────────────────────────────────────────────── */
function openModal(linkId) {
  editingLinkId = linkId;
  clearModalErrors();

  if (linkId) {
    var link = linksCache.find(function (l) { return l.id === linkId; });
    if (!link) return;
    $('#modalLinkTitle').text('Editar link');
    $('#linkId').val(link.id);
    $('#linkTitle').val(link.title || '');
    $('#linkUrl').val(link.url || '');
    $('#linkType').val(link.type || 'secondary');
    setEmoji(link.icon || '✨');
  } else {
    $('#modalLinkTitle').text('Adicionar link');
    $('#linkId').val('');
    $('#linkTitle').val('');
    $('#linkUrl').val('');
    $('#linkType').val('secondary');
    setEmoji('✨');
  }

  updatePreview();
  $('#modalLink').modal('show');
}

$('#modalLink').on('hidden.bs.modal', function () {
  editingLinkId = null;
  clearModalErrors();
});

/* ─── SAVE LINK (submit) ─────────────────────────────────────────────────── */
$('#formLink').on('submit', function (e) {
  e.preventDefault();
  if (!currentUser) return;

  var title = $('#linkTitle').val().trim();
  var url   = $('#linkUrl').val().trim();
  var type  = $('#linkType').val();
  var icon  = $('#linkIcon').val() || '✨';
  var valid = true;

  clearModalErrors();

  if (!title) {
    $('#errTitle').addClass('is-visible');
    $('#linkTitle').addClass('is-invalid');
    valid = false;
  }

  if (!url || !URL_REGEX.test(url)) {
    $('#errUrl').addClass('is-visible');
    $('#linkUrl').addClass('is-invalid');
    valid = false;
  }

  if (!valid) return;

  var $btn = $('#btnSaveLink').prop('disabled', true).text('Salvando...');

  if (editingLinkId) {
    /* UPDATE */
    linksRef(currentUser.uid).doc(editingLinkId)
      .update({ title: title, url: url, type: type, icon: icon })
      .then(function () {
        var link = linksCache.find(function (l) { return l.id === editingLinkId; });
        if (link) {
          link.title = title;
          link.url   = url;
          link.type  = type;
          link.icon  = icon;
        }
        $('#modalLink').modal('hide');
        renderLinks();
      })
      .catch(handleSaveError)
      .finally(function () { $btn.prop('disabled', false).text('Salvar'); });
  } else {
    /* ADD */
    var order = linksCache.length > 0
      ? Math.max.apply(null, linksCache.map(function (l) { return l.order || 0; })) + 1
      : 0;

    linksRef(currentUser.uid)
      .add({
        title:     title,
        url:       url,
        type:      type,
        icon:      icon,
        active:    true,
        order:     order,
        clicks:    0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      })
      .then(function (docRef) {
        linksCache.push({
          id: docRef.id, title: title, url: url,
          type: type, icon: icon, active: true,
          order: order, clicks: 0,
        });
        if (typeof window.gmTrackLinkAdded === 'function') {
          window.gmTrackLinkAdded(type);
        }
        $('#modalLink').modal('hide');
        renderLinks();
      })
      .catch(handleSaveError)
      .finally(function () { $btn.prop('disabled', false).text('Salvar'); });
  }
});

function handleSaveError(err) {
  console.error('Erro ao salvar link:', err);
}

/* ─── LIVE PREVIEW ───────────────────────────────────────────────────────── */
$('#linkTitle, #linkType').on('input change', updatePreview);

function updatePreview() {
  var title = $('#linkTitle').val().trim() || 'Meu link';
  var type  = $('#linkType').val() || 'secondary';
  var icon  = $('#linkIcon').val() || '✨';

  var typeMap = {
    monetization: 'g-link-btn--monetization',
    secondary:    'g-link-btn--secondary',
    social:       'g-link-btn--social',
    whatsapp:     'g-link-btn--whatsapp',
  };

  $('#previewBtn')
    .removeClass('g-link-btn--monetization g-link-btn--secondary g-link-btn--social g-link-btn--whatsapp')
    .addClass(typeMap[type] || 'g-link-btn--secondary');
  $('#previewTitle').text(title);
  $('#previewIcon').text(icon);
}

/* ─── EMOJI PICKER ───────────────────────────────────────────────────────── */
(function buildEmojiGrid() {
  var $grid = $('#emojiGrid');
  EMOJIS.forEach(function (emoji) {
    $('<button>', {
      type: 'button',
      text: emoji,
      'aria-label': emoji,
      role: 'option',
    }).on('click', function () {
      setEmoji(emoji);
      $grid.attr('hidden', true);
      $('#emojiPickerBtn').attr('aria-expanded', 'false');
    }).appendTo($grid);
  });
})();

$('#emojiPickerBtn').on('click', function (e) {
  e.stopPropagation();
  var $grid    = $('#emojiGrid');
  var isHidden = $grid.attr('hidden') !== undefined;
  $grid.attr('hidden', isHidden ? null : true);
  $(this).attr('aria-expanded', isHidden ? 'true' : 'false');
});

$(document).on('click', function (e) {
  if (!$(e.target).closest('.emoji-picker-wrap').length) {
    $('#emojiGrid').attr('hidden', true);
    $('#emojiPickerBtn').attr('aria-expanded', 'false');
  }
});

function setEmoji(emoji) {
  $('#emojiDisplay').text(emoji);
  $('#linkIcon').val(emoji);
  updatePreview();
}

/* ─── DRAG AND DROP (HTML5 native) ──────────────────────────────────────── */
var dragSrcId = null;

function initDragAndDrop() {
  var $items = $('#linkList .link-item');

  $items.each(function () {
    var el = this;

    el.addEventListener('dragstart', function (e) {
      dragSrcId = $(el).data('id');
      $(el).addClass('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', dragSrcId);
    });

    el.addEventListener('dragend', function () {
      $(el).removeClass('dragging');
      $('#linkList .link-item').removeClass('drag-over');
    });

    el.addEventListener('dragover', function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      $('#linkList .link-item').removeClass('drag-over');
      $(el).addClass('drag-over');
    });

    el.addEventListener('dragleave', function () {
      $(el).removeClass('drag-over');
    });

    el.addEventListener('drop', function (e) {
      e.preventDefault();
      $(el).removeClass('drag-over');

      var dropId = $(el).data('id');
      if (!dragSrcId || dragSrcId === dropId) return;

      reorder(dragSrcId, dropId);
    });
  });
}

function reorder(srcId, dstId) {
  var srcIdx = linksCache.findIndex(function (l) { return l.id === srcId; });
  var dstIdx = linksCache.findIndex(function (l) { return l.id === dstId; });
  if (srcIdx === -1 || dstIdx === -1) return;

  /* Reorder array */
  var moved = linksCache.splice(srcIdx, 1)[0];
  linksCache.splice(dstIdx, 0, moved);

  /* Assign new sequential order values */
  linksCache.forEach(function (link, i) { link.order = i; });

  /* Optimistic UI update */
  renderLinks();

  /* Persist in batch */
  if (!currentUser) return;

  var batch = db.batch();
  linksCache.forEach(function (link) {
    batch.update(linksRef(currentUser.uid).doc(link.id), { order: link.order });
  });

  batch.commit().catch(function (err) {
    console.error('Erro ao reordenar:', err);
    loadLinks(); /* Rollback: reload from Firestore */
  });
}

/* ─── SIDEBAR MOBILE ─────────────────────────────────────────────────────── */
$('#btnMenuToggle').on('click', function () {
  var open = $('#adminSidebar').hasClass('is-open');
  $('#adminSidebar').toggleClass('is-open', !open);
  $('#sidebarOverlay').toggleClass('is-visible', !open);
  $(this).attr('aria-expanded', !open);
});

$('#sidebarOverlay').on('click', function () {
  $('#adminSidebar').removeClass('is-open');
  $('#sidebarOverlay').removeClass('is-visible');
  $('#btnMenuToggle').attr('aria-expanded', 'false');
});

/* ─── SIGN OUT ───────────────────────────────────────────────────────────── */
$('#btnSignOut').on('click', function (e) {
  e.preventDefault();
  auth.signOut().then(function () {
    window.location.replace('/login.html');
  });
});

/* ─── HELPERS ────────────────────────────────────────────────────────────── */
function clearModalErrors() {
  $('.field-error-app').removeClass('is-visible');
  $('.form-control-app').removeClass('is-invalid');
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
