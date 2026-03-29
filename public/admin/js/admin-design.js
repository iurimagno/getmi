/**
 * getmi.ai — admin-design.js
 * Gerencia tema e perfil do usuário. Salva em users/{uid} via updateDoc.
 */

/* ─── PRESETS ────────────────────────────────────────────────────────────── */
var PRESETS = {
  default: {
    label: 'Default',
    bg:     '#FAFAF8',
    text:   '#1A1F36',
    btn:    '#1A1F36',
    style:  'rounded',
  },
  sunset: {
    label: 'Sunset',
    bg:     '#FFF5F2',
    text:   '#3D1A0E',
    btn:    '#FF6B4A',
    style:  'pill',
  },
  digital: {
    label: 'Digital',
    bg:     '#0D0D1A',
    text:   '#E8E8FF',
    btn:    '#7C6FFF',
    style:  'square',
  },
  nature: {
    label: 'Nature',
    bg:     '#F0F7EE',
    text:   '#1B3A28',
    btn:    '#2D7A4F',
    style:  'rounded',
  },
  executive: {
    label: 'Executive',
    bg:     '#F5F3EF',
    text:   '#1A1F36',
    btn:    '#1A1F36',
    style:  'square',
  },
  blush: {
    label: 'Blush',
    bg:     '#FFF0F3',
    text:   '#3D0A1B',
    btn:    '#E8476A',
    style:  'pill',
  },
  energy: {
    label: 'Energy',
    bg:     '#FFFBEB',
    text:   '#1C1200',
    btn:    '#F59E0B',
    style:  'rounded',
  },
};

/* ─── STATE ──────────────────────────────────────────────────────────────── */
var currentUser = null;
var userData    = {};
var isDirty     = false;

/* ─── FIREBASE ───────────────────────────────────────────────────────────── */
var auth = firebase.auth();
var db   = firebase.firestore();

/* ─── AUTH GUARD ─────────────────────────────────────────────────────────── */
auth.onAuthStateChanged(function (user) {
  if (!user) {
    window.location.replace('/login.html');
    return;
  }
  currentUser = user;
  $('#topbarName').text(user.displayName || user.email);
  if (user.photoURL) $('#topbarAvatar').attr('src', user.photoURL);
  loadUserData();
});

/* ─── LOAD ───────────────────────────────────────────────────────────────── */
function loadUserData() {
  db.collection('users').doc(currentUser.uid).get()
    .then(function (doc) {
      if (doc.exists) {
        userData = doc.data();
      }
      populateForm();
      buildPresets();
      updatePreview();
      $('#stateLoading').hide();
      $('#designBody').removeClass('d-none');
    })
    .catch(function (err) {
      console.error('Erro ao carregar perfil:', err);
    });
}

/* ─── POPULATE FORM ──────────────────────────────────────────────────────── */
function populateForm() {
  var t = userData.theme || {};

  $('#inputBio').val(userData.bio || '');
  updateCharCount(userData.bio || '');

  $('#inputAvatarUrl').val(userData.photoURL || '');
  $('#inputBgColor').val(t.bg   || PRESETS.default.bg);
  $('#inputTextColor').val(t.text || PRESETS.default.text);
  $('#inputBtnColor').val(t.btn  || PRESETS.default.btn);
  $('#selectBtnStyle').val(t.style || 'rounded');

  syncColorPreviews();
}

/* ─── BUILD PRESET BUTTONS ───────────────────────────────────────────────── */
function buildPresets() {
  var $container = $('#presetList').empty();

  Object.keys(PRESETS).forEach(function (key) {
    var p = PRESETS[key];
    var $btn = $('<button>', {
      type: 'button',
      class: 'preset-btn',
      'data-preset': key,
      'aria-label': 'Tema ' + p.label,
    }).css({
      background: p.bg,
      borderColor: p.btn,
    });

    $btn.html(
      '<span class="preset-dot" style="background:' + p.btn + '"></span>' +
      '<span class="preset-label">' + p.label + '</span>'
    );

    $btn.on('click', function () {
      applyPreset(key);
      $('.preset-btn').removeClass('is-active');
      $(this).addClass('is-active');
    });

    $container.append($btn);
  });
}

function applyPreset(key) {
  var p = PRESETS[key];
  if (!p) return;
  $('#inputBgColor').val(p.bg);
  $('#inputTextColor').val(p.text);
  $('#inputBtnColor').val(p.btn);
  $('#selectBtnStyle').val(p.style);
  syncColorPreviews();
  updatePreview();
  markDirty();
}

/* ─── COLOR INPUT SYNC ───────────────────────────────────────────────────── */
function syncColorPreviews() {
  ['Bg', 'Text', 'Btn'].forEach(function (name) {
    var val = $('#input' + name + 'Color').val();
    $('#preview' + name + 'Color').css('background', val);
  });
}

$('#inputBgColor, #inputTextColor, #inputBtnColor').on('input', function () {
  syncColorPreviews();
  updatePreview();
  markDirty();
});

$('#selectBtnStyle, #inputBio, #inputAvatarUrl').on('input change', function () {
  if (this.id === 'inputBio') updateCharCount($(this).val());
  if (this.id === 'inputAvatarUrl') updateAvatarPreview($(this).val());
  updatePreview();
  markDirty();
});

function updateCharCount(val) {
  var len = (val || '').length;
  $('#bioCharCount').text(len + '/150');
  $('#bioCharCount').toggleClass('is-over', len > 150);
}

function updateAvatarPreview(url) {
  if (url && url.trim()) {
    $('#previewAvatar').attr('src', url.trim()).show();
    $('#previewAvatarPlaceholder').hide();
  } else {
    $('#previewAvatar').hide();
    $('#previewAvatarPlaceholder').show();
  }
}

/* ─── LIVE PREVIEW ───────────────────────────────────────────────────────── */
function updatePreview() {
  var bg    = $('#inputBgColor').val()   || '#FAFAF8';
  var text  = $('#inputTextColor').val() || '#1A1F36';
  var btn   = $('#inputBtnColor').val()  || '#1A1F36';
  var style = $('#selectBtnStyle').val() || 'rounded';
  var bio   = $('#inputBio').val().trim();
  var avatarUrl = $('#inputAvatarUrl').val().trim();

  var radiusMap = { rounded: '8px', pill: '999px', square: '2px' };
  var radius = radiusMap[style] || '8px';

  var $p = $('#livePreview');
  $p.css('background-color', bg);

  $p.find('.preview-name').css('color', text);
  $p.find('.preview-bio').css('color', text).css('opacity', .7).text(bio || '');
  $p.find('.preview-username').css('color', text).css('opacity', .5);

  $p.find('.preview-link-btn').css({
    'background-color': btn,
    'color': getContrastColor(btn),
    'border-radius': radius,
    'border-color': btn,
  });

  updateAvatarPreview(avatarUrl);

  /* Sample links in preview */
  $p.find('.preview-link-btn').each(function (i) {
    $(this).css({
      'background-color': i === 1 ? 'transparent' : btn,
      'color': i === 1 ? btn : getContrastColor(btn),
      'border': '2px solid ' + btn,
      'border-radius': radius,
    });
  });
}

/* Returns black or white depending on background luminance */
function getContrastColor(hex) {
  var c = hex.replace('#', '');
  if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
  var r = parseInt(c.substr(0,2),16);
  var g = parseInt(c.substr(2,2),16);
  var b = parseInt(c.substr(4,2),16);
  var lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  return lum > 0.55 ? '#1A1F36' : '#FFFFFF';
}

/* ─── SAVE ───────────────────────────────────────────────────────────────── */
$('#btnPublish').on('click', function () {
  if (!currentUser) return;

  var bio      = $('#inputBio').val().trim();
  var photoURL = $('#inputAvatarUrl').val().trim();
  var theme = {
    bg:    $('#inputBgColor').val(),
    text:  $('#inputTextColor').val(),
    btn:   $('#inputBtnColor').val(),
    style: $('#selectBtnStyle').val(),
  };

  if (bio.length > 150) {
    showToast('Bio deve ter no máximo 150 caracteres.', 'error');
    return;
  }

  var $btn = $(this).prop('disabled', true).text('Publicando...');

  db.collection('users').doc(currentUser.uid)
    .update({ bio: bio, photoURL: photoURL, theme: theme })
    .then(function () {
      userData.bio      = bio;
      userData.photoURL = photoURL;
      userData.theme    = theme;
      isDirty = false;
      if (typeof window.gmTrackThemeChanged === 'function') {
        var activePreset = $('.preset-btn.is-active').data('preset') || 'custom';
        window.gmTrackThemeChanged(activePreset);
      }
      showToast('Perfil publicado com sucesso! ✓', 'success');
    })
    .catch(function (err) {
      console.error('Erro ao salvar:', err);
      showToast('Erro ao salvar. Tente novamente.', 'error');
    })
    .finally(function () {
      $btn.prop('disabled', false).text('Publicar');
    });
});

/* ─── DIRTY STATE ────────────────────────────────────────────────────────── */
function markDirty() {
  isDirty = true;
}

window.addEventListener('beforeunload', function (e) {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/* ─── TOAST ──────────────────────────────────────────────────────────────── */
function showToast(message, type) {
  var $toast = $('#designToast');
  $toast
    .removeClass('toast--error toast--success')
    .addClass(type === 'error' ? 'toast--error' : 'toast--success')
    .text(message)
    .addClass('is-visible');

  clearTimeout($toast.data('timer'));
  $toast.data('timer', setTimeout(function () {
    $toast.removeClass('is-visible');
  }, 3000));
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
});

/* ─── SIGN OUT ───────────────────────────────────────────────────────────── */
$('#btnSignOut').on('click', function (e) {
  e.preventDefault();
  auth.signOut().then(function () {
    window.location.replace('/login.html');
  });
});
