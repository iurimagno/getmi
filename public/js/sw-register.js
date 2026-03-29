/**
 * getmi.ai — sw-register.js
 * Registra o Service Worker. Incluído em todas as páginas.
 */
(function () {
  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function (reg) {
        /* Força update se há novo SW esperando */
        reg.addEventListener('updatefound', function () {
          var newWorker = reg.installing;
          newWorker.addEventListener('statechange', function () {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              /* Notifica o usuário que há atualização disponível (opcional) */
              console.info('[getmi SW] Nova versão disponível. Recarregue para atualizar.');
            }
          });
        });
      })
      .catch(function (err) {
        console.warn('[getmi SW] Registro falhou:', err);
      });
  });
})();
