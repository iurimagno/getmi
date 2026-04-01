/**
 * getmi.ai — widget-config-modal.js
 * Gera modal Bootstrap 4 dinamicamente a partir do configSchema de um template.
 * Salva/atualiza widget_instances no Firestore.
 *
 * Dependências: jQuery, Bootstrap 4, firebase.auth(), firebase.firestore()
 */

(function (global) {
  'use strict';

  var MODAL_ID = 'wgtConfigModal';
  var currentTemplate  = null;
  var currentInstance  = null;   // null = nova, object = edição
  var onSaveCallback   = null;

  /**
   * Abre o modal de configuração para um template.
   * @param {Object}   template   Documento widget_template completo
   * @param {Object}   [instance] Instância existente (para edição)
   * @param {Function} [onSave]   Callback chamado após salvar com sucesso
   */
  function open(template, instance, onSave) {
    currentTemplate = template;
    currentInstance = instance || null;
    onSaveCallback  = onSave  || null;

    buildModal(template, instance);
    $('#' + MODAL_ID).modal('show');
  }

  /* ─── BUILD MODAL HTML ───────────────────────────────────────────────── */
  function buildModal(tpl, inst) {
    $('#' + MODAL_ID).remove();  // limpa modal anterior

    var config = (inst && inst.config) ? inst.config : {};
    var fields  = buildFields(tpl.configSchema || [], config);

    var $modal = $([
      '<div class="modal fade" id="' + MODAL_ID + '" tabindex="-1"',
      '     aria-labelledby="' + MODAL_ID + 'Label" aria-hidden="true">',
      '  <div class="modal-dialog modal-dialog-centered">',
      '    <div class="modal-content gm-modal">',
      '      <div class="modal-header gm-modal__header">',
      '        <h5 class="modal-title" id="' + MODAL_ID + 'Label">',
      '          Configurar: ' + escHtml(tpl.name || 'Widget'),
      '        </h5>',
      '        <button type="button" class="gm-modal__close"',
      '                data-dismiss="modal" aria-label="Fechar">&times;</button>',
      '      </div>',
      '      <form id="wgtConfigForm" novalidate>',
      '        <div class="modal-body gm-modal__body">',
      '          <p class="wgt-modal-desc">' + escHtml(tpl.description || '') + '</p>',
      fields,
      '          <div class="form-group-app wgt-config-size-group">',
      '            <label class="form-label-app">Tamanho</label>',
      buildSizeOptions(tpl.sizes || ['2x1'], inst && inst.size ? inst.size : tpl.defaultSize),
      '          </div>',
      '        </div>',
      '        <div class="modal-footer gm-modal__footer">',
      '          <button type="button" class="btn-secondary-app"',
      '                  data-dismiss="modal">Cancelar</button>',
      '          <button type="submit" class="btn-primary-app" id="btnSaveWidget">',
      '            Salvar Widget',
      '          </button>',
      '        </div>',
      '      </form>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join('\n'));

    $('body').append($modal);

    // Submit
    $('#wgtConfigForm').on('submit', function (e) {
      e.preventDefault();
      saveInstance();
    });
  }

  /* ─── BUILD FIELDS ───────────────────────────────────────────────────── */
  function buildFields(schema, config) {
    if (!schema.length) return '<p class="wgt-modal-desc" style="color:var(--navy-30)">Este widget não tem campos configuráveis.</p>';

    return schema.map(function (field) {
      var val  = config[field.key] !== undefined ? config[field.key] : (field.default !== undefined ? field.default : '');
      var req  = field.required ? ' required' : '';
      var ph   = field.placeholder ? ' placeholder="' + escHtml(field.placeholder) + '"' : '';
      var id   = 'wgtField_' + field.key;
      var label = '<label class="form-label-app" for="' + id + '">' +
                  escHtml(field.label || field.key) +
                  (field.required ? ' <span style="color:var(--coral)">*</span>' : '') +
                  '</label>';
      var input = '';

      switch (field.type) {
        case 'textarea':
          input = '<textarea class="form-control-app" id="' + id + '" name="' + field.key + '"' +
                  ph + req + ' rows="3">' + escHtml(val) + '</textarea>';
          break;
        case 'toggle':
          var checked = (val === true || val === 'true') ? ' checked' : '';
          input = '<div class="wgt-toggle-inline">' +
                  '<label class="wgt-toggle">' +
                  '<input type="checkbox" id="' + id + '" name="' + field.key + '"' + checked + '>' +
                  '<span class="wgt-toggle__slider"></span>' +
                  '</label>' +
                  '</div>';
          break;
        case 'number':
          input = '<input class="form-control-app" type="number" id="' + id + '" name="' + field.key + '"' +
                  ' value="' + escHtml(val) + '"' + ph + req + '>';
          break;
        case 'color':
          input = '<input class="form-control-app" type="color" id="' + id + '" name="' + field.key + '"' +
                  ' value="' + escHtml(val || '#000000') + '"' + req + '>';
          break;
        case 'select':
          var opts = (field.options || []).map(function (o) {
            return '<option value="' + escHtml(o) + '"' + (o === val ? ' selected' : '') + '>' + escHtml(o) + '</option>';
          }).join('');
          input = '<select class="form-control-app" id="' + id + '" name="' + field.key + '"' + req + '>' + opts + '</select>';
          break;
        default: // text, url, image
          var type = (field.type === 'url' || field.type === 'image') ? 'url' : 'text';
          input = '<input class="form-control-app" type="' + type + '" id="' + id + '"' +
                  ' name="' + field.key + '" value="' + escHtml(val) + '"' + ph + req + '>';
      }

      return '<div class="form-group-app">' + label + input + '</div>';
    }).join('');
  }

  /* ─── SIZE OPTIONS ───────────────────────────────────────────────────── */
  function buildSizeOptions(sizes, selected) {
    return '<div class="wgt-size-pills">' +
      sizes.map(function (s) {
        var chk = s === selected ? ' checked' : '';
        return '<label class="wgt-size-pill-opt">' +
               '<input type="radio" name="wgtSize" value="' + s + '"' + chk + '> ' + s +
               '</label>';
      }).join('') +
    '</div>';
  }

  /* ─── SAVE INSTANCE ──────────────────────────────────────────────────── */
  function saveInstance() {
    var user = firebase.auth().currentUser;
    if (!user) { alert('Você precisa estar logado.'); return; }

    var config = {};
    var schema  = currentTemplate.configSchema || [];

    schema.forEach(function (field) {
      var $el = $('#wgtField_' + field.key);
      if (field.type === 'toggle') {
        config[field.key] = $el.prop('checked');
      } else if (field.type === 'number') {
        config[field.key] = parseFloat($el.val()) || 0;
      } else {
        config[field.key] = $el.val();
      }
    });

    var size = $('input[name="wgtSize"]:checked').val() || currentTemplate.defaultSize || '2x1';

    var data = {
      templateId: currentTemplate.id || currentTemplate.type,
      userId:     user.uid,
      config:     config,
      size:       size,
      active:     true,
    };

    var db = firebase.firestore();
    var promise;

    if (currentInstance && currentInstance.id) {
      promise = db.collection('widget_instances').doc(currentInstance.id)
        .update({ config: config, size: size });
    } else {
      data.order     = Date.now();
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      promise        = db.collection('widget_instances').add(data);
    }

    $('#btnSaveWidget').prop('disabled', true).text('Salvando…');

    promise
      .then(function (ref) {
        $('#' + MODAL_ID).modal('hide');
        if (typeof onSaveCallback === 'function') {
          onSaveCallback(ref ? Object.assign({ id: ref.id }, data) : currentInstance);
        }
      })
      .catch(function (err) {
        console.error('Erro ao salvar instância:', err);
        alert('Erro ao salvar: ' + err.message);
        $('#btnSaveWidget').prop('disabled', false).text('Salvar Widget');
      });
  }

  /* ─── HELPERS ────────────────────────────────────────────────────────── */
  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Public API ──────────────────────────────────────────────────── */
  global.WidgetConfigModal = { open: open };

})(window);
