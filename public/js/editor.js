(function () {
  'use strict';

  var auth = firebase.auth();
  var db = firebase.firestore();
  var storage = firebase.storage ? firebase.storage() : null;

  var SPOTIFY_REGEX = /(?:https?:\/\/)?(?:open\.)?spotify\.com\/(?:intl-[a-z]{2}\/)?(?:user\/[a-zA-Z0-9]+\/)?(track|album|playlist|artist|show|episode)\/([a-zA-Z0-9]+)/i;
  var SPOTIFY_LABELS = {
    track: 'Música',
    album: 'Álbum',
    playlist: 'Playlist',
    artist: 'Artista',
    show: 'Podcast',
    episode: 'Episódio'
  };

  var YOUTUBE_VIDEO_REGEX = /(?:(?:music\.)?youtube\.com\/(?:watch[?&](?:[^#]*&)?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
  var YOUTUBE_LIST_REGEX  = /(?:(?:music\.)?youtube\.com)\/(?:watch|playlist)[?&#].*?list=([a-zA-Z0-9_-]+)/i;
  var YOUTUBE_LABELS = { video: 'Vídeo', playlist: 'Playlist' };

  var PROVIDERS = {
    spotify: {
      name: 'Spotify',
      color: '#1DB954',
      defaultSize: 'standard',
      sizes: [
        { key: 'compact', label: 'Compact', cols: 1, h: 80, icon: { vb: '0 0 30 10', x: 1, y: 1, w: 28, h: 8, rx: 2 } },
        { key: 'standard', label: 'Padrão', cols: 1, h: 152, icon: { vb: '0 0 16 16', x: 1, y: 1, w: 14, h: 14, rx: 2 } },
        { key: 'wide', label: 'Wide', cols: 2, h: 152, icon: { vb: '0 0 30 14', x: 1, y: 1, w: 28, h: 12, rx: 2 } },
        { key: 'tall', label: 'Tall', cols: 1, h: 352, icon: { vb: '0 0 12 28', x: 1, y: 1, w: 10, h: 26, rx: 2 } },
        { key: 'large', label: 'Large', cols: 2, h: 352, icon: { vb: '0 0 24 22', x: 1, y: 1, w: 22, h: 20, rx: 2 } }
      ]
    },
    whatsapp: {
      name: 'WhatsApp',
      color: '#25D366',
      defaultSize: 'compact',
      sizes: [
        { key: 'mini',     label: 'Meia',       cols: 1, h: 80,  icon: { vb: '0 0 14 10', x: 1, y: 1, w: 12, h: 8,  rx: 2 } },
        { key: 'compact',  label: 'Retangular', cols: 2, h: 80,  icon: { vb: '0 0 30 10', x: 1, y: 1, w: 28, h: 8,  rx: 2 } },
        { key: 'standard', label: 'Quadrado',   cols: 1, h: 220, icon: { vb: '0 0 14 14', x: 1, y: 1, w: 12, h: 12, rx: 2 } },
        { key: 'large',    label: 'Grande',     cols: 2, h: 280, icon: { vb: '0 0 28 20', x: 1, y: 1, w: 26, h: 18, rx: 2 } }
      ]
    },
    youtube: {
      name: 'YouTube',
      color: '#FF0000',
      defaultSize: 'standard',
      sizes: [
        { key: 'compact',  label: 'Compact', cols: 1, h: 80,  icon: { vb: '0 0 30 10', x: 1, y: 1, w: 28, h: 8,  rx: 2 } },
        { key: 'standard', label: 'Padrão',  cols: 1, h: 152, icon: { vb: '0 0 16 16', x: 1, y: 1, w: 14, h: 14, rx: 2 } },
        { key: 'wide',     label: 'Wide',    cols: 2, h: 152, icon: { vb: '0 0 30 14', x: 1, y: 1, w: 28, h: 12, rx: 2 } },
        { key: 'tall',     label: 'Tall',    cols: 1, h: 352, icon: { vb: '0 0 12 28', x: 1, y: 1, w: 10, h: 26, rx: 2 } },
        { key: 'large',    label: 'Large',   cols: 2, h: 352, icon: { vb: '0 0 24 22', x: 1, y: 1, w: 22, h: 20, rx: 2 } }
      ]
    }
  };

  var COL1 = 300;
  var COL2 = 614;
  var SNAP = 28;
  var ARENA_W = 1000;
  var ARENA_H = 1200;
  var DEFAULT_THEME = { bg: '#FAFAF8', text: '#1A1F36', btn: '#1A1F36', style: 'rounded' };
  var USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$|^[a-z0-9]{3}$/;
  var USERNAME_RESERVED = ['admin', 'login', 'register', 'api', 'app', 'getmi', 'www', 'mail', 'support', 'claim'];

  var state = {
    currentUser: null,
    profile: {
      username: '',
      email: '',
      displayName: '',
      bio: '',
      avatarUrl: '',
      theme: DEFAULT_THEME,
      plan: 'free'
    },
    widgets: {},
    widgetSeq: 0,
    profileTimer: null,
    toastTimer: null,
    usernameCheckTimer: null,
    usernameCheckNonce: 0,
    usernameValidation: {
      value: '',
      available: false,
      checking: false,
      message: 'Use letras minúsculas, números e hífen.',
      type: 'idle'
    }
  };

  var $loading = $('#editorLoading');
  var $shell = $('#editorShell');
  var $arena = $('#arena');
  var $toast = $('#editorToast');
  var $saveStatus = $('#saveStatus');
  var $savePulse = $('#savePulse');
  var $settingsPopover = $('#settingsPopover');
  var $dialogBackdrop = $('#dialogBackdrop');
  var $usernameDialog = $('#usernameDialog');
  var $usernameDialogForm = $('#usernameDialogForm');
  var $usernameSuccessPanel = $('#usernameSuccessPanel');
  var $usernameInput = $('#settingsUsernameInput');
  var $usernameStatus = $('#settingsUsernameStatus');
  var $usernameField = $('.username-field');
  var $usernameSubmit = $('#btnUsernameSubmit');
  var $usernameCopy = $('#btnUsernameCopy');
  var $confetti = $('#editorConfetti');
  var profileEl = document.querySelector('.profile');
  var profileHomeParent = profileEl ? profileEl.parentNode : null;
  var profileHomeNext = profileEl ? profileEl.nextElementSibling : null;

  function init() {
    bindPageEvents();
    auth.onAuthStateChanged(function (user) {
      if (!user) {
        window.location.replace('/login.html?view=login');
        return;
      }

      state.currentUser = user;
      loadInitialData();
    });
  }

  function bindPageEvents() {
    $('#btnAddWidget').on('click', openWidgetDrawer);
    $('#btnSignOut').on('click', signOut);
    $('#btnShare').on('click', shareProfile);
    $('#btnSettings').on('click', function (event) {
      event.stopPropagation();
      toggleSettingsPopover();
    });
    $('#btnSettingsOpenProfile').on('click', openPublicProfile);
    $('#btnSettingsLogout').on('click', signOut);
    $('#btnSettingsUsername').on('click', openUsernameDialog);
    $('#btnUsernameDialogClose').on('click', closeUsernameDialog);
    $('#btnUsernameSubmit').on('click', submitUsernameChange);
    $('#btnUsernameCopy').on('click', function () {
      if (!state.profile.username) return;
      copyText(getPublicProfileUrl());
      showToast('Link copiado.', 'success');
    });
    $('#dialogBackdrop').on('click', closeUsernameDialog);

    $('#pfName').on('input', function () {
      state.profile.displayName = $(this).val().trim();
      queueProfileSave();
    });

    $('#pfBio').on('input', function () {
      this.style.height = 'auto';
      this.style.height = this.scrollHeight + 'px';
      state.profile.bio = $(this).val().trim();
      queueProfileSave();
    });

    $('#pfAvatarInput').on('change', function () {
      uploadAvatar(this);
    });

    $('#pfRm').on('click', function (event) {
      removeAvatar(event);
    });

    $('#tD, #tM').on('click', function () {
      setViewport($(this).data('view'));
    });

    $usernameInput.on('input', function () {
      var value = $(this).val().trim().toLowerCase();
      $(this).val(value);
      queueUsernameAvailabilityCheck(value);
    });

    $usernameInput.on('keydown', function (event) {
      if (event.key === 'Enter' && !$usernameSubmit.prop('disabled')) {
        event.preventDefault();
        submitUsernameChange();
      }
    });

    $(document).on('click', function (event) {
      if (!$(event.target).closest('.settings-popover, #btnSettings, .username-dialog').length) {
        closeSettingsPopover();
      }
      if ($(event.target).closest('.tba, .hv, .mv').length) return;
      closeAllToolbars();
    });

    $(document).on('keydown', function (event) {
      if (event.key === 'Escape') {
        closeSettingsPopover();
        closeUsernameDialog();
      }
    });
  }

  function loadInitialData() {
    setSaveState('saving', 'Carregando...');

    Promise.all([
      db.collection('users').doc(state.currentUser.uid).get(),
      db.collection('publicProfiles').doc(state.currentUser.uid).get(),
      db.collection('users').doc(state.currentUser.uid).collection('widgets').orderBy('order').get()
    ]).then(function (results) {
      var userDoc = results[0];
      var publicDoc = results[1];
      var widgetsSnap = results[2];

      hydrateProfile(userDoc.exists ? userDoc.data() : {}, publicDoc.exists ? publicDoc.data() : {});
      hydrateWidgets(widgetsSnap);
      syncProfileUI();
      syncChrome();
      if (!Object.keys(state.widgets).length) {
        addWidget();
      }
      revealEditor();
      setSaveState('saved', 'Salvo');
      syncPublicMirror();
    }).catch(function (error) {
      console.error('Erro ao carregar editor:', error);
      showToast('Não foi possível carregar o editor.', 'error');
      setSaveState('error', 'Erro ao carregar');
    });
  }

  function hydrateProfile(userData, publicData) {
    var merged = publicData && Object.keys(publicData).length ? publicData : userData;
    state.profile.username = merged.username || userData.username || '';
    state.profile.email = userData.email || state.currentUser.email || '';
    state.profile.displayName = merged.displayName || merged.name || userData.displayName || userData.name || state.currentUser.displayName || '';
    state.profile.bio = merged.bio || userData.bio || '';
    state.profile.avatarUrl = merged.avatarUrl || merged.photoURL || userData.avatarUrl || userData.photoURL || state.currentUser.photoURL || '';
    state.profile.theme = merged.theme || userData.theme || DEFAULT_THEME;
    state.profile.plan = merged.plan || userData.plan || 'free';
  }

  function hydrateWidgets(snapshot) {
    state.widgets = {};
    var highestOrder = 0;

    snapshot.forEach(function (doc) {
      var data = doc.data();
      var sizeKey = resolveSizeKey(data.provider, data.size);
      var size = getSize({ provider: data.provider || 'spotify', size: sizeKey });
      var widget = {
        id: doc.id,
        provider: data.provider || 'spotify',
        state: 'active',
        url: data.url || '',
        parsed: data.provider === 'whatsapp'
          ? { phone: data.contentId }
          : { type: data.contentType, id: data.contentId },
        customPhoto: data.customPhoto || null,
        size: sizeKey,
        dark: data.theme === 'dark',
        x: normalizeToGrid(data.position && data.position.x, 28),
        y: normalizeToGrid(data.position && data.position.y, 28),
        order: typeof data.order === 'number' ? data.order : highestOrder,
        isPersisted: true,
        createdAt: data.createdAt || null
      };

      if (!isFinite(widget.x)) widget.x = 28;
      if (!isFinite(widget.y)) widget.y = 28;

      var safe = findSafePlacement(widget.id, widget.x, widget.y, sizeKey, false);
      widget.x = safe.x;
      widget.y = safe.y;
      state.widgets[widget.id] = widget;
      highestOrder = Math.max(highestOrder, widget.order + 1);
      state.widgetSeq += 1;
    });

    renderAllWidgets();
    normalizeWidgetOrders(false);
  }

  function revealEditor() {
    $loading.hide();
    $shell.removeAttr('hidden');
  }

  function syncProfileUI() {
    $('#pfName').val(state.profile.displayName);
    $('#pfBio').val(state.profile.bio).trigger('input');
    renderAvatar(state.profile.avatarUrl);
    syncSettingsUI();
  }

  function syncChrome() {
    var usernameLabel = state.profile.username ? '/' + state.profile.username : '/username';
    $('#topUsername').text(usernameLabel);
    $('#planBadge').text('Plano ' + (state.profile.plan || 'free'));
  }

  function renderAvatar(url) {
    if (url) {
      $('#pfImg').attr('src', url).prop('hidden', false);
      $('.pf-avatar').addClass('has-image');
      $('#pfEmpty').hide();
    } else {
      $('#pfImg').removeAttr('src').prop('hidden', true);
      $('.pf-avatar').removeClass('has-image');
      $('#pfEmpty').show();
    }
  }

  function syncSettingsUI() {
    $('#settingsEmailValue').text(state.profile.email || 'Sem e-mail disponível');
    $('#settingsUsernameValue').text(state.profile.username ? getPublicProfileLabel() : 'Defina um username');
    $('#settingsUsernameResult').text(state.profile.username ? getPublicProfileLabel() : 'getmi.app/username');
  }

  function addWidget() {
    closeAllToolbars();
    var provider = PROVIDERS.spotify;
    var defaultSize = provider.defaultSize;
    var id = 'widget-' + Date.now() + '-' + state.widgetSeq++;
    var pos = findFreePos(defaultSize, null);

    state.widgets[id] = {
      id: id,
      provider: 'spotify',
      state: 'empty',
      url: '',
      parsed: null,
      size: defaultSize,
      dark: false,
      x: pos.x,
      y: pos.y,
      order: nextWidgetOrder(),
      isPersisted: false,
      createdAt: null
    };

    createWidgetElement(id);
    renderWidget(id);
  }

  // ── Widget Drawer ──────────────────────────────────────────────────────

  var SPOTIFY_REGEX_DRAWER = /open\.spotify\.com\/(track|album|playlist|artist|show|episode)\/([A-Za-z0-9]+)/;

  function openWidgetDrawer() {
    closeAllToolbars();
    var overlay = document.getElementById('wdrOverlay');
    var panel   = document.getElementById('wdrPanel');
    if (!overlay || !panel) return;
    overlay.hidden = false;
    panel.hidden   = false;
    requestAnimationFrame(function () {
      overlay.classList.add('open');
      panel.classList.add('open');
    });
    document.getElementById('wdrLinkInput').value = '';

    overlay.onclick = closeWidgetDrawer;
    document.getElementById('wdrClose').onclick = closeWidgetDrawer;

    document.getElementById('wdrTabs').onclick = function (e) {
      var tab = e.target.closest('.wdr-tab');
      if (!tab) return;
      document.querySelectorAll('.wdr-tab').forEach(function (t) { t.classList.remove('on'); });
      document.querySelectorAll('.wdr-section').forEach(function (s) { s.classList.remove('on'); });
      tab.classList.add('on');
      var section = document.getElementById('wds-' + tab.dataset.s);
      if (section) section.classList.add('on');
    };

    panel.querySelector('.wdr-scroll').onclick = function (e) {
      var el = e.target.closest('[data-available]');
      if (!el) return;
      var provider = el.dataset.provider;
      if (provider === 'spotify') {
        closeWidgetDrawer();
        addWidgetInSetup('spotify');
      } else if (provider === 'whatsapp') {
        closeWidgetDrawer();
        addWidgetInSetup('whatsapp');
      } else if (provider === 'youtube') {
        closeWidgetDrawer();
        addWidgetInSetup('youtube');
      }
    };

    document.getElementById('wdrLinkInput').addEventListener('paste', onDrawerLinkPaste, { once: true });
  }

  function closeWidgetDrawer() {
    var overlay = document.getElementById('wdrOverlay');
    var panel   = document.getElementById('wdrPanel');
    if (!overlay || !panel) return;
    overlay.classList.remove('open');
    panel.classList.remove('open');
    setTimeout(function () {
      overlay.hidden = true;
      panel.hidden   = true;
    }, 280);
  }

  function addWidgetInSetup(providerKey) {
    providerKey = providerKey || 'spotify';
    var provider    = PROVIDERS[providerKey];
    var defaultSize = provider.defaultSize;
    var id          = 'widget-' + Date.now() + '-' + state.widgetSeq++;
    var pos         = findFreePos(defaultSize, null);

    state.widgets[id] = {
      id: id,
      provider: providerKey,
      state: 'setup',
      url: '',
      parsed: null,
      size: defaultSize,
      dark: false,
      customPhoto: null,
      x: pos.x,
      y: pos.y,
      order: nextWidgetOrder(),
      isPersisted: false,
      createdAt: null
    };

    createWidgetElement(id);
    renderWidget(id);
  }

  function onDrawerLinkPaste(e) {
    var value = (e.clipboardData || window.clipboardData).getData('text').trim();
    if (!value) return;
    var match = value.match(SPOTIFY_REGEX_DRAWER);
    if (match) {
      closeWidgetDrawer();
      var provider    = PROVIDERS.spotify;
      var defaultSize = provider.defaultSize;
      var id          = 'widget-' + Date.now() + '-' + state.widgetSeq++;
      var pos         = findFreePos(defaultSize, null);
      state.widgets[id] = {
        id: id, provider: 'spotify', state: 'setup',
        url: value, parsed: { type: match[1].toLowerCase(), id: match[2] },
        size: defaultSize, dark: false,
        x: pos.x, y: pos.y,
        order: nextWidgetOrder(), isPersisted: false, createdAt: null
      };
      createWidgetElement(id);
      renderWidget(id);
    }
  }

  // ── End Widget Drawer ──────────────────────────────────────────────────

  function createWidgetElement(id) {
    var widget = state.widgets[id];
    if (!widget) return;

    var el = document.createElement('div');
    el.id = id;
    el.className = 'wd c1';
    el.style.left = widget.x + 'px';
    el.style.top = widget.y + 'px';
    $arena.append(el);
  }

  function renderAllWidgets() {
    $arena.children('.wd').remove();
    var existingHint = document.getElementById('mobAddHint');
    if (existingHint) existingHint.remove();
    Object.keys(state.widgets).sort(sortWidgetIdsForRender).forEach(function (id) {
      createWidgetElement(id);
      renderWidget(id);
    });
    if (document.body.classList.contains('mob')) {
      updateMobAddHint();
    }
  }

  function sortWidgetIdsForRender(a, b) {
    var wa = state.widgets[a];
    var wb = state.widgets[b];
    if (document.body.classList.contains('mob')) {
      return wa.order - wb.order;
    }
    if (wa.y !== wb.y) return wa.y - wb.y;
    return wa.x - wb.x;
  }

  function renderWidget(id) {
    var widget = state.widgets[id];
    var el = document.getElementById(id);
    if (!widget || !el) return;

    var provider = PROVIDERS[widget.provider];
    var moveHandle = buildMoveHandle(id);

    if (document.body.classList.contains('mob')) {
      $arena.append(el);
      el.style.left = '';
      el.style.top = '';
    } else {
      el.style.left = widget.x + 'px';
      el.style.top = widget.y + 'px';
    }

    if (widget.state === 'empty') {
      el.className = 'wd c1';
      el.innerHTML = [
        '<div class="we" onclick="window.editorWidget.toSetup(\'' + id + '\')">',
        '  <div class="we-c"><span class="material-symbols-outlined" aria-hidden="true">add</span></div>',
        '  <span class="we-t">' + provider.name + '</span>',
        '</div>',
        ' <div class="hv hv-d" onclick="event.stopPropagation();window.editorWidget.remove(\'' + id + '\')">' + trashIcon() + '</div>',
        moveHandle
      ].join('');
      return;
    }

    if (widget.state === 'setup') {
      el.className = 'wd c1';

      if (widget.provider === 'whatsapp') {
        el.innerHTML = [
          '<div class="ws">',
          '  <div class="ws-hd">',
          '    <div class="ws-ic ws-ic--wa">' + whatsappGlyph() + '</div>',
          '    <div>',
          '      <div class="ws-nm">WhatsApp</div>',
          '      <div class="ws-ds">Botão de contato direto</div>',
          '    </div>',
          '  </div>',
          '  <div class="ws-wa-row">',
          '    <select class="ws-wa-cc" id="cc' + id + '">',
          '      <option value="55" selected>🇧🇷 +55</option>',
          '      <option value="1">🇺🇸 +1</option>',
          '      <option value="351">🇵🇹 +351</option>',
          '      <option value="54">🇦🇷 +54</option>',
          '      <option value="34">🇪🇸 +34</option>',
          '      <option value="44">🇬🇧 +44</option>',
          '    </select>',
          '    <input class="ws-in ws-wa-nr" id="i' + id + '" placeholder="(00) 0 0000-0000" inputmode="numeric" autocomplete="tel">',
          '  </div>',
          '  <div class="ws-er" id="e' + id + '"></div>',
          '  <div class="ws-wa-photo-row">',
          '    <div class="ws-wa-photo-circle" id="wpc' + id + '">',
          '      <input type="file" id="wapf' + id + '" accept="image/*" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;">',
          '      <span class="ws-wa-photo-plus" id="wpp' + id + '">',
          '        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
          '      </span>',
          '    </div>',
          '    <div>',
          '      <div class="ws-wa-photo-title">Foto do contato</div>',
          '      <div class="ws-wa-photo-sub">Opcional · aparece no widget</div>',
          '    </div>',
          '  </div>',
          '  <div class="ws-bt">',
          '    <button class="ws-cc" onclick="window.editorWidget.toEmpty(\'' + id + '\')">Cancelar</button>',
          '    <button class="ws-go" id="g' + id + '" disabled onclick="window.editorWidget.toActive(\'' + id + '\')">Adicionar</button>',
          '  </div>',
          '</div>',
          moveHandle
        ].join('');

        var waInput = document.getElementById('i' + id);
        setTimeout(function () { waInput.focus(); }, 40);
        waInput.addEventListener('input', function () {
          var pos = waInput.selectionStart;
          var raw = waInput.value.replace(/\D/g, '').substring(0, 11);
          var masked = maskBrPhone(raw);
          waInput.value = masked;
          // Restore cursor: count only digit positions up to old cursor
          try { waInput.setSelectionRange(masked.length, masked.length); } catch(e) {}
          validateWhatsAppWidget(id);
        });
        waInput.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' && state.widgets[id] && state.widgets[id].parsed) { toActive(id); }
          if (event.key === 'Escape') { toEmpty(id); }
        });
        document.getElementById('cc' + id).addEventListener('change', function () { validateWhatsAppWidget(id); });
        document.getElementById('wapf' + id).addEventListener('change', function () { processWidgetPhoto(id, this); });
        return;
      }

      if (widget.provider === 'youtube') {
        el.innerHTML = [
          '<div class="ws">',
          '  <div class="ws-hd">',
          '    <div class="ws-ic" style="background:#FF0000;">' + youtubeGlyph() + '</div>',
          '    <div>',
          '      <div class="ws-nm">' + provider.name + '</div>',
          '      <div class="ws-ds">Vídeo, playlist, canal</div>',
          '    </div>',
          '  </div>',
          '  <input class="ws-in" id="i' + id + '" placeholder="Cole o link do YouTube..." autocomplete="off" spellcheck="false">',
          '  <div class="ws-er" id="e' + id + '"></div>',
          '  <div class="ws-bt">',
          '    <button class="ws-cc" onclick="window.editorWidget.toEmpty(\'' + id + '\')">Cancelar</button>',
          '    <button class="ws-go" id="g' + id + '" disabled onclick="window.editorWidget.toActive(\'' + id + '\')">Adicionar</button>',
          '  </div>',
          '</div>',
          moveHandle
        ].join('');

        var ytInput = document.getElementById('i' + id);
        if (widget.url) ytInput.value = widget.url;

        setTimeout(function () { ytInput.focus(); }, 40);
        ytInput.addEventListener('input', function () {
          validateYoutubeWidget(id);
        });
        ytInput.addEventListener('keydown', function (event) {
          if (event.key === 'Enter' && state.widgets[id] && state.widgets[id].parsed) {
            toActive(id);
          }
          if (event.key === 'Escape') {
            toEmpty(id);
          }
        });

        validateYoutubeWidget(id);
        return;
      }

      el.innerHTML = [
        '<div class="ws">',
        '  <div class="ws-hd">',
        '    <div class="ws-ic">' + spotifyGlyph() + '</div>',
        '    <div>',
        '      <div class="ws-nm">' + provider.name + '</div>',
        '      <div class="ws-ds">Música, álbum, playlist, artista, podcast</div>',
        '    </div>',
        '  </div>',
        '  <input class="ws-in" id="i' + id + '" placeholder="Cole o link do ' + provider.name + '..." autocomplete="off" spellcheck="false">',
        '  <div class="ws-er" id="e' + id + '"></div>',
        '  <div class="ws-bt">',
        '    <button class="ws-cc" onclick="window.editorWidget.toEmpty(\'' + id + '\')">Cancelar</button>',
        '    <button class="ws-go" id="g' + id + '" disabled onclick="window.editorWidget.toActive(\'' + id + '\')">Adicionar</button>',
        '  </div>',
        '</div>',
        moveHandle
      ].join('');

      var input = document.getElementById('i' + id);
      if (widget.url) input.value = widget.url;

      setTimeout(function () { input.focus(); }, 40);
      input.addEventListener('input', function () {
        validateWidget(id);
      });
      input.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && state.widgets[id] && state.widgets[id].parsed) {
          toActive(id);
        }
        if (event.key === 'Escape') {
          toEmpty(id);
        }
      });

      validateWidget(id);
      return;
    }

    var size = getSize(widget);
    el.className = 'wd c' + size.cols;

    if (widget.provider === 'whatsapp') {
      var phone = widget.parsed.phone;
      var waHref = 'https://wa.me/' + phone;
      var displayPhone = formatWhatsAppPhone(phone);
      var waInner;

      var waOnclick = 'onclick="window.openWaLink(event,\'' + phone + '\')"';

      if (widget.size === 'standard') {
        waInner = [
          '<a class="wwa-square" href="' + waHref + '" ' + waOnclick + ' rel="noopener">',
          buildWaIconHtml('wwa-sq-icon', widget.customPhoto),
          '  <div class="wwa-sq-info">',
          '    <div class="wwa-sq-name">Fale comigo</div>',
          '    <div class="wwa-sq-phone">' + displayPhone + '</div>',
          '  </div>',
          '  <div class="wwa-sq-btn">💬 Abrir WhatsApp</div>',
          '</a>'
        ].join('');
      } else if (widget.size === 'large') {
        var phoneParts = displayPhone.replace(/\s+/, ' ').trim().split(' ');
        var phoneLine = phoneParts.length >= 3
          ? phoneParts.slice(0, 3).join(' ') + '<br>' + phoneParts.slice(3).join(' ')
          : displayPhone;
        waInner = [
          '<a class="wwa-large" href="' + waHref + '" ' + waOnclick + ' rel="noopener">',
          '  <div class="wwa-lg-top">',
          '    ' + buildWaIconHtml('wwa-lg-icon', widget.customPhoto),
          '    <div>',
          '      <div class="wwa-lg-tname">WhatsApp</div>',
          '      <div class="wwa-lg-tagline">Respondo em instantes ⚡</div>',
          '    </div>',
          '  </div>',
          '  <div class="wwa-lg-divider"></div>',
          '  <div class="wwa-lg-mid">',
          '    ' + buildWhatsAppQR(),
          '    <div class="wwa-lg-minfo">',
          '      <div class="wwa-lg-phone">' + phoneLine + '</div>',
          '      <div class="wwa-lg-status">Disponível agora</div>',
          '    </div>',
          '  </div>',
          '  <div class="wwa-lg-btn">',
          '    ' + WA_ICON_SVG.replace('viewBox="0 0 48 48"', 'viewBox="0 0 48 48" width="16" height="16"'),
          '    Iniciar conversa no WhatsApp',
          '  </div>',
          '</a>'
        ].join('');
      } else if (widget.size === 'mini') {
        waInner = [
          '<a class="wwa-rect wwa-rect--mini" href="' + waHref + '" ' + waOnclick + ' rel="noopener">',
          buildWaIconHtml('wwa-rect-icon wwa-rect-icon--sm', widget.customPhoto),
          '  <div class="wwa-rect-info">',
          '    <div class="wwa-rect-name">WhatsApp</div>',
          '    <div class="wwa-rect-phone">' + displayPhone + '</div>',
          '  </div>',
          '  <div class="wwa-rect-btn wwa-rect-btn--sm">💬 Chat</div>',
          '</a>'
        ].join('');
      } else {
        // compact (default)
        waInner = [
          '<a class="wwa-rect" href="' + waHref + '" ' + waOnclick + ' rel="noopener">',
          buildWaIconHtml('wwa-rect-icon', widget.customPhoto),
          '  <div class="wwa-rect-info">',
          '    <div class="wwa-rect-name">Fale comigo no WhatsApp</div>',
          '    <div class="wwa-rect-phone">' + displayPhone + '</div>',
          '  </div>',
          '  <div class="wwa-rect-btn">💬 Chamar agora</div>',
          '</a>'
        ].join('');
      }

      el.innerHTML = [
        '<div class="wa wa--wa" style="height:' + size.h + 'px">',
        waInner,
        '</div>',
        '<div class="hv hv-e" onclick="event.stopPropagation();window.editorWidget.openToolbar(\'' + id + '\')">' + pencilIcon() + '</div>',
        '<div class="hv hv-d" onclick="event.stopPropagation();window.editorWidget.remove(\'' + id + '\')">' + trashIcon() + '</div>',
        moveHandle,
        '<div class="tba" id="t' + id + '">',
        '  <div class="tbr">',
        buildToolbarButtons(id),
        '    <div class="tb-sep"></div>',
        '    <button class="tb-i" onclick="window.editorWidget.closeToolbar(\'' + id + '\')" title="Fechar">' + closeIcon() + '</button>',
        '  </div>',
        '</div>'
      ].join('');
      return;
    }

    if (widget.provider === 'youtube') {
      var ytSrc = buildYoutubeEmbedSrc(widget);
      el.innerHTML = [
        '<div class="wa" style="height:' + size.h + 'px">',
        '  <iframe src="' + ytSrc + '" style="height:' + size.h + 'px" loading="lazy" allow="autoplay; encrypted-media; fullscreen; picture-in-picture"></iframe>',
        '</div>',
        '<div class="hv hv-e" onclick="event.stopPropagation();window.editorWidget.openToolbar(\'' + id + '\')">' + pencilIcon() + '</div>',
        '<div class="hv hv-d" onclick="event.stopPropagation();window.editorWidget.remove(\'' + id + '\')">' + trashIcon() + '</div>',
        moveHandle,
        '<div class="tba" id="t' + id + '">',
        '  <div class="tbr">',
        buildToolbarButtons(id),
        '    <div class="tb-sep"></div>',
        '    <button class="tb-i" onclick="window.editorWidget.closeToolbar(\'' + id + '\')" title="Fechar">' + closeIcon() + '</button>',
        '  </div>',
        '</div>'
      ].join('');
      return;
    }

    var src = buildSpotifyEmbedSrc(widget);
    el.innerHTML = [
      '<div class="wa" style="height:' + size.h + 'px">',
      '  <iframe src="' + src + '" style="height:' + size.h + 'px" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>',
      '</div>',
      '<div class="hv hv-e" onclick="event.stopPropagation();window.editorWidget.openToolbar(\'' + id + '\')">' + pencilIcon() + '</div>',
      '<div class="hv hv-d" onclick="event.stopPropagation();window.editorWidget.remove(\'' + id + '\')">' + trashIcon() + '</div>',
      moveHandle,
      '<div class="tba" id="t' + id + '">',
      '  <div class="tbr">',
      buildToolbarButtons(id),
      '    <div class="tb-sep"></div>',
      '    <button class="tb-i ' + (widget.dark ? 'on' : '') + '" onclick="window.editorWidget.toggleTheme(\'' + id + '\')" title="Tema escuro">' + moonIcon() + '</button>',
      '    <button class="tb-i" onclick="window.editorWidget.closeToolbar(\'' + id + '\')" title="Fechar">' + closeIcon() + '</button>',
      '  </div>',
      '</div>'
    ].join('');
  }

  function buildMoveHandle(id) {
    return '<div class="mv" onpointerdown="window.editorWidget.initMove(\'' + id + '\', event)">' + gripIcon() + '</div>';
  }

  function buildToolbarButtons(id) {
    var widget = state.widgets[id];
    var current = widget.size;
    var providerDef = PROVIDERS[widget.provider] || PROVIDERS.spotify;
    return providerDef.sizes.map(function (size) {
      var icon = size.icon;
      return [
        '<button class="tb-b ' + (size.key === current ? 'on' : '') + '" onclick="window.editorWidget.resize(\'' + id + '\', \'' + size.key + '\')" title="' + size.label + ' · ' + size.cols + ' col · ' + size.h + 'px">',
        '  <svg viewBox="' + icon.vb + '" width="16" height="16">',
        '    <rect x="' + icon.x + '" y="' + icon.y + '" width="' + icon.w + '" height="' + icon.h + '" rx="' + icon.rx + '"></rect>',
        '  </svg>',
        '</button>'
      ].join('');
    }).join('');
  }

  function buildSpotifyEmbedSrc(widget) {
    var suffix = widget.dark ? '&theme=0' : '';
    return 'https://open.spotify.com/embed/' + widget.parsed.type + '/' + widget.parsed.id + '?utm_source=getmi' + suffix;
  }

  function buildYoutubeEmbedSrc(widget) {
    if (widget.parsed.type === 'playlist') {
      return 'https://www.youtube.com/embed/videoseries?list=' + widget.parsed.id;
    }
    return 'https://www.youtube.com/embed/' + widget.parsed.id;
  }

  function youtubeGlyph() {
    return '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="#fff" d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg>';
  }

  function validateYoutubeWidget(id) {
    var widget = state.widgets[id];
    var input  = document.getElementById('i' + id);
    var error  = document.getElementById('e' + id);
    var button = document.getElementById('g' + id);
    if (!widget || !input || !error || !button) return;

    var value = input.value.trim();
    if (!value) {
      input.className = 'ws-in';
      error.textContent = '';
      button.disabled = true;
      widget.parsed = null;
      widget.url = '';
      return;
    }

    // Playlist primeiro
    var listMatch = value.match(YOUTUBE_LIST_REGEX);
    if (listMatch) {
      var vidMatch = value.match(YOUTUBE_VIDEO_REGEX);
      widget.url = value;
      widget.parsed = { type: 'playlist', id: listMatch[1], videoId: vidMatch ? vidMatch[1] : null };
      input.className = 'ws-in ok';
      error.style.color = 'var(--editor-mint)';
      error.textContent = 'Playlist detectada';
      button.disabled = false;
      return;
    }

    // Vídeo / Short
    var videoMatch = value.match(YOUTUBE_VIDEO_REGEX);
    if (videoMatch) {
      widget.url = value;
      widget.parsed = { type: 'video', id: videoMatch[1] };
      input.className = 'ws-in ok';
      error.style.color = 'var(--editor-mint)';
      error.textContent = 'Vídeo detectado';
      button.disabled = false;
      return;
    }

    widget.parsed = null;
    widget.url = value;
    input.className = 'ws-in bad';
    error.style.color = '#EF4444';
    error.textContent = 'Cole uma URL válida do YouTube';
    button.disabled = true;
  }

  function validateWidget(id) {
    var widget = state.widgets[id];
    var input = document.getElementById('i' + id);
    var error = document.getElementById('e' + id);
    var button = document.getElementById('g' + id);
    if (!widget || !input || !error || !button) return;

    var value = input.value.trim();
    if (!value) {
      input.className = 'ws-in';
      error.textContent = '';
      button.disabled = true;
      widget.parsed = null;
      widget.url = '';
      return;
    }

    if (value.indexOf('spotify:') === 0) {
      var parts = value.split(':');
      if (parts.length >= 3) {
        value = 'https://open.spotify.com/' + parts[1] + '/' + parts[2];
      }
    }

    var match = value.match(SPOTIFY_REGEX);
    if (match) {
      widget.url = value;
      widget.parsed = { type: match[1].toLowerCase(), id: match[2] };
      input.className = 'ws-in ok';
      error.style.color = 'var(--editor-mint)';
      error.textContent = SPOTIFY_LABELS[match[1].toLowerCase()] + ' detectado';
      button.disabled = false;
      return;
    }

    widget.parsed = null;
    widget.url = value;
    input.className = 'ws-in bad';
    error.style.color = '#EF4444';
    error.textContent = 'Cole uma URL válida do Spotify';
    button.disabled = true;
  }

  function maskBrPhone(digits) {
    // digits: up to 11 raw digits (DDD + number)
    if (digits.length === 0) return '';
    if (digits.length <= 2) return '(' + digits;
    var ddd  = digits.substring(0, 2);
    var rest = digits.substring(2);
    if (rest.length === 0) return '(' + ddd + ') ';
    if (rest.length <= 4) return '(' + ddd + ') ' + rest;
    // 11 digits: (DDD) 9 XXXX-XXXX
    if (digits.length === 11) {
      return '(' + ddd + ') ' + rest[0] + ' ' + rest.substring(1, 5) + '-' + rest.substring(5);
    }
    // 5-8 digits after DDD → still typing landline or mobile
    if (rest.length <= 8) {
      var mid = rest.length <= 4 ? rest : rest.substring(0, 4) + '-' + rest.substring(4);
      return '(' + ddd + ') ' + mid;
    }
    // 9+ → landline (8) or mobile (9)
    if (rest.length === 9) {
      return '(' + ddd + ') ' + rest[0] + ' ' + rest.substring(1, 5) + '-' + rest.substring(5);
    }
    return '(' + ddd + ') ' + rest.substring(0, 4) + '-' + rest.substring(4);
  }

  function validateWhatsAppWidget(id) {
    var widget = state.widgets[id];
    var ccEl   = document.getElementById('cc' + id);
    var input  = document.getElementById('i' + id);
    var error  = document.getElementById('e' + id);
    var button = document.getElementById('g' + id);
    if (!widget || !ccEl || !input || !error || !button) return;

    var digits = input.value.replace(/\D/g, '');
    if (!digits) {
      input.className = 'ws-in ws-wa-nr';
      error.textContent = '';
      button.disabled = true;
      widget.parsed = null;
      return;
    }

    var minLen = 10, maxLen = 11;
    if (digits.length < minLen || digits.length > maxLen) {
      input.className = 'ws-in ws-wa-nr bad';
      error.style.color = '#EF4444';
      error.textContent = 'Número incompleto';
      button.disabled = true;
      widget.parsed = null;
      return;
    }

    var full = ccEl.value + digits;
    widget.parsed = { phone: full };
    widget.url = 'https://wa.me/' + full;
    input.className = 'ws-in ws-wa-nr ok';
    error.style.color = 'var(--editor-mint)';
    error.textContent = 'Número válido';
    button.disabled = false;
  }

  function formatWhatsAppPhone(phone) {
    // phone = countryCode + number, e.g. '5579996718588'
    // Try to detect country code length (1, 2, or 3 digits)
    // Default to 2 (Brazil +55)
    var ccLen = 2;
    var rest = phone.substring(ccLen);
    var cc = phone.substring(0, ccLen);
    if (rest.length === 11) {
      // mobile with 9: (DDD) 9 XXXX-XXXX
      return '+' + cc + ' (' + rest.substring(0, 2) + ') ' + rest.substring(2, 3) + ' ' + rest.substring(3, 7) + '-' + rest.substring(7);
    }
    if (rest.length === 10) {
      // landline: (DDD) XXXX-XXXX
      return '+' + cc + ' (' + rest.substring(0, 2) + ') ' + rest.substring(2, 6) + '-' + rest.substring(6);
    }
    return '+' + phone;
  }

  var WA_ICON_SVG = '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="#fff"/><path fill="#25D366" d="M24 7C14.6 7 7 14.6 7 24c0 3 .8 5.9 2.3 8.4L7 41l8.9-2.3C18.2 40.2 21 41 24 41c9.4 0 17-7.6 17-17S33.4 7 24 7z"/><path fill="#fff" d="M33.5 28.6c-.5-.2-2.9-1.4-3.3-1.6-.4-.2-.7-.2-1 .2-.3.5-1.2 1.6-1.5 1.9-.3.3-.5.4-1 .1-.5-.2-2-.7-3.8-2.3-1.4-1.2-2.4-2.8-2.6-3.2-.3-.5 0-.7.2-.9l.6-.8c.2-.3.3-.5.4-.8.1-.3 0-.6-.1-.8-.1-.2-1-2.5-1.4-3.4-.4-.9-.8-.8-1-.8h-.9c-.3 0-.8.1-1.2.6-.4.4-1.6 1.6-1.6 3.9s1.6 4.5 1.9 4.8c.2.3 3.2 5 7.9 7 1.1.5 2 .8 2.7 1 1.1.3 2.2.3 3 .2.9-.1 2.9-1.2 3.3-2.3.4-1.1.4-2.1.3-2.3-.1-.3-.4-.4-.9-.6z"/></svg>';

  function whatsappGlyph() {
    return WA_ICON_SVG;
  }

  function buildWaIconHtml(iconClass, customPhoto) {
    var url = customPhoto || (state.profile && state.profile.avatarUrl);
    var badgeSvg = WA_ICON_SVG.replace('viewBox="0 0 48 48"', 'viewBox="0 0 48 48" width="14" height="14"');
    if (url) {
      return [
        '<div class="wwa-icon-wrap ' + iconClass + '" style="background:transparent;">',
        '  <img class="wwa-avatar" src="' + url + '" alt="" style="clip-path:circle(50% at 50% 50%);">',
        '</div>'
      ].join('');
    }
    return '<div class="' + iconClass + '">' + WA_ICON_SVG + '</div>';
  }

  function processWidgetPhoto(id, input) {
    var file = input.files && input.files[0];
    if (!file) return;
    var widget = state.widgets[id];
    if (!widget) return;

    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        var MAX = 400;
        var w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        widget.customPhoto = dataUrl; // data URL temporário; será trocado pela URL do Storage no toActive
        updateWidgetPhotoCircle(id);
        input.value = '';
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function removeWidgetPhoto(id) {
    var widget = state.widgets[id];
    if (!widget) return;
    widget.customPhoto = null;
    updateWidgetPhotoCircle(id);
  }

  function updateWidgetPhotoCircle(id) {
    var widget = state.widgets[id];
    var circle = document.getElementById('wpc' + id);
    var plus   = document.getElementById('wpp' + id);
    if (!circle) return;
    // remove preview anterior
    var prev = circle.querySelector('img.ws-wa-ph-img');
    if (prev) prev.remove();
    var rmBtn = circle.querySelector('.ws-wa-photo-rm');
    if (rmBtn) rmBtn.remove();

    if (widget && widget.customPhoto) {
      circle.classList.add('has-photo');
      var img = document.createElement('img');
      img.className = 'ws-wa-ph-img';
      img.src = widget.customPhoto;
      circle.insertBefore(img, circle.firstChild);
      var btn = document.createElement('div');
      btn.className = 'ws-wa-photo-rm';
      btn.title = 'Remover foto';
      btn.innerHTML = '✕';
      btn.onclick = function (e) { e.stopPropagation(); removeWidgetPhoto(id); };
      circle.appendChild(btn);
      if (plus) plus.style.display = 'none';
    } else {
      circle.classList.remove('has-photo');
      if (plus) plus.style.display = '';
    }
  }

  function buildWhatsAppQR() {
    var pattern = [1,1,0,1,1,0,1,1,0,1,0,0,0,1,0,0,1,1,1,0,1,0,1,1,0,1,1,0,0,0,1,1,0,1,1,0];
    return '<div class="wwa-qr">' + pattern.map(function (v) {
      return '<div class="wwa-qr-cell" style="background:' + (v ? 'rgba(255,255,255,.85)' : 'transparent') + '"></div>';
    }).join('') + '</div>';
  }

  function toSetup(id) {
    var widget = state.widgets[id];
    if (!widget) return;
    closeAllToolbars();
    widget.state = 'setup';
    renderWidget(id);
  }

  function toEmpty(id) {
    var widget = state.widgets[id];
    if (!widget) return;

    if (!widget.isPersisted) {
      deleteWidgetElement(id);
      return;
    }

    removeWidget(id);
  }

  function toActive(id) {
    var widget = state.widgets[id];
    if (!widget || !widget.parsed) return;

    widget.state = 'active';
    var safe = findSafePlacement(id, widget.x, widget.y, widget.size, true);
    widget.x = safe.x;
    widget.y = safe.y;
    renderWidget(id);
    normalizeWidgetOrders(false);

    // Se há uma foto como data URL (ainda não enviada ao Storage), faz upload antes de persistir
    if (widget.provider === 'whatsapp' && widget.customPhoto && widget.customPhoto.indexOf('data:') === 0 && storage) {
      setSaveState('saving', 'Salvando...');
      var dataUrl = widget.customPhoto;
      var byteStr = atob(dataUrl.split(',')[1]);
      var ab = new ArrayBuffer(byteStr.length);
      var ia = new Uint8Array(ab);
      for (var i = 0; i < byteStr.length; i++) { ia[i] = byteStr.charCodeAt(i); }
      var blob = new Blob([ab], { type: 'image/jpeg' });
      var photoPath = 'widget-photos/' + state.currentUser.uid + '/' + id + '.jpg';
      storage.ref().child(photoPath).put(blob, { contentType: 'image/jpeg' })
        .then(function (snap) { return snap.ref.getDownloadURL(); })
        .then(function (url) {
          widget.customPhoto = url;
          persistWidget(widget, true);
        })
        .catch(function () {
          // falha no upload da foto — persiste sem ela
          widget.customPhoto = null;
          persistWidget(widget, true);
        });
    } else {
      persistWidget(widget, true);
    }
  }

  function openToolbar(id) {
    closeAllToolbars();
    renderWidget(id);
    setTimeout(function () {
      var toolbar = document.getElementById('t' + id);
      if (toolbar) toolbar.classList.add('show');
    }, 20);
  }

  function closeToolbar(id) {
    var toolbar = document.getElementById('t' + id);
    if (toolbar) toolbar.classList.remove('show');
  }

  function closeAllToolbars() {
    $('.tba.show').removeClass('show');
  }

  function resizeWidget(id, sizeKey) {
    var widget = state.widgets[id];
    if (!widget) return;

    widget.size = resolveSizeKey(widget.provider, sizeKey);
    var safe = findSafePlacement(id, widget.x, widget.y, widget.size, true);
    widget.x = safe.x;
    widget.y = safe.y;
    renderWidget(id);
    openToolbar(id);
    normalizeWidgetOrders(false);
    if (widget.isPersisted) {
      persistWidget(widget, false);
    }
  }

  function toggleTheme(id) {
    var widget = state.widgets[id];
    if (!widget) return;
    widget.dark = !widget.dark;
    renderWidget(id);
    openToolbar(id);
    if (widget.isPersisted) {
      persistWidget(widget, false);
    }
  }

  function removeWidget(id) {
    var widget = state.widgets[id];
    if (!widget) return;

    setSaveState('saving', 'Salvando...');
    closeAllToolbars();

    var finalize = function () {
      deleteWidgetElement(id);
      normalizeWidgetOrders(true);
      setSaveState('saved', 'Salvo');
    };

    if (!widget.isPersisted) {
      finalize();
      return;
    }

    db.collection('users').doc(state.currentUser.uid).collection('widgets').doc(id).delete()
      .then(finalize)
      .catch(function (error) {
        console.error('Erro ao remover widget:', error);
        setSaveState('error', 'Erro ao salvar');
        showToast('Não foi possível remover o widget.', 'error');
      });
  }

  function deleteWidgetElement(id) {
    $('#' + id).remove();
    delete state.widgets[id];
  }

  function normalizeWidgetOrders(shouldPersist) {
    var ordered = Object.keys(state.widgets)
      .filter(function (id) { return state.widgets[id].state === 'active'; })
      .sort(function (a, b) {
        var wa = state.widgets[a];
        var wb = state.widgets[b];
        if (wa.y !== wb.y) return wa.y - wb.y;
        return wa.x - wb.x;
      });

    ordered.forEach(function (id, index) {
      state.widgets[id].order = index;
    });

    if (document.body.classList.contains('mob')) {
      renderAllWidgets();
    }

    if (!shouldPersist) return;

    ordered.forEach(function (id) {
      if (state.widgets[id].isPersisted) {
        persistWidget(state.widgets[id], false, true);
      }
    });
  }

  function persistWidget(widget, includeCreatedAt, silent) {
    var contentType, contentId;
    if (widget.provider === 'whatsapp') {
      contentType = 'whatsapp_cta';
      contentId   = widget.parsed.phone;
    } else {
      contentType = widget.parsed.type;
      contentId   = widget.parsed.id;
    }
    var payload = {
      provider: widget.provider,
      contentType: contentType,
      contentId: contentId,
      url: widget.url,
      customPhoto: widget.customPhoto || null,
      size: widget.size,
      theme: widget.dark ? 'dark' : 'light',
      position: { x: widget.x, y: widget.y },
      order: widget.order,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (includeCreatedAt) {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }

    if (!silent) setSaveState('saving', 'Salvando...');

    db.collection('users').doc(state.currentUser.uid).collection('widgets').doc(widget.id).set(payload, { merge: true })
      .then(function () {
        widget.isPersisted = true;
        if (!silent) setSaveState('saved', 'Salvo');
      })
      .catch(function (error) {
        console.error('Erro ao salvar widget:', error);
        setSaveState('error', 'Erro ao salvar');
        showToast('Não foi possível salvar o widget.', 'error');
      });
  }

  function queueProfileSave() {
    clearTimeout(state.profileTimer);
    setSaveState('saving', 'Salvando...');
    state.profileTimer = setTimeout(saveProfile, 1000);
  }

  function saveProfile() {
    if (!state.currentUser) return;

    var username = state.profile.username || '';
    var publicPayload = {
      username: username,
      displayName: state.profile.displayName,
      name: state.profile.displayName,
      bio: state.profile.bio,
      avatarUrl: state.profile.avatarUrl,
      photoURL: state.profile.avatarUrl,
      theme: state.profile.theme || DEFAULT_THEME,
      plan: state.profile.plan || 'free',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    var userPayload = {
      username: username,
      displayName: state.profile.displayName,
      name: state.profile.displayName,
      bio: state.profile.bio,
      avatarUrl: state.profile.avatarUrl,
      photoURL: state.profile.avatarUrl,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    var batch = db.batch();
    batch.set(db.collection('users').doc(state.currentUser.uid), userPayload, { merge: true });
    batch.set(db.collection('publicProfiles').doc(state.currentUser.uid), publicPayload, { merge: true });

    batch.commit()
      .then(function () {
        syncChrome();
        setSaveState('saved', 'Salvo');
      })
      .catch(function (error) {
        console.error('Erro ao salvar perfil:', error);
        setSaveState('error', 'Erro ao salvar');
        showToast('Não foi possível salvar o perfil.', 'error');
      });
  }

  function syncPublicMirror() {
    saveProfile();
  }

  function uploadAvatar(input) {
    var file = input.files && input.files[0];
    if (!file) return;

    if (!storage) {
      showToast('Storage não está disponível neste ambiente.', 'error');
      input.value = '';
      return;
    }

    var previousUrl = state.profile.avatarUrl;
    setSaveState('saving', 'Enviando avatar...');

    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        // Redimensiona para no máximo 400×400 mantendo proporção
        var MAX = 400;
        var w = img.width, h = img.height;
        if (w > h) { if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; } }
        else        { if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; } }

        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);

        // Preview imediato com a versão redimensionada (antes do upload terminar)
        renderAvatar(canvas.toDataURL('image/jpeg', 0.85));

        canvas.toBlob(function (blob) {
          if (!blob) {
            state.profile.avatarUrl = previousUrl;
            renderAvatar(previousUrl);
            setSaveState('error', 'Erro ao processar');
            showToast('Não foi possível processar a imagem.', 'error');
            input.value = '';
            return;
          }
          var path = 'avatars/' + state.currentUser.uid + '/' + Date.now() + '.jpg';
          storage.ref().child(path).put(blob, { contentType: 'image/jpeg' })
            .then(function (snapshot) { return snapshot.ref.getDownloadURL(); })
            .then(function (url) {
              state.profile.avatarUrl = url;
              renderAvatar(url);
              showToast('Avatar atualizado.', 'success');
              queueProfileSave();
            })
            .catch(function (error) {
              console.error('Erro ao enviar avatar:', error);
              state.profile.avatarUrl = previousUrl;
              renderAvatar(previousUrl);
              setSaveState('error', 'Erro ao salvar');
              showToast('Não foi possível enviar o avatar.', 'error');
            })
            .finally(function () { input.value = ''; });
        }, 'image/jpeg', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function removeAvatar(event) {
    event.preventDefault();
    event.stopPropagation();
    state.profile.avatarUrl = '';
    renderAvatar('');
    queueProfileSave();
  }

  function toggleSettingsPopover() {
    if ($settingsPopover.prop('hidden')) {
      syncSettingsUI();
      $settingsPopover.prop('hidden', false);
      return;
    }
    closeSettingsPopover();
  }

  function closeSettingsPopover() {
    $settingsPopover.prop('hidden', true);
  }

  function openUsernameDialog() {
    closeSettingsPopover();
    resetUsernameDialog();
    $dialogBackdrop.prop('hidden', false);
    $usernameDialog.prop('hidden', false);
    setTimeout(function () {
      $usernameInput.trigger('focus');
    }, 40);
  }

  function closeUsernameDialog() {
    clearTimeout(state.usernameCheckTimer);
    $dialogBackdrop.prop('hidden', true);
    $usernameDialog.prop('hidden', true);
  }

  function resetUsernameDialog() {
    var seed = state.profile.username || suggestUsernameFromProfile();
    $usernameDialogForm.prop('hidden', false);
    $usernameSuccessPanel.prop('hidden', true);
    $usernameSubmit.removeClass('is-loading').prop('disabled', true).text('Salvar meu link');
    $usernameField.removeClass('is-valid is-invalid');
    $usernameInput.val(seed);
    state.usernameValidation = {
      value: '',
      available: false,
      checking: false,
      message: 'Use letras minúsculas, números e hífen.',
      type: 'idle'
    };
    queueUsernameAvailabilityCheck(seed);
  }

  function suggestUsernameFromProfile() {
    var base = (state.profile.displayName || '').toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
    return base || '';
  }

  function queueUsernameAvailabilityCheck(value) {
    clearTimeout(state.usernameCheckTimer);
    state.usernameValidation.value = value;

    var localError = validateUsernameValue(value);
    if (localError) {
      setUsernameStatus('error', localError);
      updateUsernameSubmitState();
      return;
    }

    if (value === (state.profile.username || '')) {
      setUsernameStatus('success', 'Este link já está ativo na sua conta.');
      state.usernameValidation.available = false;
      updateUsernameSubmitState();
      return;
    }

    setUsernameStatus('checking', 'Verificando disponibilidade...');
    var nonce = ++state.usernameCheckNonce;
    state.usernameCheckTimer = setTimeout(function () {
      db.collection('usernames').doc(value).get()
        .then(function (doc) {
          if (nonce !== state.usernameCheckNonce) return;

          if (doc.exists && doc.data() && doc.data().uid !== state.currentUser.uid) {
            setUsernameStatus('error', 'Este username já está em uso.');
            updateUsernameSubmitState();
            return;
          }

          setUsernameStatus('success', 'Username disponível.');
          updateUsernameSubmitState();
        })
        .catch(function () {
          if (nonce !== state.usernameCheckNonce) return;
          setUsernameStatus('error', 'Não foi possível verificar agora.');
          updateUsernameSubmitState();
        });
    }, 320);
  }

  function validateUsernameValue(value) {
    if (!value || value.length < 3) return 'O username precisa ter pelo menos 3 caracteres.';
    if (value.length > 30) return 'O username precisa ter no máximo 30 caracteres.';
    if (!USERNAME_REGEX.test(value)) return 'Use apenas letras minúsculas, números e hífen.';
    if (USERNAME_RESERVED.indexOf(value) !== -1) return 'Esse username é reservado.';
    return null;
  }

  function setUsernameStatus(type, message) {
    state.usernameValidation.type = type;
    state.usernameValidation.message = message;
    state.usernameValidation.checking = type === 'checking';
    state.usernameValidation.available = type === 'success' && state.usernameValidation.value !== (state.profile.username || '');

    $usernameStatus
      .removeClass('is-error is-success is-checking')
      .text(message);

    $usernameField.removeClass('is-valid is-invalid');

    if (type === 'error') {
      $usernameStatus.addClass('is-error');
      $usernameField.addClass('is-invalid');
    } else if (type === 'success') {
      $usernameStatus.addClass('is-success');
      if (state.usernameValidation.available) {
        $usernameField.addClass('is-valid');
      }
    } else if (type === 'checking') {
      $usernameStatus.addClass('is-checking');
    }
  }

  function updateUsernameSubmitState() {
    var isLoading = $usernameSubmit.hasClass('is-loading');
    var disabled = isLoading || !state.usernameValidation.available || state.usernameValidation.checking;
    $usernameSubmit.prop('disabled', disabled);
  }

  function submitUsernameChange() {
    var nextUsername = ($usernameInput.val() || '').trim().toLowerCase();
    if ($usernameSubmit.prop('disabled') || !nextUsername) return;

    var oldUsername = state.profile.username || '';
    var batch = db.batch();
    var now = firebase.firestore.FieldValue.serverTimestamp();

    $usernameSubmit.addClass('is-loading').prop('disabled', true).text('Salvando...');
    setSaveState('saving', 'Atualizando link...');

    if (oldUsername && oldUsername !== nextUsername) {
      batch.delete(db.collection('usernames').doc(oldUsername));
    }

    batch.set(db.collection('usernames').doc(nextUsername), {
      uid: state.currentUser.uid,
      createdAt: now
    }, { merge: true });

    batch.set(db.collection('users').doc(state.currentUser.uid), {
      username: nextUsername,
      updatedAt: now
    }, { merge: true });

    batch.set(db.collection('publicProfiles').doc(state.currentUser.uid), {
      username: nextUsername,
      updatedAt: now
    }, { merge: true });

    batch.commit()
      .then(function () {
        state.profile.username = nextUsername;
        syncChrome();
        syncSettingsUI();
        setSaveState('saved', 'Salvo');
        showUsernameSuccess();
        fireConfetti();
      })
      .catch(function (error) {
        console.error('Erro ao atualizar username:', error);
        $usernameSubmit.removeClass('is-loading').text('Salvar meu link');
        setSaveState('error', 'Erro ao salvar');
        setUsernameStatus('error', 'Não foi possível atualizar o username.');
        updateUsernameSubmitState();
      });
  }

  function showUsernameSuccess() {
    $usernameSubmit.removeClass('is-loading').text('Salvar meu link');
    $usernameDialogForm.prop('hidden', true);
    $usernameSuccessPanel.prop('hidden', false);
    $('#settingsUsernameResult').text(getPublicProfileLabel());
  }

  function fireConfetti() {
    var dialogRect = $usernameDialog.is(':hidden')
      ? { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0, height: 0 }
      : document.getElementById('usernameDialog').getBoundingClientRect();
    var originX = dialogRect.left + (dialogRect.width / 2);
    var originY = dialogRect.top + Math.min(120, dialogRect.height / 2);
    var colors = ['#FF6B4A', '#7DDC7C', '#7F8BF4', '#FFD66B', '#63C7F8', '#F48AE0'];
    var pieces = [];
    var count = 42;

    for (var i = 0; i < count; i += 1) {
      var piece = document.createElement('span');
      piece.className = 'confetti-piece';
      piece.style.left = originX + 'px';
      piece.style.top = originY + 'px';
      piece.style.background = colors[i % colors.length];
      piece.style.setProperty('--dx', (Math.random() * 520 - 260) + 'px');
      piece.style.setProperty('--dy', (Math.random() * 240 + 110) + 'px');
      piece.style.setProperty('--rot', (Math.random() * 720 - 360) + 'deg');
      piece.style.animationDelay = (Math.random() * 110) + 'ms';
      pieces.push(piece);
      $confetti.append(piece);
    }

    setTimeout(function () {
      pieces.forEach(function (piece) {
        piece.remove();
      });
    }, 1700);
  }

  function getPublicProfileUrl() {
    return 'https://getmi.app/' + state.profile.username;
  }

  function getPublicProfileLabel() {
    return 'getmi.app/' + state.profile.username;
  }

  function copyText(value) {
    var fallback = function () {
      var input = document.createElement('input');
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).catch(fallback);
      return;
    }

    fallback();
  }

  function signOut() {
    auth.signOut().then(function () {
      window.location.replace('/login.html?view=login');
    });
  }

  function shareProfile() {
    if (!state.profile.username) {
      showToast('Defina um username antes de compartilhar.', 'error');
      return;
    }

    var url = getPublicProfileUrl();
    copyText(url);
    showToast('Link copiado: ' + url, 'success');
  }

  function openPublicProfile() {
    if (!state.profile.username) {
      showToast('Defina um username antes de abrir o perfil.', 'error');
      return;
    }

    window.open('/' + state.profile.username, '_blank', 'noopener');
  }

  function mountProfileForViewport(mobile) {
    if (!profileEl || !profileHomeParent) return;

    if (mobile) {
      if (profileEl.parentNode !== $arena[0]) {
        $arena.prepend(profileEl);
      }
      return;
    }

    if (profileEl.parentNode !== profileHomeParent) {
      if (profileHomeNext && profileHomeNext.parentNode === profileHomeParent) {
        profileHomeParent.insertBefore(profileEl, profileHomeNext);
      } else {
        profileHomeParent.appendChild(profileEl);
      }
    }
  }

  function setViewport(view) {
    var mobile = view === 'mobile';
    closeAllToolbars();
    document.body.classList.toggle('mob', mobile);
    $('#tD').toggleClass('on', !mobile);
    $('#tM').toggleClass('on', mobile);
    mountProfileForViewport(mobile);
    renderAllWidgets();
    var board = document.querySelector('.board');
    if (board) board.scrollTo(0, 0);
  }

  function updateMobAddHint() {
    var existing = document.getElementById('mobAddHint');
    if (existing) existing.remove();
    var hint = document.createElement('div');
    hint.id = 'mobAddHint';
    hint.className = 'mob-add-hint';
    hint.innerHTML = '<span class="material-symbols-outlined" aria-hidden="true">add</span> Adicionar widget';
    hint.onclick = openWidgetDrawer;
    $arena.append(hint);
  }

  function initMove(id, event) {
    if (document.body.classList.contains('mob')) return;

    event.preventDefault();
    event.stopPropagation();

    var widget = state.widgets[id];
    var el = document.getElementById(id);
    if (!widget || !el) return;

    var startX = event.clientX;
    var startY = event.clientY;
    var originX = widget.x;
    var originY = widget.y;
    el.classList.add('moving');

    function onMove(moveEvent) {
      var nextX = normalizeToGrid(originX + (moveEvent.clientX - startX), originX);
      var nextY = normalizeToGrid(originY + (moveEvent.clientY - startY), originY);
      var safe = findSafePlacement(id, nextX, nextY, widget.size, false);
      widget.x = safe.x;
      widget.y = safe.y;
      el.style.left = safe.x + 'px';
      el.style.top = safe.y + 'px';
    }

    function onUp() {
      el.classList.remove('moving');
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      normalizeWidgetOrders(false);
      if (widget.isPersisted) {
        persistWidget(widget, false);
      }
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  function findSafePlacement(id, requestedX, requestedY, sizeKey, allowRelocate) {
    var size = getSize({ provider: 'spotify', size: sizeKey });
    var rect = {
      x: normalizeToGrid(requestedX, 28),
      y: normalizeToGrid(requestedY, 28),
      w: widthForSize(size),
      h: size.h
    };

    rect.x = clampValue(rect.x, 0, ARENA_W - rect.w);
    rect.y = clampValue(rect.y, 0, ARENA_H - rect.h);

    if (!wouldOverlap(id, rect)) {
      return { x: rect.x, y: rect.y };
    }

    if (!allowRelocate) {
      var current = state.widgets[id];
      return { x: current.x, y: current.y };
    }

    return findFreePos(sizeKey, id);
  }

  function findFreePos(sizeKey, ignoreId) {
    var size = getSize({ provider: 'spotify', size: sizeKey });
    var width = widthForSize(size);
    var height = size.h;

    for (var y = 28; y <= ARENA_H - height; y += SNAP) {
      for (var x = 28; x <= ARENA_W - width; x += SNAP) {
        var candidate = { x: x, y: y, w: width, h: height };
        if (!wouldOverlap(ignoreId, candidate)) {
          return { x: x, y: y };
        }
      }
    }

    return { x: 28, y: 28 };
  }

  function wouldOverlap(id, candidate) {
    return Object.keys(state.widgets).some(function (otherId) {
      if (otherId === id) return false;

      var other = state.widgets[otherId];
      if (!other) return false;

      var otherRect = widgetRect(other);
      return overlaps(candidate, otherRect);
    });
  }

  function widgetRect(widget) {
    if (widget.state === 'setup') {
      return {
        x: widget.x,
        y: widget.y,
        w: COL1,
        h: 200
      };
    }

    if (widget.state !== 'active') {
      return {
        x: widget.x,
        y: widget.y,
        w: COL1,
        h: 160
      };
    }

    var size = getSize(widget);
    return {
      x: widget.x,
      y: widget.y,
      w: widthForSize(size),
      h: size.h
    };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y;
  }

  function nextWidgetOrder() {
    return Object.keys(state.widgets).length;
  }

  function widthForSize(size) {
    return size.cols === 2 ? COL2 : COL1;
  }

  function getSize(widget) {
    var provider = PROVIDERS[widget.provider || 'spotify'];
    var found = provider.sizes.find(function (size) {
      return size.key === widget.size;
    });
    return found || provider.sizes[0];
  }

  function resolveSizeKey(providerKey, sizeKey) {
    var provider = PROVIDERS[providerKey || 'spotify'];
    var exists = provider.sizes.some(function (size) { return size.key === sizeKey; });
    return exists ? sizeKey : provider.defaultSize;
  }

  function normalizeToGrid(value, fallback) {
    if (!isFinite(value)) return fallback;
    return Math.round(Number(value) / SNAP) * SNAP;
  }

  function clampValue(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function setSaveState(kind, label) {
    $saveStatus.removeClass('is-saving is-saved is-error');
    $savePulse.removeClass('is-saving is-saved is-error');

    if (kind === 'saving') {
      $saveStatus.addClass('is-saving');
      $savePulse.addClass('is-saving');
    } else if (kind === 'saved') {
      $saveStatus.addClass('is-saved');
      $savePulse.addClass('is-saved');
    } else if (kind === 'error') {
      $saveStatus.addClass('is-error');
      $savePulse.addClass('is-error');
    }

    if (label) {
      $saveStatus.text(label);
      $savePulse.text(label);
    }
  }

  function showToast(message, type) {
    $toast.removeClass('toast--success toast--error is-visible');
    if (type === 'success') $toast.addClass('toast--success');
    if (type === 'error') $toast.addClass('toast--error');
    $toast.text(message).addClass('is-visible');

    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(function () {
      $toast.removeClass('is-visible');
    }, 3000);
  }

  function spotifyGlyph() {
    return '<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path fill="currentColor" d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"></path></svg>';
  }

  function gripIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="6" r="1.5" fill="currentColor"></circle><circle cx="15" cy="6" r="1.5" fill="currentColor"></circle><circle cx="9" cy="12" r="1.5" fill="currentColor"></circle><circle cx="15" cy="12" r="1.5" fill="currentColor"></circle><circle cx="9" cy="18" r="1.5" fill="currentColor"></circle><circle cx="15" cy="18" r="1.5" fill="currentColor"></circle></svg>';
  }

  function trashIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path></svg>';
  }

  function pencilIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>';
  }

  function moonIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
  }

  function closeIcon() {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
  }

  // ── WhatsApp smart-link (works on editor + public profile) ──────────
  // Mobile  → whatsapp:// deep-link (opens app); fallback wa.me after 1.5s
  // Desktop → WhatsApp Web in new tab (Chrome/Edge show "Open Desktop App?" banner)
  window.openWaLink = function (event, phone) {
    event.preventDefault();
    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = 'whatsapp://send?phone=' + phone;
      setTimeout(function () {
        // Only fires if app is NOT installed — app intercepts navigation and this tab goes background
        window.location.href = 'https://wa.me/' + phone;
      }, 1500);
    } else {
      window.open('https://web.whatsapp.com/send?phone=' + phone, '_blank', 'noopener');
    }
  };

  // Quando o browser restaura a página do bfcache (F5, botão voltar)
  // o JS não re-executa — reseta o estado visual para evitar mensagens presas
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      setSaveState('saved', 'Salvo');
    }
  });

  window.editorWidget = {
    toSetup: toSetup,
    toEmpty: toEmpty,
    toActive: toActive,
    openToolbar: openToolbar,
    closeToolbar: closeToolbar,
    resize: resizeWidget,
    toggleTheme: toggleTheme,
    remove: removeWidget,
    initMove: initMove
  };

  init();
})();
