/**
 * getmi.ai — linkpage.js
 * Renderiza a página pública de um criador em p.html
 * URL: getmi.ai/slug (mantém compatibilidade com /@slug)
 */

(function () {
  'use strict';

  /* ─── FIREBASE ─────────────────────────────────────────────────────────── */
  firebase.initializeApp(firebaseConfig);
  var db = firebase.firestore();
  var PROVIDERS = {
    spotify: {
      sizes: {
        compact: 80,
        standard: 152,
        wide: 152,
        tall: 352,
        large: 352
      }
    }
  };

  /* ─── EXTRACT USERNAME ─────────────────────────────────────────────────── */
  var rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
  var pathParts = rawPath ? rawPath.split('/').filter(Boolean) : [];
  var username = pathParts.length === 1 ? pathParts[0].replace(/^@/, '').toLowerCase() : '';

  if (!username) {
    showError('404');
    return;
  }

  if (window.location.pathname !== '/' + username) {
    window.history.replaceState({}, '', '/' + username + window.location.search + window.location.hash);
  }

  /* ─── FETCH & RENDER ───────────────────────────────────────────────────── */
  db.collection('usernames').doc(username).get()
    .then(function (usernameDoc) {
      if (!usernameDoc.exists) {
        showError('404');
        return;
      }

      var uid = usernameDoc.data().uid;

      return Promise.all([
        db.collection('publicProfiles').doc(uid).get(),
        db.collection('users').doc(uid).collection('widgets')
          .orderBy('order')
          .get(),
        db.collection('users').doc(uid).collection('links')
          .where('active', '==', true)
          .orderBy('order')
          .get(),
      ]).then(function (results) {
        var profileDoc = results[0];
        var widgetsSnap = results[1];
        var linksSnap = results[2];

        if (!profileDoc.exists) {
          showError('404');
          return;
        }

        var profile = profileDoc.data();
        var widgets = [];
        var links   = [];

        widgetsSnap.forEach(function (doc) {
          widgets.push(Object.assign({ id: doc.id }, doc.data()));
        });

        linksSnap.forEach(function (doc) {
          links.push(Object.assign({ id: doc.id }, doc.data()));
        });

        applyTheme(profile.theme || {});
        renderProfile(profile);
        renderContent(widgets, links, uid);
        setMetaTags(profile);
        hideLoading();
      });
    })
    .catch(function (err) {
      console.error('Erro ao carregar página:', err);
      showError('generic');
    });

  /* ─── APPLY THEME ──────────────────────────────────────────────────────── */
  function applyTheme(theme) {
    var root = document.documentElement;
    root.style.setProperty('--lp-bg',    theme.bg    || '#FAFAF8');
    root.style.setProperty('--lp-text',  theme.text  || '#1A1F36');
    root.style.setProperty('--lp-btn',   theme.btn   || '#1A1F36');

    var radiusMap = { rounded: '8px', pill: '999px', square: '2px' };
    root.style.setProperty(
      '--lp-btn-radius',
      radiusMap[theme.style] || '8px'
    );

    /* Auto-contrast for button text */
    root.style.setProperty('--lp-btn-text', getContrastColor(theme.btn || '#1A1F36'));
  }

  /* ─── RENDER PROFILE ───────────────────────────────────────────────────── */
  function renderProfile(profile) {
    /* Avatar */
    var $avatar = document.getElementById('lpAvatar');
    var avatar = profile.avatarUrl || profile.photoURL;
    var displayName = profile.displayName || profile.name;

    if (avatar) {
      $avatar.src = avatar;
      $avatar.alt = displayName || username;
    } else {
      $avatar.src = '/img/avatar-placeholder.png';
      $avatar.alt = displayName || username;
    }

    /* Name */
    document.getElementById('lpName').textContent =
      displayName || username;

    /* Public slug */
    document.getElementById('lpHandle').textContent = getPublicProfileLabel(username);

    /* Bio */
    var bioEl = document.getElementById('lpBio');
    if (profile.bio) {
      bioEl.textContent = profile.bio;
      bioEl.style.display = 'block';
    } else {
      bioEl.style.display = 'none';
    }

    /* Pro: hide footer */
    if (profile.plan === 'pro' || profile.plan === 'business') {
      var footer = document.getElementById('lpFooter');
      if (footer) footer.style.display = 'none';
    }
  }

  function renderContent(widgets, links, uid) {
    if (widgets && widgets.length) {
      renderWidgets(widgets);
      return;
    }

    renderLinks(links, uid);
  }

  function renderWidgets(widgets) {
    var $container = document.getElementById('lpLinks');
    $container.innerHTML = '';

    widgets.forEach(function (widget) {
      var el = buildWidgetEl(widget);
      $container.appendChild(el);
    });
  }

  function buildWidgetEl(widget) {
    var wrap = document.createElement('div');
    wrap.className = 'lp-widget';

    var provider = PROVIDERS[widget.provider || 'spotify'];
    var theme = widget.theme === 'dark' ? '&theme=0' : '';
    var size = widget.size || 'standard';
    var height = provider && provider.sizes[size] ? provider.sizes[size] : 152;
    var src = 'https://open.spotify.com/embed/' + widget.contentType + '/' + widget.contentId + '?utm_source=getmi-public' + theme;

    wrap.innerHTML = '<iframe src="' + src + '" style="height:' + height + 'px" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>';
    return wrap;
  }

  /* ─── RENDER LINKS ─────────────────────────────────────────────────────── */
  function renderLinks(links, uid) {
    var $container = document.getElementById('lpLinks');
    $container.innerHTML = '';

    if (!links.length) {
      var empty = document.createElement('p');
      empty.className = 'lp-empty';
      empty.textContent = 'Nenhum link publicado ainda.';
      $container.appendChild(empty);
      return;
    }

    links.forEach(function (link) {
      var el = buildLinkEl(link, uid);
      $container.appendChild(el);
    });
  }

  function buildLinkEl(link, uid) {
    var a = document.createElement('a');
    var type = link.type || 'secondary';

    /* WhatsApp: deep link */
    if (type === 'whatsapp') {
      var phone = link.url.replace(/\D/g, '');
      var msg   = encodeURIComponent(link.whatsappMessage || 'Olá, vim pelo getmi.app!');
      a.href = 'https://wa.me/' + phone + '?text=' + msg;
    } else {
      a.href = link.url || '#';
    }

    a.target = '_blank';
    a.rel    = 'noopener noreferrer';
    a.className = 'lp-link-btn lp-link-btn--' + type;
    a.setAttribute('data-link-id', link.id);
    a.setAttribute('data-uid', uid);

    if (link.icon) {
      var iconSpan = document.createElement('span');
      iconSpan.className = 'lp-link-icon';
      iconSpan.textContent = link.icon;
      a.appendChild(iconSpan);
    }

    var titleSpan = document.createElement('span');
    titleSpan.textContent = link.title || '';
    a.appendChild(titleSpan);

    a.addEventListener('click', function (e) {
      trackClick(e, link, uid);
    });

    return a;
  }

  /* ─── TRACK CLICK ──────────────────────────────────────────────────────── */
  function trackClick(e, link, uid) {
    /* Don't block navigation — fire & forget */
    var batch = db.batch();

    var clickRef = db
      .collection('users').doc(uid)
      .collection('links').doc(link.id)
      .collection('clicks').doc();

    batch.set(clickRef, {
      linkId:    link.id,
      uid:       uid,
      timestamp: firebase.firestore.FieldValue.serverTimestamp(),
      referrer:  document.referrer || null,
      userAgent: navigator.userAgent,
    });

    batch.update(
      db.collection('users').doc(uid).collection('links').doc(link.id),
      { clicks: firebase.firestore.FieldValue.increment(1) }
    );

    batch.commit().catch(function (err) {
      console.warn('Erro ao registrar clique:', err);
    });
  }

  /* ─── META TAGS ────────────────────────────────────────────────────────── */
  function setMetaTags(profile) {
    var name = profile.displayName || profile.name || username;
    var bio  = profile.bio  || (name + ' no getmi.app');

    document.title = name + ' | getmi.app';

    setMeta('name',      'description',    bio);
    setMeta('property',  'og:title',       name + ' | getmi.app');
    setMeta('property',  'og:description', bio);
    setMeta('property',  'og:url',         window.location.href);
    setMeta('name',      'twitter:title',  name + ' | getmi.app');
    setMeta('name',      'twitter:description', bio);

    var avatar = profile.avatarUrl || profile.photoURL;
    if (avatar) {
      setMeta('property', 'og:image',     avatar);
      setMeta('name',     'twitter:image', avatar);
    }
  }

  function setMeta(attr, name, content) {
    var el = document.querySelector('meta[' + attr + '="' + name + '"]');
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  /* ─── ERROR STATES ─────────────────────────────────────────────────────── */
  function showError(type) {
    hideLoading();
    document.getElementById('lpLoading').style.display  = 'none';
    document.getElementById('lpProfile').style.display  = 'none';

    var $err = document.getElementById('lpError');
    $err.style.display = 'block';

    if (type === '404') {
      document.getElementById('lpErrorTitle').textContent = 'Página não encontrada';
      document.getElementById('lpErrorDesc').textContent  =
        'O link getmi.app/' + username + ' não existe ou desativou sua página.';
    } else {
      document.getElementById('lpErrorTitle').textContent = 'Algo deu errado';
      document.getElementById('lpErrorDesc').textContent  =
        'Não foi possível carregar esta página. Tente novamente mais tarde.';
    }
  }

  function hideLoading() {
    var loader = document.getElementById('lpLoading');
    if (loader) loader.style.display = 'none';
    var profile = document.getElementById('lpProfile');
    if (profile) profile.style.display = 'block';
  }

  /* ─── HELPERS ──────────────────────────────────────────────────────────── */
  function getContrastColor(hex) {
    var c = (hex || '#000').replace('#', '');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    var r = parseInt(c.substr(0,2),16);
    var g = parseInt(c.substr(2,2),16);
    var b = parseInt(c.substr(4,2),16);
    return (0.299*r + 0.587*g + 0.114*b)/255 > 0.55 ? '#1A1F36' : '#FFFFFF';
  }

  function getPublicProfileUrl(slug) {
    return 'https://getmi.app/' + slug;
  }

  function getPublicProfileLabel(slug) {
    return 'getmi.app/' + slug;
  }

})();
