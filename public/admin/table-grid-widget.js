/*
 * Віджет-сітка для табличних блоків у Decap CMS (crpp1-l0).
 *
 * Замінює стандартний list-редактор для поля entries блоку «Таблиця»:
 * замість стосу розгорнутих форм — справжня сітка з шапкою, редагування
 * прямо в комірках, пошук, дублювання, переставляння та видалення рядків.
 *
 * Формат даних НЕ змінюється: значення — той самий масив об'єктів entries
 * (institution, person, role, phone, email, consultant, note), що і раніше.
 * Сторінковий рендерер (components/page-blocks.tsx) продовжує працювати без змін.
 *
 * Технічно: повноцінний React-компонент (createClass з бандла Decap).
 * React сам зберігає фокус під час введення — жодних прямих маніпуляцій з DOM.
 * Immutable-структури будуються з наявного value (List.push/set/delete/insert),
 * а для порожньої таблиці — з entry як джерела конструктора.
 */
(function () {
  'use strict'

  if (typeof window === 'undefined' || !window.CMS || !window.h || !window.createClass) {
    console.error('[table_grid] Decap CMS не завантажено — віджет не зареєстровано')
    return
  }

  var h = window.h
  var createClass = window.createClass

  /* ── Стилі віджета ─────────────────────────────────────────────── */

  var CSS = [
    '.tg-wrap { border: 1px solid #d8e2e7; border-radius: 8px; overflow: hidden; background: #fff; }',
    '.tg-toolbar { display: flex; align-items: center; gap: 10px; padding: 8px 10px; background: #f8fafb; border-bottom: 1px solid #d8e2e7; flex-wrap: wrap; }',
    '.tg-search { flex: 0 1 260px; padding: 6px 10px; border: 1px solid #d8e2e7; border-radius: 6px; font-size: 13px; }',
    '.tg-count { color: #5b6b73; font-size: 12px; }',
    '.tg-scroll { max-height: 520px; overflow: auto; }',
    '.tg-table { width: 100%; border-collapse: collapse; font-size: 13px; }',
    '.tg-table th { position: sticky; top: 0; z-index: 2; background: #17607a; color: #fff; text-align: left; padding: 7px 9px; font-weight: 600; white-space: nowrap; }',
    '.tg-table td { border-top: 1px solid #e5ecef; padding: 0; vertical-align: top; }',
    '.tg-cell { width: 100%; border: 0; background: transparent; padding: 6px 9px; font-size: 13px; font-family: inherit; color: inherit; resize: none; display: block; overflow: hidden; }',
    '.tg-cell:focus { outline: 2px solid #17607a; outline-offset: -2px; background: #e8f3f7; }',
    '.tg-num { width: 34px; min-width: 34px; text-align: center; color: #5b6b73; font-size: 12px; padding: 8px 2px; }',
    '.tg-actions { width: 118px; min-width: 118px; white-space: nowrap; text-align: center; padding: 4px 2px; }',
    '.tg-btn { border: 0; background: transparent; cursor: pointer; font-size: 13px; padding: 4px 6px; border-radius: 5px; color: #17607a; }',
    '.tg-btn:hover { background: #e8f3f7; }',
    '.tg-btn:disabled { opacity: .35; cursor: default; }',
    '.tg-btn-danger { color: #b3423a; }',
    '.tg-btn-danger:hover { background: #fbeeed; }',
    '.tg-foot { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-top: 1px solid #d8e2e7; flex-wrap: wrap; }',
    '.tg-btn-add { border: 1px solid #17607a; background: #17607a; color: #fff; border-radius: 6px; padding: 6px 12px; font-size: 13px; cursor: pointer; }',
    '.tg-btn-add:hover { background: #0f4a5e; }',
    '.tg-btn-add:disabled { opacity: .5; cursor: default; }',
    '.tg-btn-ghost { border: 1px solid #d8e2e7; background: #fff; border-radius: 6px; padding: 6px 12px; font-size: 13px; cursor: pointer; }',
    '.tg-btn-ghost:hover { background: #f2f7f9; }',
    '.tg-btn-ghost:disabled { opacity: .5; cursor: default; }',
    '.tg-hint { color: #5b6b73; font-size: 12px; }',
    '.tg-row-sel td { background: #e8f3f7; }',
    '.tg-row-del-confirm td { background: #fbeeed; }',
    '.tg-empty { padding: 16px; text-align: center; color: #5b6b73; font-size: 13px; }',
    '.tg-note-cell { font-style: italic; color: #5b6b73; }',
  ].join('\n')

  function injectStyles() {
    if (document.getElementById('tg-widget-styles')) return
    var style = document.createElement('style')
    style.id = 'tg-widget-styles'
    style.textContent = CSS
    document.head.appendChild(style)
  }

  /* ── Допоміжне ─────────────────────────────────────────────────── */

  // Поля рядка в сітці. note — підпис, теж редагуємо (останнім стовпцем).
  var ROW_FIELDS = ['institution', 'person', 'role', 'phone', 'email', 'consultant', 'note']
  var FIELD_LABELS = {
    institution: 'Заклад освіти',
    person: "Прізвище, ім'я, по батькові",
    role: 'Посада / напрям роботи / спільнота',
    phone: 'Телефон',
    email: 'Електронна адреса',
    consultant: 'Закріплені консультанти',
    note: 'Підпис (на всю ширину)',
  }

  function isImm(v) {
    return v && typeof v.get === 'function' && typeof v.set === 'function'
  }

  function immSize(v) {
    if (!v) return 0
    if (typeof v.size === 'number') return v.size
    if (typeof v.count === 'function') return v.count()
    if (Array.isArray(v)) return v.length
    return 0
  }

  function matchRow(row, q) {
    if (!q) return true
    var hay = ROW_FIELDS.map(function (f) { return (row && row[f]) || '' }).join(' ').toLowerCase()
    return hay.indexOf(q) !== -1
  }

  /* ── Компонент сітки ───────────────────────────────────────────── */

  var TableGridControl = createClass({
    getInitialState: function () {
      return { query: '', selected: -1, confirmDelete: -1 }
    },

    componentDidMount: function () {
      injectStyles()
      this.autoHeight()
    },

    componentDidUpdate: function () {
      // Фокус у щойно доданому/дубльованому рядку
      if (this.__focusRow != null) {
        var root = document.getElementById(this.props.forID)
        var tr = root && root.querySelector('tr[data-tg-row="' + this.__focusRow + '"]')
        var ta = tr && tr.querySelector('.tg-cell')
        if (ta) ta.focus()
        this.__focusRow = null
      }
      this.autoHeight()
    },

    // ── Дані ──

    rowsArray: function () {
      var v = this.props.value
      if (!v) return []
      if (typeof v.toJS === 'function') return v.toJS()
      if (Array.isArray(v)) return v.slice()
      return []
    },

    gridFields: function () {
      var declared = []
      try {
        var fl = this.props.field.get('fields')
        if (fl && typeof fl.toJS === 'function') {
          declared = fl.toJS().map(function (x) { return x && x.name }).filter(Boolean)
        }
      } catch (e) { /* config без fields — беремо стандартні */ }
      var g = declared.filter(function (n) { return ROW_FIELDS.indexOf(n) !== -1 })
      return g.length ? g : ROW_FIELDS.slice(0, 4)
    },

    // Immutable-джерело для створення нових List/Map (value може бути null).
    // entry з props — Immutable.Map, беремо його як конструктор.
    immSeed: function () {
      try {
        var e = this.props.entry
        if (e && typeof e.get === 'function') {
          var d = e.get('data')
          if (d && typeof d.set === 'function') return d
        }
        if (e && typeof e.set === 'function') return e
      } catch (err) { /* немає entry — plain-режим */ }
      return null
    },

    emit: function (next) {
      this.props.onChange(next)
    },

    updateRow: function (i, key, val) {
      var v = this.props.value
      if (isImm(v)) {
        var row = v.get(i)
        if (row && typeof row.set === 'function') {
          var nextRow = val === '' ? row.delete(key) : row.set(key, val)
          this.emit(v.set(i, nextRow))
          return
        }
      }
      var rows = this.rowsArray()
      var copy = Object.assign({}, rows[i] || {})
      if (val === '') delete copy[key]
      else copy[key] = val
      rows[i] = copy
      this.emit(rows)
    },

    addRow: function () {
      var v = this.props.value
      var seed = this.immSeed()
      if (isImm(v) && seed) {
        this.__focusRow = immSize(v)
        this.emit(v.push(seed.clear()))
        return
      }
      if (seed) {
        // Порожня таблиця: будуємо List з конструктора entry
        var emptyRow = seed.clear()
        this.__focusRow = 0
        this.emit(seed.clear().toList().push(emptyRow))
        return
      }
      var rows = this.rowsArray()
      rows.push({})
      this.__focusRow = rows.length - 1
      this.emit(rows)
    },

    dupRow: function (i) {
      var v = this.props.value
      if (isImm(v)) {
        this.__focusRow = i + 1
        this.emit(v.insert(i + 1, v.get(i)))
      } else {
        var rows = this.rowsArray()
        rows.splice(i + 1, 0, Object.assign({}, rows[i] || {}))
        this.__focusRow = i + 1
        this.emit(rows)
      }
      this.setState({ selected: i + 1, confirmDelete: -1 })
    },

    delRow: function (i) {
      if (this.state.confirmDelete !== i) {
        this.setState({ confirmDelete: i })
        return
      }
      var v = this.props.value
      if (isImm(v)) this.emit(v.delete(i))
      else {
        var rows = this.rowsArray()
        rows.splice(i, 1)
        this.emit(rows)
      }
      this.setState({ confirmDelete: -1, selected: -1 })
    },

    moveRow: function (i, dir) {
      var v = this.props.value
      var j = i + dir
      if (j < 0 || j >= immSize(v)) return
      if (isImm(v)) {
        var a = v.get(i)
        var b = v.get(j)
        this.emit(v.set(i, b).set(j, a))
      } else {
        var rows = this.rowsArray()
        var tmp = rows[i]
        rows[i] = rows[j]
        rows[j] = tmp
        this.emit(rows)
      }
      this.setState({ selected: j, confirmDelete: -1 })
    },

    autoHeight: function () {
      var root = document.getElementById(this.props.forID)
      if (!root) return
      var tas = root.querySelectorAll('.tg-cell')
      for (var k = 0; k < tas.length; k++) {
        var t = tas[k]
        t.style.height = 'auto'
        if (t.scrollHeight) t.style.height = t.scrollHeight + 'px'
      }
    },

    // ── Рендер ──

    render: function () {
      var self = this
      var rows = this.rowsArray()
      var fields = this.gridFields()
      var q = this.state.query.trim().toLowerCase()
      var disabled = !!this.props.isDisabled

      var visible = []
      rows.forEach(function (row, i) {
        if (matchRow(row, q)) visible.push(i)
      })

      var bodyChildren
      if (visible.length === 0) {
        bodyChildren = [
          h('tr', { key: 'empty' },
            h('td', { className: 'tg-empty', colSpan: fields.length + 2 },
              rows.length === 0
                ? 'Таблиця порожня — додайте перший рядок.'
                : 'Нічого не знайдено за запитом.')),
        ]
      } else {
        bodyChildren = visible.map(function (i) {
          var row = rows[i] || {}
          var cls = (self.state.selected === i ? 'tg-row-sel ' : '') +
            (self.state.confirmDelete === i ? 'tg-row-del-confirm' : '')
          return h('tr', {
            key: i,
            'data-tg-row': String(i),
            className: cls,
            onClick: function () { self.setState({ selected: i }) },
          },
            h('td', { className: 'tg-num' }, String(i + 1)),
            fields.map(function (f) {
              return h('td', { key: f },
                h('textarea', {
                  className: 'tg-cell' + (f === 'note' ? ' tg-note-cell' : ''),
                  rows: 1,
                  disabled: disabled,
                  value: row[f] || '',
                  onChange: function (e) { self.updateRow(i, f, e.target.value) },
                }))
            }),
            h('td', { className: 'tg-actions' },
              h('button', {
                type: 'button', className: 'tg-btn', title: 'Вгору',
                disabled: disabled || i === 0,
                onClick: function (e) { e.stopPropagation(); self.moveRow(i, -1) },
              }, '↑'),
              h('button', {
                type: 'button', className: 'tg-btn', title: 'Вниз',
                disabled: disabled || i === rows.length - 1,
                onClick: function (e) { e.stopPropagation(); self.moveRow(i, 1) },
              }, '↓'),
              h('button', {
                type: 'button', className: 'tg-btn', title: 'Дублювати рядок',
                disabled: disabled,
                onClick: function (e) { e.stopPropagation(); self.dupRow(i) },
              }, '⧉'),
              h('button', {
                type: 'button', className: 'tg-btn tg-btn-danger',
                title: self.state.confirmDelete === i ? 'Натисніть ще раз, щоб видалити' : 'Видалити рядок',
                disabled: disabled,
                onClick: function (e) { e.stopPropagation(); self.delRow(i) },
              }, self.state.confirmDelete === i ? 'Точно?' : '✕')))
        })
      }

      return h('div', { id: this.props.forID, className: (this.props.classNameWrapper || '') + ' tg-wrap' },
        h('div', { className: 'tg-toolbar' },
          h('input', {
            className: 'tg-search', type: 'search', placeholder: 'Пошук по таблиці…',
            value: this.state.query,
            onChange: function (e) { self.setState({ query: e.target.value }) },
          }),
          h('span', { className: 'tg-count' },
            visible.length + ' з ' + rows.length + ' рядків')),
        h('div', { className: 'tg-scroll' },
          h('table', { className: 'tg-table' },
            h('thead', null,
              h('tr', null,
                h('th', { className: 'tg-num' }, '№'),
                fields.map(function (f) { return h('th', { key: f }, FIELD_LABELS[f] || f) }),
                h('th', { className: 'tg-actions' }, 'Дії'))),
            h('tbody', null, bodyChildren))),
        h('div', { className: 'tg-foot' },
          h('button', {
            type: 'button', className: 'tg-btn-add', disabled: disabled,
            onClick: function () { self.addRow() },
          }, '+ Додати рядок'),
          h('button', {
            type: 'button', className: 'tg-btn-ghost',
            disabled: disabled || this.state.selected < 0,
            onClick: function () { if (self.state.selected >= 0) self.dupRow(self.state.selected) },
          }, '⧉ Дублювати виділений'),
          h('span', { className: 'tg-hint' },
            'Редагуйте прямо в комірках. Порожні поля не зберігаються.')))
    },
  })

  /* ── Реєстрація ────────────────────────────────────────────────── */

  window.CMS.registerWidget('table_grid', TableGridControl)
  console.log('[table_grid] віджет зареєстровано')
})()