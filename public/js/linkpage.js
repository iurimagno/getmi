/**
 * getmi.ai — linkpage.js
 * Renderiza a página pública de um criador em p.html
 * URL: getmi.ai/@username (rewrite firebase.json /@** → /p.html)
 */

(function () {
  'use strict';

  /* ─── FIREBASE ─────────────────────────────────────────────────────────── */
  firebase.initializeApp(firebaseConfig);
  var db = firebase.firestore();

  /* ─── EXTRACT USERNAME ─────────────────────────────────────────────────── */
  var rawPath  = window.location.pathname; // /@username  or  /@username/
  var username = rawPath.replace(/^\/@/, '').replace(/\/$/, '').toLowerCase();

  if (!username) {
    showError('404');
    return;
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
        db.collection('users').doc(uid).get(),
        db.collection('users').doc(uid).collection('links')
          .where('active', '==', true)
          .orderBy('order')
          .get(),
      ]).then(function (results) {
        var userDoc  = results[0];
        var linksSnap = results[1];

        if (!userDoc.exists) {
          showError('404');
          return;
        }

        var profile = userDoc.data();
        var links   = [];
        linksSnap.forEach(function (doc) {
          links.push(Object.assign({ id: doc.id }, doc.data()));
        });

        applyTheme(profile.theme || {});
        renderProfile(profile);
        renderLinks(links, uid);
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
    if (profile.photoURL) {
      $avatar.src = profile.photoURL;
      $avatar.alt = profile.name || username;
    } else {
      $avatar.src = '/img/avatar-placeholder.png';
      $avatar.alt = profile.name || username;
    }

    /* Name */
    document.getElementById('lpName').textContent =
      profile.name || '@' + username;

    /* Username handle */
    document.getElementById('lpHandle').textContent = '@' + username;

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
      var msg   = encodeURIComponent(link.whatsappMessage || 'Olá, vim pelo getmi.ai!');
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
    var name = profile.name || ('@' + username);
    var bio  = profile.bio  || (name + ' no getmi.ai');

    document.title = name + ' | getmi.ai';

    setMeta('name',      'description',    bio);
    setMeta('property',  'og:title',       name + ' | getmi.ai');
    setMeta('property',  'og:description', bio);
    setMeta('property',  'og:url',         window.location.href);
    setMeta('name',      'twitter:title',  name + ' | getmi.ai');
    setMeta('name',      'twitter:description', bio);

    if (profile.photoURL) {
      setMeta('property', 'og:image',     profile.photoURL);
      setMeta('name',     'twitter:image', profile.photoURL);
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
        'O usuário @' + username + ' não existe ou desativou sua página.';
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

})();
