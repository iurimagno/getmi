/**
 * getmi.ai — auth.js
 * Firebase Auth + Firestore via SDK compat (v9 compat layer)
 * Carregado como módulo após os scripts do Firebase Compat.
 */

/* ─── MAPEAMENTO DE ERROS FIREBASE → PT-BR ────────────────────────────── */
const ERROR_MESSAGES = {
  'auth/email-already-in-use':   'Este e-mail já está cadastrado.',
  'auth/invalid-email':          'E-mail inválido.',
  'auth/user-not-found':         'E-mail ou senha incorretos.',
  'auth/wrong-password':         'E-mail ou senha incorretos.',
  'auth/invalid-credential':     'E-mail ou senha incorretos.',
  'auth/weak-password':          'A senha precisa ter no mínimo 6 caracteres.',
  'auth/too-many-requests':      'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
  'auth/popup-closed-by-user':   'Login cancelado.',
  'auth/popup-blocked':          'O popup foi bloqueado. Permita popups para este site.',
  'auth/account-exists-with-different-credential':
                                 'Já existe uma conta com este e-mail usando outro método de login.',
};

function friendlyError(code) {
  return ERROR_MESSAGES[code] || 'Algo deu errado. Tente novamente.';
}

/* ─── VALIDAÇÃO DE USERNAME ───────────────────────────────────────────── */
const USERNAME_REGEX = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$|^[a-z0-9]{3}$/;
const USERNAME_RESERVED = ['admin', 'login', 'register', 'api', 'app', 'getmi', 'www', 'mail', 'support'];

function validateUsername(value) {
  if (!value || value.length < 3)  return 'Username deve ter pelo menos 3 caracteres.';
  if (value.length > 30)           return 'Username deve ter no máximo 30 caracteres.';
  if (!USERNAME_REGEX.test(value)) return 'Apenas letras minúsculas, números e hífens. Não pode começar ou terminar com hífen.';
  if (USERNAME_RESERVED.includes(value)) return 'Este username é reservado.';
  return null;
}

/* ─── INIT ────────────────────────────────────────────────────────────── */
$(function () {
  const auth      = firebase.auth();
  const db        = firebase.firestore();
  const provider  = new firebase.auth.GoogleAuthProvider();

  /* ── Redireciona se já logado ────────────────────────────────────────── */
  auth.onAuthStateChanged(function (user) {
    if (user) {
      window.location.replace('/admin/');
    }
  });

  /* ── Tabs ────────────────────────────────────────────────────────────── */
  $('.auth-tab').on('click', function () {
    var target = $(this).data('tab');
    $('.auth-tab').removeClass('is-active');
    $(this).addClass('is-active');
    $('.auth-form').removeClass('is-visible');
    $('#form-' + target).addClass('is-visible');
    clearAlerts();
  });

  /* ── Helpers UI ──────────────────────────────────────────────────────── */
  function showAlert(formId, message, type) {
    var $alert = $('#' + formId + ' .auth-alert');
    $alert
      .removeClass('auth-alert--error auth-alert--success')
      .addClass(type === 'error' ? 'auth-alert--error' : 'auth-alert--success')
      .text(message)
      .addClass('is-visible');
  }

  function clearAlerts() {
    $('.auth-alert').removeClass('is-visible').text('');
  }

  function setLoading($btn, loading) {
    if (loading) {
      $btn.prop('disabled', true).data('original-text', $btn.html());
      $btn.html('<span class="spinner"></span> Aguarde...');
    } else {
      $btn.prop('disabled', false).html($btn.data('original-text') || $btn.html());
    }
  }

  /* ── Verificar disponibilidade de username (debounced) ───────────────── */
  var usernameTimer = null;

  $('#reg-username').on('input', function () {
    var val = $(this).val().trim().toLowerCase();
    var $status = $('#username-status');
    var $error  = $('#reg-username-error');

    $(this).val(val); // força lowercase

    clearTimeout(usernameTimer);
    $status.text('').removeClass('is-checking is-available is-taken');
    $error.removeClass('is-visible').text('');

    var validationError = validateUsername(val);
    if (validationError) {
      $error.text(validationError).addClass('is-visible');
      return;
    }

    $status.text('verificando...').addClass('is-checking');

    usernameTimer = setTimeout(function () {
      db.collection('usernames').doc(val).get()
        .then(function (doc) {
          $status.removeClass('is-checking');
          if (doc.exists) {
            $status.text('indisponível').addClass('is-taken');
            $error.text('Este username já está em uso.').addClass('is-visible');
          } else {
            $status.text('disponível ✓').addClass('is-available');
          }
        })
        .catch(function () {
          $status.text('').removeClass('is-checking');
        });
    }, 500);
  });

  /* ── LOGIN — Email/Password ──────────────────────────────────────────── */
  $('#form-login').on('submit', function (e) {
    e.preventDefault();
    clearAlerts();

    var email    = $('#login-email').val().trim();
    var password = $('#login-password').val();
    var $btn     = $(this).find('.btn-auth');

    if (!email || !password) {
      showAlert('form-login', 'Preencha todos os campos.', 'error');
      return;
    }

    setLoading($btn, true);

    auth.signInWithEmailAndPassword(email, password)
      .catch(function (err) {
        setLoading($btn, false);
        showAlert('form-login', friendlyError(err.code), 'error');
      });
  });

  /* ── LOGIN — Google ──────────────────────────────────────────────────── */
  $('#btn-google-login').on('click', function () {
    clearAlerts();
    var $btn = $(this);
    setLoading($btn, true);

    auth.signInWithPopup(provider)
      .then(function (result) {
        var user = result.user;
        /* Se é primeiro login Google, garante doc em users/ */
        return db.collection('users').doc(user.uid).get()
          .then(function (doc) {
            if (!doc.exists) {
              return db.collection('users').doc(user.uid).set({
                uid:         user.uid,
                name:        user.displayName || '',
                email:       user.email,
                photoURL:    user.photoURL || '',
                username:    null,
                plan:        'free',
                createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
              });
            }
          });
      })
      .catch(function (err) {
        setLoading($btn, false);
        showAlert('form-login', friendlyError(err.code), 'error');
      });
  });

  /* ── REGISTRO — Email/Password ───────────────────────────────────────── */
  $('#form-register').on('submit', function (e) {
    e.preventDefault();
    clearAlerts();

    var name     = $('#reg-name').val().trim();
    var email    = $('#reg-email').val().trim();
    var password = $('#reg-password').val();
    var username = $('#reg-username').val().trim().toLowerCase();
    var $btn     = $(this).find('.btn-auth');

    /* Validações client-side */
    if (!name || !email || !password || !username) {
      showAlert('form-register', 'Preencha todos os campos.', 'error');
      return;
    }

    var usernameError = validateUsername(username);
    if (usernameError) {
      showAlert('form-register', usernameError, 'error');
      return;
    }

    if (password.length < 6) {
      showAlert('form-register', 'A senha precisa ter no mínimo 6 caracteres.', 'error');
      return;
    }

    /* Verifica se username já está em uso antes de criar conta */
    setLoading($btn, true);

    db.collection('usernames').doc(username).get()
      .then(function (usernameDoc) {
        if (usernameDoc.exists) {
          setLoading($btn, false);
          showAlert('form-register', 'Este username já está em uso.', 'error');
          return;
        }

        /* Cria usuário no Firebase Auth */
        return auth.createUserWithEmailAndPassword(email, password)
          .then(function (cred) {
            var uid  = cred.user.uid;
            var now  = firebase.firestore.FieldValue.serverTimestamp();

            /* Batch: users/{uid} + usernames/{username} — atômico */
            var batch = db.batch();

            batch.set(db.collection('users').doc(uid), {
              uid:       uid,
              name:      name,
              email:     email,
              photoURL:  '',
              username:  username,
              plan:      'free',
              createdAt: now,
            });

            batch.set(db.collection('usernames').doc(username), {
              uid:       uid,
              createdAt: now,
            });

            return batch.commit()
              .then(function () {
                /* Atualiza displayName no Auth */
                return cred.user.updateProfile({ displayName: name });
              });
          });
      })
      .catch(function (err) {
        setLoading($btn, false);
        showAlert('form-register', friendlyError(err.code), 'error');
      });
  });

  /* ── REGISTRO — Google ───────────────────────────────────────────────── */
  $('#btn-google-register').on('click', function () {
    clearAlerts();
    var $btn = $(this);
    setLoading($btn, true);

    auth.signInWithPopup(provider)
      .then(function (result) {
        var user = result.user;
        return db.collection('users').doc(user.uid).get()
          .then(function (doc) {
            if (!doc.exists) {
              /* Novo usuário via Google: salva perfil sem username
                 (usuário vai definir o username em /admin/onboarding) */
              return db.collection('users').doc(user.uid).set({
                uid:       user.uid,
                name:      user.displayName || '',
                email:     user.email,
                photoURL:  user.photoURL || '',
                username:  null,
                plan:      'free',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              });
            }
          });
      })
      .catch(function (err) {
        setLoading($btn, false);
        showAlert('form-register', friendlyError(err.code), 'error');
      });
  });

});
