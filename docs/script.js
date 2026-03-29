(function () {
  'use strict';

  // ── JSON syntax highlighting helpers ──────────────────────

  function jKey(s) { return '<span class="j-key">"' + s + '"</span>'; }
  function jStr(s) { return '<span class="j-string">"' + s + '"</span>'; }
  function jFn(s)  { return '<span class="j-fn">' + s + '</span>'; }
  function jNum(s) { return '<span class="j-number">' + s + '</span>'; }
  function jBr(s)  { return '<span class="j-brace">' + s + '</span>'; }

  function jRef(path) {
    return '<span class="j-string">"{' + path + '}"</span>';
  }

  function jFnCall(name, ref, amount) {
    return jFn(name) + jBr('(') + jRef(ref) + jBr(',') + ' ' + jNum(amount) + jBr(')');
  }

  // ── Indentation helper ────────────────────────────────────

  function r(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += '  ';
    return s;
  }

  // ── Builds the highlighted $value (scalar or {Mode 1, Mode 2}) ──

  function jVal(scalar, m1, m2, multi, depth) {
    if (!multi) return scalar;
    return jBr('{') + '\n' +
      r(depth + 1) + jKey('Mode 1') + jBr(':') + ' ' + m1 + jBr(',') + '\n' +
      r(depth + 1) + jKey('Mode 2') + jBr(':') + ' ' + m2 + '\n' +
      r(depth) + jBr('}');
  }

  // ── Builds one token object block (no trailing newline) ───

  function jToken(opts) {
    var depth     = opts.depth;
    var hasDesc   = opts.showDesc && !!opts.descText;
    var hasScope  = opts.showScope && !!opts.scopeVal;
    var hasOpt    = hasDesc || hasScope;
    var d         = r(depth);
    var di        = r(depth + 1);

    var valStr = jVal(opts.scalar, opts.m1, opts.m2, opts.multi, depth + 1);

    var lines = [
      di + jKey('$type')  + jBr(':') + '  ' + jStr(opts.type) + jBr(','),
      di + jKey('$value') + jBr(':') + ' '  + valStr + (hasOpt ? jBr(',') : '')
    ];

    if (hasDesc) {
      lines.push(di + jKey('$description') + jBr(':') + ' ' + jStr(opts.descText) + (hasScope ? jBr(',') : ''));
    }

    if (hasScope) {
      var sv = Array.isArray(opts.scopeVal)
        ? jBr('[') + opts.scopeVal.map(function (s) { return jStr(s); }).join(jBr(',') + ' ') + jBr(']')
        : jStr(opts.scopeVal);
      lines.push(di + jKey('$scope') + jBr(':') + ' ' + sv);
    }

    return d + jKey(opts.name) + jBr(': {') + '\n' +
      lines.join('\n') + '\n' +
      d + jBr('}') + (opts.isLast ? '' : jBr(','));
  }

  // ── JSON panel renderer ────────────────────────────────────

  function renderJsonPanel(multi, desc, scope) {
    var code = document.getElementById('json-panel');
    if (!code) return;

    // Foundation token — may show $description / $scope
    function ftok(name, type, scalar, m1, m2, descText, scopeVal, isLast) {
      return jToken({ name: name, type: type, scalar: scalar, m1: m1, m2: m2,
        multi: multi, descText: descText, scopeVal: scopeVal,
        showDesc: desc, showScope: scope, depth: 3, isLast: !!isLast });
    }

    // Semantic token — never has $description / $scope
    function stok(name, type, scalar, m1, m2, isLast) {
      return jToken({ name: name, type: type, scalar: scalar, m1: m1, m2: m2,
        multi: multi, showDesc: false, showScope: false, depth: 3, isLast: !!isLast });
    }

    var nl = '\n';
    var html =
      jBr('{') + nl +
      r(1) + jKey('foundation') + jBr(': {') + nl +
      r(2) + jKey('color') + jBr(': {') + nl +
      ftok('primary', 'color',
        jStr('#0066FF'),            jStr('#0066FF'),            jStr('#3388FF'),
        'Primary brand color',      'ALL_FILLS',                false) + nl +
      ftok('surface', 'color',
        jStr('#FFFFFF'),            jStr('#FFFFFF'),            jStr('#1A1A1A'),
        'Page and card background', ['FRAME_FILL', 'SHAPE_FILL'], false) + nl +
      ftok('neutral', 'color',
        jStr('oklch(0.85 0.02 220)'), jStr('oklch(0.85 0.02 220)'), jStr('oklch(0.4 0.02 220)'),
        null,                       null,                       true) + nl +
      r(2) + jBr('},') + nl +
      r(2) + jKey('spacing') + jBr(': {') + nl +
      ftok('base', 'number',
        jNum('8'),                  jNum('8'),                  jNum('8'),
        'Base spacing unit (8px grid)', 'GAP',                  true) + nl +
      r(2) + jBr('}') + nl +
      r(1) + jBr('},') + nl +
      r(1) + jKey('semantic') + jBr(': {') + nl +
      r(2) + jKey('color') + jBr(': {') + nl +
      stok('background',
        'color', jRef('color.surface'),  jRef('color.surface'),  jRef('color.surface'),  false) + nl +
      stok('interactive',
        'color', jRef('color.primary'),  jRef('color.primary'),  jRef('color.primary'),  false) + nl +
      stok('interactiveHover', 'color',
        jFnCall('lighten', 'color.primary', '12%'),
        jFnCall('lighten', 'color.primary', '12%'),
        jFnCall('lighten', 'color.primary', '8%'),  false) + nl +
      stok('interactiveActive', 'color',
        jFnCall('darken',  'color.primary', '15%'),
        jFnCall('darken',  'color.primary', '15%'),
        jFnCall('darken',  'color.primary', '12%'), false) + nl +
      stok('interactiveMuted', 'color',
        jFnCall('alpha',   'color.primary', '18%'),
        jFnCall('alpha',   'color.primary', '18%'),
        jFnCall('alpha',   'color.primary', '12%'), true) + nl +
      r(2) + jBr('},') + nl +
      r(2) + jKey('spacing') + jBr(': {') + nl +
      stok('md', 'number',
        jStr('{spacing.base} * 2'), jStr('{spacing.base} * 2'), jStr('{spacing.base} * 2'), false) + nl +
      stok('lg', 'number',
        jStr('{spacing.base} * 3'), jStr('{spacing.base} * 3'), jStr('{spacing.base} * 3'), true) + nl +
      r(2) + jBr('}') + nl +
      r(1) + jBr('}') + nl +
      jBr('}');

    code.innerHTML = html;
  }

  // ── Variables table renderer ───────────────────────────────

  function swatch(bg) {
    return '<span class="swatch" style="background:' + bg + '"></span>';
  }

  function colorCell(swatchBg, hex) {
    return swatch(swatchBg) + '<span class="vars-hex">' + hex + '</span>';
  }

  function numCell(n) {
    return '<span class="vars-num-val">' + n + '</span>';
  }

  function aliasCell(name, swatchColor) {
    var sw = swatchColor
      ? '<span class="swatch" style="background:' + swatchColor + ';"></span>'
      : '';
    return '<span class="badge border border-primary bg-transparent text-primary font-monospace fw-normal d-inline-flex align-items-center gap-2">' + sw + name + '</span>';
  }

  function renderVarsPanel(multi) {
    var panel = document.getElementById('vars-panel');
    if (!panel) return;

    var cols = multi ? 3 : 2;

    function thead() {
      if (multi) {
        return '<thead><tr><th>Variable</th><th>Mode 1</th><th>Mode 2</th></tr></thead>';
      }
      return '<thead><tr><th>Variable</th><th>Value</th></tr></thead>';
    }

    function groupRow(label) {
      return '<tr><td colspan="' + cols + '" class="vars-group">' + label + '</td></tr>';
    }

    function row(name, v1, v2) {
      var valCells = multi
        ? '<td class="vars-val">' + v1 + '</td><td class="vars-val">' + v2 + '</td>'
        : '<td class="vars-val">' + v1 + '</td>';
      return '<tr><td class="vars-name">' + name + '</td>' + valCells + '</tr>';
    }

    var html = '<div class="vars-table-wrap"><table class="vars-table">' + thead() + '<tbody>';

    html += groupRow('foundation');
    html += row('color/primary',
      colorCell('#0066FF',                       '#0066FF'),
      colorCell('#3388FF',                       '#3388FF'));
    html += row('color/surface',
      colorCell('#FFFFFF',                       '#FFFFFF'),
      colorCell('#1A1A1A',                       '#1A1A1A'));
    html += row('color/neutral',
      colorCell('oklch(0.85 0.02 220)',          '#D6DAE8'),
      colorCell('oklch(0.4 0.02 220)',           '#535769'));
    html += row('spacing/base',   numCell('8'),  numCell('8'));

    html += groupRow('semantic');
    html += row('color/background',
      aliasCell('color.surface', '#FFFFFF'),
      aliasCell('color.surface', '#1A1A1A'));
    html += row('color/interactive',
      aliasCell('color.primary', '#0066FF'),
      aliasCell('color.primary', '#3388FF'));
    html += row('color/interactiveHover',
      // lighten(#0066FF, 12%): L 0.5→0.56
      colorCell('oklch(0.56 0.22 265)',          '#3384FF'),
      // lighten(#3388FF, 8%): L 0.62→0.65
      colorCell('oklch(0.65 0.2 265)',           '#5599FF'));
    html += row('color/interactiveActive',
      // darken(#0066FF, 15%): L 0.5→0.425
      colorCell('oklch(0.425 0.22 265)',         '#0050CC'),
      // darken(#3388FF, 12%): L 0.62→0.546
      colorCell('oklch(0.546 0.2 265)',          '#1E65EE'));
    html += row('color/interactiveMuted',
      colorCell('rgba(0,102,255,0.18)',          'rgba(0, 102, 255, 0.18)'),
      colorCell('rgba(51,136,255,0.12)',         'rgba(51, 136, 255, 0.12)'));
    html += row('spacing/md',     numCell('16'), numCell('16'));
    html += row('spacing/lg',     numCell('24'), numCell('24'));

    html += '</tbody></table></div>';
    panel.innerHTML = html;
  }

  // ── Toggle init ───────────────────────────────────────────

  function initExampleToggles() {
    var modesToggle = document.getElementById('toggle-modes');
    var descToggle  = document.getElementById('toggle-desc');
    var scopeToggle = document.getElementById('toggle-scope');
    if (!modesToggle || !descToggle || !scopeToggle) return;

    function update() {
      var multi = modesToggle.checked;
      renderJsonPanel(multi, descToggle.checked, scopeToggle.checked);
      renderVarsPanel(multi);
    }

    modesToggle.addEventListener('change', update);
    descToggle.addEventListener('change', update);
    scopeToggle.addEventListener('change', update);
    update();
  }

  // ── Scroll Spy ────────────────────────────────────────────

  function initScrollSpy() {
    var navLinks = document.querySelectorAll('.sidebar-nav a[href^="#"]');
    if (!navLinks.length) return;

    navLinks[0].addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    var sectionIds = Array.from(navLinks).map(function (a) {
      return a.getAttribute('href').slice(1);
    });

    var sections = sectionIds.map(function (id) {
      return document.getElementById(id);
    }).filter(Boolean);

    function updateActive() {
      var offset = 100;
      var current = sections[0];

      sections.forEach(function (el) {
        var top = el.getBoundingClientRect().top + window.scrollY;
        if (top - offset <= window.scrollY) {
          current = el;
        }
      });

      navLinks.forEach(function (a) {
        a.classList.toggle('active', a.getAttribute('href') === '#' + current.id);
      });
    }

    window.addEventListener('scroll', updateActive, { passive: true });
    updateActive();
  }

  // ── Init ──────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    initExampleToggles();
    initScrollSpy();
  });

})();
