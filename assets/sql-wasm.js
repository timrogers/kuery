// We are modularizing this manually because the current modularize setting in Emscripten has some issues:
// https://github.com/kripken/emscripten/issues/5820
// In addition, When you use emcc's modularization, it still expects to export a global object called `Module`,
// which is able to be used/called before the WASM is loaded.
// The modularization below exports a promise that loads and resolves to the actual sql.js module.
// That way, this module can't be used before the WASM is finished loading.

// We are going to define a function that a user will call to start loading initializing our Sql.js library
// However, that function might be called multiple times, and on subsequent calls, we don't actually want it to instantiate a new instance of the Module
// Instead, we want to return the previously loaded module

// TODO: Make this not declare a global if used in the browser
var initSqlJsPromise = undefined;

var initSqlJs = function (moduleConfig) {
  if (initSqlJsPromise) {
    return initSqlJsPromise;
  }
  // If we're here, we've never called this function before
  initSqlJsPromise = new Promise(function (resolveModule, reject) {
    // We are modularizing this manually because the current modularize setting in Emscripten has some issues:
    // https://github.com/kripken/emscripten/issues/5820

    // The way to affect the loading of emcc compiled modules is to create a variable called `Module` and add
    // properties to it, like `preRun`, `postRun`, etc
    // We are using that to get notified when the WASM has finished loading.
    // Only then will we return our promise

    // If they passed in a moduleConfig object, use that
    // Otherwise, initialize Module to the empty object
    var Module = typeof moduleConfig !== 'undefined' ? moduleConfig : {};

    // EMCC only allows for a single onAbort function (not an array of functions)
    // So if the user defined their own onAbort function, we remember it and call it
    var originalOnAbortFunction = Module['onAbort'];
    Module['onAbort'] = function (errorThatCausedAbort) {
      reject(new Error(errorThatCausedAbort));
      if (originalOnAbortFunction) {
        originalOnAbortFunction(errorThatCausedAbort);
      }
    };

    Module['postRun'] = Module['postRun'] || [];
    Module['postRun'].push(function () {
      // When Emscripted calls postRun, this promise resolves with the built Module
      resolveModule(Module);
    });

    // There is a section of code in the emcc-generated code below that looks like this:
    // (Note that this is lowercase `module`)
    // if (typeof module !== 'undefined') {
    //     module['exports'] = Module;
    // }
    // When that runs, it's going to overwrite our own modularization export efforts in shell-post.js!
    // The only way to tell emcc not to emit it is to pass the MODULARIZE=1 or MODULARIZE_INSTANCE=1 flags,
    // but that carries with it additional unnecessary baggage/bugs we don't want either.
    // So, we have three options:
    // 1) We undefine `module`
    // 2) We remember what `module['exports']` was at the beginning of this function and we restore it later
    // 3) We write a script to remove those lines of code as part of the Make process.
    //
    // Since those are the only lines of code that care about module, we will undefine it. It's the most straightforward
    // of the options, and has the side effect of reducing emcc's efforts to modify the module if its output were to change in the future.
    // That's a nice side effect since we're handling the modularization efforts ourselves
    module = undefined;

    // The emcc-generated code and shell-post.js code goes below,
    // meaning that all of it runs inside of this promise. If anything throws an exception, our promise will abort
    var f;
    f ||= typeof Module != 'undefined' ? Module : {};
    var aa = 'object' == typeof window,
      ba = 'undefined' != typeof WorkerGlobalScope,
      ca =
        'object' == typeof process &&
        'object' == typeof process.versions &&
        'string' == typeof process.versions.node &&
        'renderer' != process.type;
    ('use strict');
    f.onRuntimeInitialized = function () {
      function a(g, l) {
        switch (typeof l) {
          case 'boolean':
            dc(g, l ? 1 : 0);
            break;
          case 'number':
            ec(g, l);
            break;
          case 'string':
            fc(g, l, -1, -1);
            break;
          case 'object':
            if (null === l) lb(g);
            else if (null != l.length) {
              var n = da(l, ea);
              gc(g, n, l.length, -1);
              fa(n);
            } else
              va(
                g,
                'Wrong API use : tried to return a value of an unknown type (' +
                  l +
                  ').',
                -1
              );
            break;
          default:
            lb(g);
        }
      }
      function b(g, l) {
        for (var n = [], r = 0; r < g; r += 1) {
          var t = m(l + 4 * r, 'i32'),
            y = hc(t);
          if (1 === y || 2 === y) t = ic(t);
          else if (3 === y) t = jc(t);
          else if (4 === y) {
            y = t;
            t = kc(y);
            y = lc(y);
            for (var L = new Uint8Array(t), J = 0; J < t; J += 1)
              L[J] = p[y + J];
            t = L;
          } else t = null;
          n.push(t);
        }
        return n;
      }
      function c(g, l) {
        this.Qa = g;
        this.db = l;
        this.Oa = 1;
        this.lb = [];
      }
      function d(g, l) {
        this.db = l;
        l = ha(g) + 1;
        this.eb = ia(l);
        if (null === this.eb)
          throw Error('Unable to allocate memory for the SQL string');
        u(g, x, this.eb, l);
        this.kb = this.eb;
        this.Za = this.pb = null;
      }
      function e(g) {
        this.filename = 'dbfile_' + ((4294967295 * Math.random()) >>> 0);
        if (null != g) {
          var l = this.filename,
            n = '/',
            r = l;
          n &&
            ((n = 'string' == typeof n ? n : ja(n)),
            (r = l ? ka(n + '/' + l) : n));
          l = la(!0, !0);
          r = ma(r, l);
          if (g) {
            if ('string' == typeof g) {
              n = Array(g.length);
              for (var t = 0, y = g.length; t < y; ++t) n[t] = g.charCodeAt(t);
              g = n;
            }
            na(r, l | 146);
            n = oa(r, 577);
            pa(n, g, 0, g.length, 0);
            qa(n);
            na(r, l);
          }
        }
        this.handleError(q(this.filename, h));
        this.db = m(h, 'i32');
        ob(this.db);
        this.fb = {};
        this.Sa = {};
      }
      var h = z(4),
        k = f.cwrap,
        q = k('sqlite3_open', 'number', ['string', 'number']),
        w = k('sqlite3_close_v2', 'number', ['number']),
        v = k('sqlite3_exec', 'number', [
          'number',
          'string',
          'number',
          'number',
          'number',
        ]),
        C = k('sqlite3_changes', 'number', ['number']),
        G = k('sqlite3_prepare_v2', 'number', [
          'number',
          'string',
          'number',
          'number',
          'number',
        ]),
        pb = k('sqlite3_sql', 'string', ['number']),
        nc = k('sqlite3_normalized_sql', 'string', ['number']),
        qb = k('sqlite3_prepare_v2', 'number', [
          'number',
          'number',
          'number',
          'number',
          'number',
        ]),
        oc = k('sqlite3_bind_text', 'number', [
          'number',
          'number',
          'number',
          'number',
          'number',
        ]),
        rb = k('sqlite3_bind_blob', 'number', [
          'number',
          'number',
          'number',
          'number',
          'number',
        ]),
        pc = k('sqlite3_bind_double', 'number', ['number', 'number', 'number']),
        qc = k('sqlite3_bind_int', 'number', ['number', 'number', 'number']),
        rc = k('sqlite3_bind_parameter_index', 'number', ['number', 'string']),
        sc = k('sqlite3_step', 'number', ['number']),
        tc = k('sqlite3_errmsg', 'string', ['number']),
        uc = k('sqlite3_column_count', 'number', ['number']),
        vc = k('sqlite3_data_count', 'number', ['number']),
        wc = k('sqlite3_column_double', 'number', ['number', 'number']),
        sb = k('sqlite3_column_text', 'string', ['number', 'number']),
        xc = k('sqlite3_column_blob', 'number', ['number', 'number']),
        yc = k('sqlite3_column_bytes', 'number', ['number', 'number']),
        zc = k('sqlite3_column_type', 'number', ['number', 'number']),
        Ac = k('sqlite3_column_name', 'string', ['number', 'number']),
        Bc = k('sqlite3_reset', 'number', ['number']),
        Cc = k('sqlite3_clear_bindings', 'number', ['number']),
        Dc = k('sqlite3_finalize', 'number', ['number']),
        tb = k(
          'sqlite3_create_function_v2',
          'number',
          'number string number number number number number number number'.split(
            ' '
          )
        ),
        hc = k('sqlite3_value_type', 'number', ['number']),
        kc = k('sqlite3_value_bytes', 'number', ['number']),
        jc = k('sqlite3_value_text', 'string', ['number']),
        lc = k('sqlite3_value_blob', 'number', ['number']),
        ic = k('sqlite3_value_double', 'number', ['number']),
        ec = k('sqlite3_result_double', '', ['number', 'number']),
        lb = k('sqlite3_result_null', '', ['number']),
        fc = k('sqlite3_result_text', '', [
          'number',
          'string',
          'number',
          'number',
        ]),
        gc = k('sqlite3_result_blob', '', [
          'number',
          'number',
          'number',
          'number',
        ]),
        dc = k('sqlite3_result_int', '', ['number', 'number']),
        va = k('sqlite3_result_error', '', ['number', 'string', 'number']),
        ub = k('sqlite3_aggregate_context', 'number', ['number', 'number']),
        ob = k('RegisterExtensionFunctions', 'number', ['number']),
        vb = k('sqlite3_update_hook', 'number', ['number', 'number', 'number']);
      c.prototype.bind = function (g) {
        if (!this.Qa) throw 'Statement closed';
        this.reset();
        return Array.isArray(g)
          ? this.Cb(g)
          : null != g && 'object' === typeof g
            ? this.Db(g)
            : !0;
      };
      c.prototype.step = function () {
        if (!this.Qa) throw 'Statement closed';
        this.Oa = 1;
        var g = sc(this.Qa);
        switch (g) {
          case 100:
            return !0;
          case 101:
            return !1;
          default:
            throw this.db.handleError(g);
        }
      };
      c.prototype.wb = function (g) {
        null == g && ((g = this.Oa), (this.Oa += 1));
        return wc(this.Qa, g);
      };
      c.prototype.Gb = function (g) {
        null == g && ((g = this.Oa), (this.Oa += 1));
        g = sb(this.Qa, g);
        if ('function' !== typeof BigInt)
          throw Error('BigInt is not supported');
        return BigInt(g);
      };
      c.prototype.Hb = function (g) {
        null == g && ((g = this.Oa), (this.Oa += 1));
        return sb(this.Qa, g);
      };
      c.prototype.getBlob = function (g) {
        null == g && ((g = this.Oa), (this.Oa += 1));
        var l = yc(this.Qa, g);
        g = xc(this.Qa, g);
        for (var n = new Uint8Array(l), r = 0; r < l; r += 1) n[r] = p[g + r];
        return n;
      };
      c.prototype.get = function (g, l) {
        l = l || {};
        null != g && this.bind(g) && this.step();
        g = [];
        for (var n = vc(this.Qa), r = 0; r < n; r += 1)
          switch (zc(this.Qa, r)) {
            case 1:
              var t = l.useBigInt ? this.Gb(r) : this.wb(r);
              g.push(t);
              break;
            case 2:
              g.push(this.wb(r));
              break;
            case 3:
              g.push(this.Hb(r));
              break;
            case 4:
              g.push(this.getBlob(r));
              break;
            default:
              g.push(null);
          }
        return g;
      };
      c.prototype.getColumnNames = function () {
        for (var g = [], l = uc(this.Qa), n = 0; n < l; n += 1)
          g.push(Ac(this.Qa, n));
        return g;
      };
      c.prototype.getAsObject = function (g, l) {
        g = this.get(g, l);
        l = this.getColumnNames();
        for (var n = {}, r = 0; r < l.length; r += 1) n[l[r]] = g[r];
        return n;
      };
      c.prototype.getSQL = function () {
        return pb(this.Qa);
      };
      c.prototype.getNormalizedSQL = function () {
        return nc(this.Qa);
      };
      c.prototype.run = function (g) {
        null != g && this.bind(g);
        this.step();
        return this.reset();
      };
      c.prototype.sb = function (g, l) {
        null == l && ((l = this.Oa), (this.Oa += 1));
        g = ra(g);
        var n = da(g, ea);
        this.lb.push(n);
        this.db.handleError(oc(this.Qa, l, n, g.length - 1, 0));
      };
      c.prototype.Bb = function (g, l) {
        null == l && ((l = this.Oa), (this.Oa += 1));
        var n = da(g, ea);
        this.lb.push(n);
        this.db.handleError(rb(this.Qa, l, n, g.length, 0));
      };
      c.prototype.rb = function (g, l) {
        null == l && ((l = this.Oa), (this.Oa += 1));
        this.db.handleError((g === (g | 0) ? qc : pc)(this.Qa, l, g));
      };
      c.prototype.Eb = function (g) {
        null == g && ((g = this.Oa), (this.Oa += 1));
        rb(this.Qa, g, 0, 0, 0);
      };
      c.prototype.tb = function (g, l) {
        null == l && ((l = this.Oa), (this.Oa += 1));
        switch (typeof g) {
          case 'string':
            this.sb(g, l);
            return;
          case 'number':
            this.rb(g, l);
            return;
          case 'bigint':
            this.sb(g.toString(), l);
            return;
          case 'boolean':
            this.rb(g + 0, l);
            return;
          case 'object':
            if (null === g) {
              this.Eb(l);
              return;
            }
            if (null != g.length) {
              this.Bb(g, l);
              return;
            }
        }
        throw (
          'Wrong API use : tried to bind a value of an unknown type (' +
          g +
          ').'
        );
      };
      c.prototype.Db = function (g) {
        var l = this;
        Object.keys(g).forEach(function (n) {
          var r = rc(l.Qa, n);
          0 !== r && l.tb(g[n], r);
        });
        return !0;
      };
      c.prototype.Cb = function (g) {
        for (var l = 0; l < g.length; l += 1) this.tb(g[l], l + 1);
        return !0;
      };
      c.prototype.reset = function () {
        this.freemem();
        return 0 === Cc(this.Qa) && 0 === Bc(this.Qa);
      };
      c.prototype.freemem = function () {
        for (var g; void 0 !== (g = this.lb.pop()); ) fa(g);
      };
      c.prototype.free = function () {
        this.freemem();
        var g = 0 === Dc(this.Qa);
        delete this.db.fb[this.Qa];
        this.Qa = 0;
        return g;
      };
      d.prototype.next = function () {
        if (null === this.eb) return { done: !0 };
        null !== this.Za && (this.Za.free(), (this.Za = null));
        if (!this.db.db) throw (this.mb(), Error('Database closed'));
        var g = sa(),
          l = z(4);
        ta(h);
        ta(l);
        try {
          this.db.handleError(qb(this.db.db, this.kb, -1, h, l));
          this.kb = m(l, 'i32');
          var n = m(h, 'i32');
          if (0 === n) return this.mb(), { done: !0 };
          this.Za = new c(n, this.db);
          this.db.fb[n] = this.Za;
          return { value: this.Za, done: !1 };
        } catch (r) {
          throw ((this.pb = ua(this.kb)), this.mb(), r);
        } finally {
          wa(g);
        }
      };
      d.prototype.mb = function () {
        fa(this.eb);
        this.eb = null;
      };
      d.prototype.getRemainingSQL = function () {
        return null !== this.pb ? this.pb : ua(this.kb);
      };
      'function' === typeof Symbol &&
        'symbol' === typeof Symbol.iterator &&
        (d.prototype[Symbol.iterator] = function () {
          return this;
        });
      e.prototype.run = function (g, l) {
        if (!this.db) throw 'Database closed';
        if (l) {
          g = this.prepare(g, l);
          try {
            g.step();
          } finally {
            g.free();
          }
        } else this.handleError(v(this.db, g, 0, 0, h));
        return this;
      };
      e.prototype.exec = function (g, l, n) {
        if (!this.db) throw 'Database closed';
        var r = sa(),
          t = null;
        try {
          var y = xa(g),
            L = z(4);
          for (g = []; 0 !== m(y, 'i8'); ) {
            ta(h);
            ta(L);
            this.handleError(qb(this.db, y, -1, h, L));
            var J = m(h, 'i32');
            y = m(L, 'i32');
            if (0 !== J) {
              var I = null;
              t = new c(J, this);
              for (null != l && t.bind(l); t.step(); )
                null === I &&
                  ((I = { columns: t.getColumnNames(), values: [] }),
                  g.push(I)),
                  I.values.push(t.get(null, n));
              t.free();
            }
          }
          return g;
        } catch (M) {
          throw (t && t.free(), M);
        } finally {
          wa(r);
        }
      };
      e.prototype.each = function (g, l, n, r, t) {
        'function' === typeof l && ((r = n), (n = l), (l = void 0));
        g = this.prepare(g, l);
        try {
          for (; g.step(); ) n(g.getAsObject(null, t));
        } finally {
          g.free();
        }
        if ('function' === typeof r) return r();
      };
      e.prototype.prepare = function (g, l) {
        ta(h);
        this.handleError(G(this.db, g, -1, h, 0));
        g = m(h, 'i32');
        if (0 === g) throw 'Nothing to prepare';
        var n = new c(g, this);
        null != l && n.bind(l);
        return (this.fb[g] = n);
      };
      e.prototype.iterateStatements = function (g) {
        return new d(g, this);
      };
      e.prototype['export'] = function () {
        Object.values(this.fb).forEach(function (l) {
          l.free();
        });
        Object.values(this.Sa).forEach(A);
        this.Sa = {};
        this.handleError(w(this.db));
        var g = ya(this.filename);
        this.handleError(q(this.filename, h));
        this.db = m(h, 'i32');
        ob(this.db);
        return g;
      };
      e.prototype.close = function () {
        null !== this.db &&
          (Object.values(this.fb).forEach(function (g) {
            g.free();
          }),
          Object.values(this.Sa).forEach(A),
          (this.Sa = {}),
          this.Ya && (A(this.Ya), (this.Ya = void 0)),
          this.handleError(w(this.db)),
          za('/' + this.filename),
          (this.db = null));
      };
      e.prototype.handleError = function (g) {
        if (0 === g) return null;
        g = tc(this.db);
        throw Error(g);
      };
      e.prototype.getRowsModified = function () {
        return C(this.db);
      };
      e.prototype.create_function = function (g, l) {
        Object.prototype.hasOwnProperty.call(this.Sa, g) &&
          (A(this.Sa[g]), delete this.Sa[g]);
        var n = Aa(function (r, t, y) {
          t = b(t, y);
          try {
            var L = l.apply(null, t);
          } catch (J) {
            va(r, J, -1);
            return;
          }
          a(r, L);
        }, 'viii');
        this.Sa[g] = n;
        this.handleError(tb(this.db, g, l.length, 1, 0, n, 0, 0, 0));
        return this;
      };
      e.prototype.create_aggregate = function (g, l) {
        var n =
            l.init ||
            function () {
              return null;
            },
          r =
            l.finalize ||
            function (I) {
              return I;
            },
          t = l.step;
        if (!t) throw 'An aggregate function must have a step function in ' + g;
        var y = {};
        Object.hasOwnProperty.call(this.Sa, g) &&
          (A(this.Sa[g]), delete this.Sa[g]);
        l = g + '__finalize';
        Object.hasOwnProperty.call(this.Sa, l) &&
          (A(this.Sa[l]), delete this.Sa[l]);
        var L = Aa(function (I, M, Ra) {
            var X = ub(I, 1);
            Object.hasOwnProperty.call(y, X) || (y[X] = n());
            M = b(M, Ra);
            M = [y[X]].concat(M);
            try {
              y[X] = t.apply(null, M);
            } catch (Fc) {
              delete y[X], va(I, Fc, -1);
            }
          }, 'viii'),
          J = Aa(function (I) {
            var M = ub(I, 1);
            try {
              var Ra = r(y[M]);
            } catch (X) {
              delete y[M];
              va(I, X, -1);
              return;
            }
            a(I, Ra);
            delete y[M];
          }, 'vi');
        this.Sa[g] = L;
        this.Sa[l] = J;
        this.handleError(tb(this.db, g, t.length - 1, 1, 0, 0, L, J, 0));
        return this;
      };
      e.prototype.updateHook = function (g) {
        this.Ya && (vb(this.db, 0, 0), A(this.Ya), (this.Ya = void 0));
        g &&
          ((this.Ya = Aa(function (l, n, r, t, y) {
            switch (n) {
              case 18:
                l = 'insert';
                break;
              case 23:
                l = 'update';
                break;
              case 9:
                l = 'delete';
                break;
              default:
                throw 'unknown operationCode in updateHook callback: ' + n;
            }
            r = r ? B(x, r) : '';
            t = t ? B(x, t) : '';
            if (y > Number.MAX_SAFE_INTEGER)
              throw 'rowId too big to fit inside a Number';
            g(l, r, t, Number(y));
          }, 'viiiij')),
          vb(this.db, this.Ya, 0));
      };
      f.Database = e;
    };
    var Ba = { ...f },
      Ca = './this.program',
      Da = (a, b) => {
        throw b;
      },
      D = '',
      Ea,
      Fa;
    if (ca) {
      var fs = require('fs');
      require('path');
      D = __dirname + '/';
      Fa = a => {
        a = Ga(a) ? new URL(a) : a;
        return fs.readFileSync(a);
      };
      Ea = async a => {
        a = Ga(a) ? new URL(a) : a;
        return fs.readFileSync(a, void 0);
      };
      !f.thisProgram &&
        1 < process.argv.length &&
        (Ca = process.argv[1].replace(/\\/g, '/'));
      process.argv.slice(2);
      'undefined' != typeof module && (module.exports = f);
      Da = (a, b) => {
        process.exitCode = a;
        throw b;
      };
    } else if (aa || ba)
      ba
        ? (D = self.location.href)
        : 'undefined' != typeof document &&
          document.currentScript &&
          (D = document.currentScript.src),
        (D = D.startsWith('blob:')
          ? ''
          : D.slice(0, D.replace(/[?#].*/, '').lastIndexOf('/') + 1)),
        ba &&
          (Fa = a => {
            var b = new XMLHttpRequest();
            b.open('GET', a, !1);
            b.responseType = 'arraybuffer';
            b.send(null);
            return new Uint8Array(b.response);
          }),
        (Ea = async a => {
          if (Ga(a))
            return new Promise((c, d) => {
              var e = new XMLHttpRequest();
              e.open('GET', a, !0);
              e.responseType = 'arraybuffer';
              e.onload = () => {
                200 == e.status || (0 == e.status && e.response)
                  ? c(e.response)
                  : d(e.status);
              };
              e.onerror = d;
              e.send(null);
            });
          var b = await fetch(a, { credentials: 'same-origin' });
          if (b.ok) return b.arrayBuffer();
          throw Error(b.status + ' : ' + b.url);
        });
    var Ha = f.print || console.log.bind(console),
      Ia = f.printErr || console.error.bind(console);
    Object.assign(f, Ba);
    Ba = null;
    f.thisProgram && (Ca = f.thisProgram);
    var Ja = f.wasmBinary,
      Ka,
      La = !1,
      Ma,
      p,
      x,
      Na,
      E,
      F,
      Oa,
      H,
      Pa,
      Ga = a => a.startsWith('file://');
    function Qa() {
      var a = Ka.buffer;
      f.HEAP8 = p = new Int8Array(a);
      f.HEAP16 = Na = new Int16Array(a);
      f.HEAPU8 = x = new Uint8Array(a);
      f.HEAPU16 = new Uint16Array(a);
      f.HEAP32 = E = new Int32Array(a);
      f.HEAPU32 = F = new Uint32Array(a);
      f.HEAPF32 = Oa = new Float32Array(a);
      f.HEAPF64 = Pa = new Float64Array(a);
      f.HEAP64 = H = new BigInt64Array(a);
      f.HEAPU64 = new BigUint64Array(a);
    }
    var K = 0,
      Sa = null;
    function Ta(a) {
      f.onAbort?.(a);
      a = 'Aborted(' + a + ')';
      Ia(a);
      La = !0;
      throw new WebAssembly.RuntimeError(
        a + '. Build with -sASSERTIONS for more info.'
      );
    }
    var Ua;
    async function Va(a) {
      if (!Ja)
        try {
          var b = await Ea(a);
          return new Uint8Array(b);
        } catch {}
      if (a == Ua && Ja) a = new Uint8Array(Ja);
      else if (Fa) a = Fa(a);
      else throw 'both async and sync fetching of the wasm failed';
      return a;
    }
    async function Wa(a, b) {
      try {
        var c = await Va(a);
        return await WebAssembly.instantiate(c, b);
      } catch (d) {
        Ia(`failed to asynchronously prepare wasm: ${d}`), Ta(d);
      }
    }
    async function Xa(a) {
      var b = Ua;
      if (
        !Ja &&
        'function' == typeof WebAssembly.instantiateStreaming &&
        !Ga(b) &&
        !ca
      )
        try {
          var c = fetch(b, { credentials: 'same-origin' });
          return await WebAssembly.instantiateStreaming(c, a);
        } catch (d) {
          Ia(`wasm streaming compile failed: ${d}`),
            Ia('falling back to ArrayBuffer instantiation');
        }
      return Wa(b, a);
    }
    class Ya {
      name = 'ExitStatus';
      constructor(a) {
        this.message = `Program terminated with exit(${a})`;
        this.status = a;
      }
    }
    var Za = a => {
        for (; 0 < a.length; ) a.shift()(f);
      },
      $a = [],
      ab = [],
      bb = () => {
        var a = f.preRun.shift();
        ab.unshift(a);
      };
    function m(a, b = 'i8') {
      b.endsWith('*') && (b = '*');
      switch (b) {
        case 'i1':
          return p[a];
        case 'i8':
          return p[a];
        case 'i16':
          return Na[a >> 1];
        case 'i32':
          return E[a >> 2];
        case 'i64':
          return H[a >> 3];
        case 'float':
          return Oa[a >> 2];
        case 'double':
          return Pa[a >> 3];
        case '*':
          return F[a >> 2];
        default:
          Ta(`invalid type for getValue: ${b}`);
      }
    }
    var cb = f.noExitRuntime || !0;
    function ta(a) {
      var b = 'i32';
      b.endsWith('*') && (b = '*');
      switch (b) {
        case 'i1':
          p[a] = 0;
          break;
        case 'i8':
          p[a] = 0;
          break;
        case 'i16':
          Na[a >> 1] = 0;
          break;
        case 'i32':
          E[a >> 2] = 0;
          break;
        case 'i64':
          H[a >> 3] = BigInt(0);
          break;
        case 'float':
          Oa[a >> 2] = 0;
          break;
        case 'double':
          Pa[a >> 3] = 0;
          break;
        case '*':
          F[a >> 2] = 0;
          break;
        default:
          Ta(`invalid type for setValue: ${b}`);
      }
    }
    var db = 'undefined' != typeof TextDecoder ? new TextDecoder() : void 0,
      B = (a, b = 0, c = NaN) => {
        var d = b + c;
        for (c = b; a[c] && !(c >= d); ) ++c;
        if (16 < c - b && a.buffer && db) return db.decode(a.subarray(b, c));
        for (d = ''; b < c; ) {
          var e = a[b++];
          if (e & 128) {
            var h = a[b++] & 63;
            if (192 == (e & 224)) d += String.fromCharCode(((e & 31) << 6) | h);
            else {
              var k = a[b++] & 63;
              e =
                224 == (e & 240)
                  ? ((e & 15) << 12) | (h << 6) | k
                  : ((e & 7) << 18) | (h << 12) | (k << 6) | (a[b++] & 63);
              65536 > e
                ? (d += String.fromCharCode(e))
                : ((e -= 65536),
                  (d += String.fromCharCode(
                    55296 | (e >> 10),
                    56320 | (e & 1023)
                  )));
            }
          } else d += String.fromCharCode(e);
        }
        return d;
      },
      ua = (a, b) => (a ? B(x, a, b) : ''),
      eb = (a, b) => {
        for (var c = 0, d = a.length - 1; 0 <= d; d--) {
          var e = a[d];
          '.' === e
            ? a.splice(d, 1)
            : '..' === e
              ? (a.splice(d, 1), c++)
              : c && (a.splice(d, 1), c--);
        }
        if (b) for (; c; c--) a.unshift('..');
        return a;
      },
      ka = a => {
        var b = '/' === a.charAt(0),
          c = '/' === a.slice(-1);
        (a = eb(
          a.split('/').filter(d => !!d),
          !b
        ).join('/')) ||
          b ||
          (a = '.');
        a && c && (a += '/');
        return (b ? '/' : '') + a;
      },
      fb = a => {
        var b = /^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/
          .exec(a)
          .slice(1);
        a = b[0];
        b = b[1];
        if (!a && !b) return '.';
        b &&= b.slice(0, -1);
        return a + b;
      },
      gb = a => a && a.match(/([^\/]+|\/)\/*$/)[1],
      hb = () => {
        if (ca) {
          var a = require('crypto');
          return b => a.randomFillSync(b);
        }
        return b => crypto.getRandomValues(b);
      },
      ib = a => {
        (ib = hb())(a);
      },
      jb = (...a) => {
        for (var b = '', c = !1, d = a.length - 1; -1 <= d && !c; d--) {
          c = 0 <= d ? a[d] : '/';
          if ('string' != typeof c)
            throw new TypeError('Arguments to path.resolve must be strings');
          if (!c) return '';
          b = c + '/' + b;
          c = '/' === c.charAt(0);
        }
        b = eb(
          b.split('/').filter(e => !!e),
          !c
        ).join('/');
        return (c ? '/' : '') + b || '.';
      },
      kb = [],
      ha = a => {
        for (var b = 0, c = 0; c < a.length; ++c) {
          var d = a.charCodeAt(c);
          127 >= d
            ? b++
            : 2047 >= d
              ? (b += 2)
              : 55296 <= d && 57343 >= d
                ? ((b += 4), ++c)
                : (b += 3);
        }
        return b;
      },
      u = (a, b, c, d) => {
        if (!(0 < d)) return 0;
        var e = c;
        d = c + d - 1;
        for (var h = 0; h < a.length; ++h) {
          var k = a.charCodeAt(h);
          if (55296 <= k && 57343 >= k) {
            var q = a.charCodeAt(++h);
            k = (65536 + ((k & 1023) << 10)) | (q & 1023);
          }
          if (127 >= k) {
            if (c >= d) break;
            b[c++] = k;
          } else {
            if (2047 >= k) {
              if (c + 1 >= d) break;
              b[c++] = 192 | (k >> 6);
            } else {
              if (65535 >= k) {
                if (c + 2 >= d) break;
                b[c++] = 224 | (k >> 12);
              } else {
                if (c + 3 >= d) break;
                b[c++] = 240 | (k >> 18);
                b[c++] = 128 | ((k >> 12) & 63);
              }
              b[c++] = 128 | ((k >> 6) & 63);
            }
            b[c++] = 128 | (k & 63);
          }
        }
        b[c] = 0;
        return c - e;
      },
      ra = (a, b) => {
        var c = Array(ha(a) + 1);
        a = u(a, c, 0, c.length);
        b && (c.length = a);
        return c;
      },
      mb = [];
    function nb(a, b) {
      mb[a] = { input: [], output: [], cb: b };
      wb(a, xb);
    }
    var xb = {
        open(a) {
          var b = mb[a.node.rdev];
          if (!b) throw new N(43);
          a.tty = b;
          a.seekable = !1;
        },
        close(a) {
          a.tty.cb.fsync(a.tty);
        },
        fsync(a) {
          a.tty.cb.fsync(a.tty);
        },
        read(a, b, c, d) {
          if (!a.tty || !a.tty.cb.xb) throw new N(60);
          for (var e = 0, h = 0; h < d; h++) {
            try {
              var k = a.tty.cb.xb(a.tty);
            } catch (q) {
              throw new N(29);
            }
            if (void 0 === k && 0 === e) throw new N(6);
            if (null === k || void 0 === k) break;
            e++;
            b[c + h] = k;
          }
          e && (a.node.atime = Date.now());
          return e;
        },
        write(a, b, c, d) {
          if (!a.tty || !a.tty.cb.qb) throw new N(60);
          try {
            for (var e = 0; e < d; e++) a.tty.cb.qb(a.tty, b[c + e]);
          } catch (h) {
            throw new N(29);
          }
          d && (a.node.mtime = a.node.ctime = Date.now());
          return e;
        },
      },
      yb = {
        xb() {
          a: {
            if (!kb.length) {
              var a = null;
              if (ca) {
                var b = Buffer.alloc(256),
                  c = 0,
                  d = process.stdin.fd;
                try {
                  c = fs.readSync(d, b, 0, 256);
                } catch (e) {
                  if (e.toString().includes('EOF')) c = 0;
                  else throw e;
                }
                0 < c && (a = b.slice(0, c).toString('utf-8'));
              } else
                'undefined' != typeof window &&
                  'function' == typeof window.prompt &&
                  ((a = window.prompt('Input: ')), null !== a && (a += '\n'));
              if (!a) {
                a = null;
                break a;
              }
              kb = ra(a, !0);
            }
            a = kb.shift();
          }
          return a;
        },
        qb(a, b) {
          null === b || 10 === b
            ? (Ha(B(a.output)), (a.output = []))
            : 0 != b && a.output.push(b);
        },
        fsync(a) {
          0 < a.output?.length && (Ha(B(a.output)), (a.output = []));
        },
        Tb() {
          return {
            Ob: 25856,
            Qb: 5,
            Nb: 191,
            Pb: 35387,
            Mb: [
              3, 28, 127, 21, 4, 0, 1, 0, 17, 19, 26, 0, 18, 15, 23, 22, 0, 0,
              0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
            ],
          };
        },
        Ub() {
          return 0;
        },
        Vb() {
          return [24, 80];
        },
      },
      zb = {
        qb(a, b) {
          null === b || 10 === b
            ? (Ia(B(a.output)), (a.output = []))
            : 0 != b && a.output.push(b);
        },
        fsync(a) {
          0 < a.output?.length && (Ia(B(a.output)), (a.output = []));
        },
      },
      O = {
        Wa: null,
        Xa() {
          return O.createNode(null, '/', 16895, 0);
        },
        createNode(a, b, c, d) {
          if (24576 === (c & 61440) || 4096 === (c & 61440)) throw new N(63);
          O.Wa ||
            (O.Wa = {
              dir: {
                node: {
                  Ta: O.La.Ta,
                  Ua: O.La.Ua,
                  lookup: O.La.lookup,
                  hb: O.La.hb,
                  rename: O.La.rename,
                  unlink: O.La.unlink,
                  rmdir: O.La.rmdir,
                  readdir: O.La.readdir,
                  symlink: O.La.symlink,
                },
                stream: { Va: O.Ma.Va },
              },
              file: {
                node: { Ta: O.La.Ta, Ua: O.La.Ua },
                stream: {
                  Va: O.Ma.Va,
                  read: O.Ma.read,
                  write: O.Ma.write,
                  ib: O.Ma.ib,
                  jb: O.Ma.jb,
                },
              },
              link: {
                node: { Ta: O.La.Ta, Ua: O.La.Ua, readlink: O.La.readlink },
                stream: {},
              },
              ub: { node: { Ta: O.La.Ta, Ua: O.La.Ua }, stream: Ab },
            });
          c = Bb(a, b, c, d);
          P(c.mode)
            ? ((c.La = O.Wa.dir.node), (c.Ma = O.Wa.dir.stream), (c.Na = {}))
            : 32768 === (c.mode & 61440)
              ? ((c.La = O.Wa.file.node),
                (c.Ma = O.Wa.file.stream),
                (c.Ra = 0),
                (c.Na = null))
              : 40960 === (c.mode & 61440)
                ? ((c.La = O.Wa.link.node), (c.Ma = O.Wa.link.stream))
                : 8192 === (c.mode & 61440) &&
                  ((c.La = O.Wa.ub.node), (c.Ma = O.Wa.ub.stream));
          c.atime = c.mtime = c.ctime = Date.now();
          a && ((a.Na[b] = c), (a.atime = a.mtime = a.ctime = c.atime));
          return c;
        },
        Sb(a) {
          return a.Na
            ? a.Na.subarray
              ? a.Na.subarray(0, a.Ra)
              : new Uint8Array(a.Na)
            : new Uint8Array(0);
        },
        La: {
          Ta(a) {
            var b = {};
            b.dev = 8192 === (a.mode & 61440) ? a.id : 1;
            b.ino = a.id;
            b.mode = a.mode;
            b.nlink = 1;
            b.uid = 0;
            b.gid = 0;
            b.rdev = a.rdev;
            P(a.mode)
              ? (b.size = 4096)
              : 32768 === (a.mode & 61440)
                ? (b.size = a.Ra)
                : 40960 === (a.mode & 61440)
                  ? (b.size = a.link.length)
                  : (b.size = 0);
            b.atime = new Date(a.atime);
            b.mtime = new Date(a.mtime);
            b.ctime = new Date(a.ctime);
            b.blksize = 4096;
            b.blocks = Math.ceil(b.size / b.blksize);
            return b;
          },
          Ua(a, b) {
            for (var c of ['mode', 'atime', 'mtime', 'ctime'])
              null != b[c] && (a[c] = b[c]);
            void 0 !== b.size &&
              ((b = b.size),
              a.Ra != b &&
                (0 == b
                  ? ((a.Na = null), (a.Ra = 0))
                  : ((c = a.Na),
                    (a.Na = new Uint8Array(b)),
                    c && a.Na.set(c.subarray(0, Math.min(b, a.Ra))),
                    (a.Ra = b))));
          },
          lookup() {
            throw O.vb;
          },
          hb(a, b, c, d) {
            return O.createNode(a, b, c, d);
          },
          rename(a, b, c) {
            try {
              var d = Q(b, c);
            } catch (h) {}
            if (d) {
              if (P(a.mode)) for (var e in d.Na) throw new N(55);
              Cb(d);
            }
            delete a.parent.Na[a.name];
            b.Na[c] = a;
            a.name = c;
            b.ctime = b.mtime = a.parent.ctime = a.parent.mtime = Date.now();
          },
          unlink(a, b) {
            delete a.Na[b];
            a.ctime = a.mtime = Date.now();
          },
          rmdir(a, b) {
            var c = Q(a, b),
              d;
            for (d in c.Na) throw new N(55);
            delete a.Na[b];
            a.ctime = a.mtime = Date.now();
          },
          readdir(a) {
            return ['.', '..', ...Object.keys(a.Na)];
          },
          symlink(a, b, c) {
            a = O.createNode(a, b, 41471, 0);
            a.link = c;
            return a;
          },
          readlink(a) {
            if (40960 !== (a.mode & 61440)) throw new N(28);
            return a.link;
          },
        },
        Ma: {
          read(a, b, c, d, e) {
            var h = a.node.Na;
            if (e >= a.node.Ra) return 0;
            a = Math.min(a.node.Ra - e, d);
            if (8 < a && h.subarray) b.set(h.subarray(e, e + a), c);
            else for (d = 0; d < a; d++) b[c + d] = h[e + d];
            return a;
          },
          write(a, b, c, d, e, h) {
            b.buffer === p.buffer && (h = !1);
            if (!d) return 0;
            a = a.node;
            a.mtime = a.ctime = Date.now();
            if (b.subarray && (!a.Na || a.Na.subarray)) {
              if (h) return (a.Na = b.subarray(c, c + d)), (a.Ra = d);
              if (0 === a.Ra && 0 === e)
                return (a.Na = b.slice(c, c + d)), (a.Ra = d);
              if (e + d <= a.Ra) return a.Na.set(b.subarray(c, c + d), e), d;
            }
            h = e + d;
            var k = a.Na ? a.Na.length : 0;
            k >= h ||
              ((h = Math.max(h, (k * (1048576 > k ? 2 : 1.125)) >>> 0)),
              0 != k && (h = Math.max(h, 256)),
              (k = a.Na),
              (a.Na = new Uint8Array(h)),
              0 < a.Ra && a.Na.set(k.subarray(0, a.Ra), 0));
            if (a.Na.subarray && b.subarray) a.Na.set(b.subarray(c, c + d), e);
            else for (h = 0; h < d; h++) a.Na[e + h] = b[c + h];
            a.Ra = Math.max(a.Ra, e + d);
            return d;
          },
          Va(a, b, c) {
            1 === c
              ? (b += a.position)
              : 2 === c && 32768 === (a.node.mode & 61440) && (b += a.node.Ra);
            if (0 > b) throw new N(28);
            return b;
          },
          ib(a, b, c, d, e) {
            if (32768 !== (a.node.mode & 61440)) throw new N(43);
            a = a.node.Na;
            if (e & 2 || !a || a.buffer !== p.buffer) {
              e = !0;
              d = 65536 * Math.ceil(b / 65536);
              var h = Db(65536, d);
              h && x.fill(0, h, h + d);
              d = h;
              if (!d) throw new N(48);
              if (a) {
                if (0 < c || c + b < a.length)
                  a.subarray
                    ? (a = a.subarray(c, c + b))
                    : (a = Array.prototype.slice.call(a, c, c + b));
                p.set(a, d);
              }
            } else (e = !1), (d = a.byteOffset);
            return { Kb: d, Ab: e };
          },
          jb(a, b, c, d) {
            O.Ma.write(a, b, 0, d, c, !1);
            return 0;
          },
        },
      },
      la = (a, b) => {
        var c = 0;
        a && (c |= 365);
        b && (c |= 146);
        return c;
      },
      Eb = null,
      Fb = {},
      Gb = [],
      Hb = 1,
      R = null,
      Ib = !1,
      Jb = !0,
      Kb = {},
      N = class {
        name = 'ErrnoError';
        constructor(a) {
          this.Pa = a;
        }
      },
      Lb = class {
        gb = {};
        node = null;
        get flags() {
          return this.gb.flags;
        }
        set flags(a) {
          this.gb.flags = a;
        }
        get position() {
          return this.gb.position;
        }
        set position(a) {
          this.gb.position = a;
        }
      },
      Mb = class {
        La = {};
        Ma = {};
        ab = null;
        constructor(a, b, c, d) {
          a ||= this;
          this.parent = a;
          this.Xa = a.Xa;
          this.id = Hb++;
          this.name = b;
          this.mode = c;
          this.rdev = d;
          this.atime = this.mtime = this.ctime = Date.now();
        }
        get read() {
          return 365 === (this.mode & 365);
        }
        set read(a) {
          a ? (this.mode |= 365) : (this.mode &= -366);
        }
        get write() {
          return 146 === (this.mode & 146);
        }
        set write(a) {
          a ? (this.mode |= 146) : (this.mode &= -147);
        }
      };
    function S(a, b = {}) {
      if (!a) throw new N(44);
      b.nb ?? (b.nb = !0);
      '/' === a.charAt(0) || (a = '//' + a);
      var c = 0;
      a: for (; 40 > c; c++) {
        a = a.split('/').filter(q => !!q);
        for (var d = Eb, e = '/', h = 0; h < a.length; h++) {
          var k = h === a.length - 1;
          if (k && b.parent) break;
          if ('.' !== a[h])
            if ('..' === a[h]) (e = fb(e)), (d = d.parent);
            else {
              e = ka(e + '/' + a[h]);
              try {
                d = Q(d, a[h]);
              } catch (q) {
                if (44 === q?.Pa && k && b.Jb) return { path: e };
                throw q;
              }
              !d.ab || (k && !b.nb) || (d = d.ab.root);
              if (40960 === (d.mode & 61440) && (!k || b.$a)) {
                if (!d.La.readlink) throw new N(52);
                d = d.La.readlink(d);
                '/' === d.charAt(0) || (d = fb(e) + '/' + d);
                a = d + '/' + a.slice(h + 1).join('/');
                continue a;
              }
            }
        }
        return { path: e, node: d };
      }
      throw new N(32);
    }
    function ja(a) {
      for (var b; ; ) {
        if (a === a.parent)
          return (
            (a = a.Xa.zb),
            b ? ('/' !== a[a.length - 1] ? `${a}/${b}` : a + b) : a
          );
        b = b ? `${a.name}/${b}` : a.name;
        a = a.parent;
      }
    }
    function Nb(a, b) {
      for (var c = 0, d = 0; d < b.length; d++)
        c = ((c << 5) - c + b.charCodeAt(d)) | 0;
      return ((a + c) >>> 0) % R.length;
    }
    function Cb(a) {
      var b = Nb(a.parent.id, a.name);
      if (R[b] === a) R[b] = a.bb;
      else
        for (b = R[b]; b; ) {
          if (b.bb === a) {
            b.bb = a.bb;
            break;
          }
          b = b.bb;
        }
    }
    function Q(a, b) {
      var c = P(a.mode) ? ((c = Ob(a, 'x')) ? c : a.La.lookup ? 0 : 2) : 54;
      if (c) throw new N(c);
      for (c = R[Nb(a.id, b)]; c; c = c.bb) {
        var d = c.name;
        if (c.parent.id === a.id && d === b) return c;
      }
      return a.La.lookup(a, b);
    }
    function Bb(a, b, c, d) {
      a = new Mb(a, b, c, d);
      b = Nb(a.parent.id, a.name);
      a.bb = R[b];
      return (R[b] = a);
    }
    function P(a) {
      return 16384 === (a & 61440);
    }
    function Pb(a) {
      var b = ['r', 'w', 'rw'][a & 3];
      a & 512 && (b += 'w');
      return b;
    }
    function Ob(a, b) {
      if (Jb) return 0;
      if (!b.includes('r') || a.mode & 292) {
        if (
          (b.includes('w') && !(a.mode & 146)) ||
          (b.includes('x') && !(a.mode & 73))
        )
          return 2;
      } else return 2;
      return 0;
    }
    function Qb(a, b) {
      if (!P(a.mode)) return 54;
      try {
        return Q(a, b), 20;
      } catch (c) {}
      return Ob(a, 'wx');
    }
    function Rb(a, b, c) {
      try {
        var d = Q(a, b);
      } catch (e) {
        return e.Pa;
      }
      if ((a = Ob(a, 'wx'))) return a;
      if (c) {
        if (!P(d.mode)) return 54;
        if (d === d.parent || '/' === ja(d)) return 10;
      } else if (P(d.mode)) return 31;
      return 0;
    }
    function Sb(a) {
      if (!a) throw new N(63);
      return a;
    }
    function T(a) {
      a = Gb[a];
      if (!a) throw new N(8);
      return a;
    }
    function Tb(a, b = -1) {
      a = Object.assign(new Lb(), a);
      if (-1 == b)
        a: {
          for (b = 0; 4096 >= b; b++) if (!Gb[b]) break a;
          throw new N(33);
        }
      a.fd = b;
      return (Gb[b] = a);
    }
    function Ub(a, b = -1) {
      a = Tb(a, b);
      a.Ma?.Rb?.(a);
      return a;
    }
    function Vb(a, b, c) {
      var d = a?.Ma.Ua;
      a = d ? a : b;
      d ??= b.La.Ua;
      Sb(d);
      d(a, c);
    }
    var Ab = {
      open(a) {
        a.Ma = Fb[a.node.rdev].Ma;
        a.Ma.open?.(a);
      },
      Va() {
        throw new N(70);
      },
    };
    function wb(a, b) {
      Fb[a] = { Ma: b };
    }
    function Wb(a, b) {
      var c = '/' === b;
      if (c && Eb) throw new N(10);
      if (!c && b) {
        var d = S(b, { nb: !1 });
        b = d.path;
        d = d.node;
        if (d.ab) throw new N(10);
        if (!P(d.mode)) throw new N(54);
      }
      b = { type: a, Wb: {}, zb: b, Ib: [] };
      a = a.Xa(b);
      a.Xa = b;
      b.root = a;
      c ? (Eb = a) : d && ((d.ab = b), d.Xa && d.Xa.Ib.push(b));
    }
    function Xb(a, b, c) {
      var d = S(a, { parent: !0 }).node;
      a = gb(a);
      if (!a) throw new N(28);
      if ('.' === a || '..' === a) throw new N(20);
      var e = Qb(d, a);
      if (e) throw new N(e);
      if (!d.La.hb) throw new N(63);
      return d.La.hb(d, a, b, c);
    }
    function ma(a, b = 438) {
      return Xb(a, (b & 4095) | 32768, 0);
    }
    function U(a, b = 511) {
      return Xb(a, (b & 1023) | 16384, 0);
    }
    function Yb(a, b, c) {
      'undefined' == typeof c && ((c = b), (b = 438));
      Xb(a, b | 8192, c);
    }
    function Zb(a, b) {
      if (!jb(a)) throw new N(44);
      var c = S(b, { parent: !0 }).node;
      if (!c) throw new N(44);
      b = gb(b);
      var d = Qb(c, b);
      if (d) throw new N(d);
      if (!c.La.symlink) throw new N(63);
      c.La.symlink(c, b, a);
    }
    function $b(a) {
      var b = S(a, { parent: !0 }).node;
      a = gb(a);
      var c = Q(b, a),
        d = Rb(b, a, !0);
      if (d) throw new N(d);
      if (!b.La.rmdir) throw new N(63);
      if (c.ab) throw new N(10);
      b.La.rmdir(b, a);
      Cb(c);
    }
    function za(a) {
      var b = S(a, { parent: !0 }).node;
      if (!b) throw new N(44);
      a = gb(a);
      var c = Q(b, a),
        d = Rb(b, a, !1);
      if (d) throw new N(d);
      if (!b.La.unlink) throw new N(63);
      if (c.ab) throw new N(10);
      b.La.unlink(b, a);
      Cb(c);
    }
    function ac(a, b) {
      a = S(a, { $a: !b }).node;
      return Sb(a.La.Ta)(a);
    }
    function bc(a, b, c, d) {
      Vb(a, b, {
        mode: (c & 4095) | (b.mode & -4096),
        ctime: Date.now(),
        Fb: d,
      });
    }
    function na(a, b) {
      a = 'string' == typeof a ? S(a, { $a: !0 }).node : a;
      bc(null, a, b);
    }
    function cc(a, b, c) {
      if (P(b.mode)) throw new N(31);
      if (32768 !== (b.mode & 61440)) throw new N(28);
      var d = Ob(b, 'w');
      if (d) throw new N(d);
      Vb(a, b, { size: c, timestamp: Date.now() });
    }
    function oa(a, b, c = 438) {
      if ('' === a) throw new N(44);
      if ('string' == typeof b) {
        var d = { r: 0, 'r+': 2, w: 577, 'w+': 578, a: 1089, 'a+': 1090 }[b];
        if ('undefined' == typeof d)
          throw Error(`Unknown file open mode: ${b}`);
        b = d;
      }
      c = b & 64 ? (c & 4095) | 32768 : 0;
      if ('object' == typeof a) d = a;
      else {
        var e = a.endsWith('/');
        a = S(a, { $a: !(b & 131072), Jb: !0 });
        d = a.node;
        a = a.path;
      }
      var h = !1;
      if (b & 64)
        if (d) {
          if (b & 128) throw new N(20);
        } else {
          if (e) throw new N(31);
          d = Xb(a, c | 511, 0);
          h = !0;
        }
      if (!d) throw new N(44);
      8192 === (d.mode & 61440) && (b &= -513);
      if (b & 65536 && !P(d.mode)) throw new N(54);
      if (
        !h &&
        (e = d
          ? 40960 === (d.mode & 61440)
            ? 32
            : P(d.mode) && ('r' !== Pb(b) || b & 576)
              ? 31
              : Ob(d, Pb(b))
          : 44)
      )
        throw new N(e);
      b & 512 &&
        !h &&
        ((e = d),
        (e = 'string' == typeof e ? S(e, { $a: !0 }).node : e),
        cc(null, e, 0));
      b &= -131713;
      e = Tb({
        node: d,
        path: ja(d),
        flags: b,
        seekable: !0,
        position: 0,
        Ma: d.Ma,
        Lb: [],
        error: !1,
      });
      e.Ma.open && e.Ma.open(e);
      h && na(d, c & 511);
      !f.logReadFiles || b & 1 || a in Kb || (Kb[a] = 1);
      return e;
    }
    function qa(a) {
      if (null === a.fd) throw new N(8);
      a.ob && (a.ob = null);
      try {
        a.Ma.close && a.Ma.close(a);
      } catch (b) {
        throw b;
      } finally {
        Gb[a.fd] = null;
      }
      a.fd = null;
    }
    function mc(a, b, c) {
      if (null === a.fd) throw new N(8);
      if (!a.seekable || !a.Ma.Va) throw new N(70);
      if (0 != c && 1 != c && 2 != c) throw new N(28);
      a.position = a.Ma.Va(a, b, c);
      a.Lb = [];
    }
    function Ec(a, b, c, d, e) {
      if (0 > d || 0 > e) throw new N(28);
      if (null === a.fd) throw new N(8);
      if (1 === (a.flags & 2097155)) throw new N(8);
      if (P(a.node.mode)) throw new N(31);
      if (!a.Ma.read) throw new N(28);
      var h = 'undefined' != typeof e;
      if (!h) e = a.position;
      else if (!a.seekable) throw new N(70);
      b = a.Ma.read(a, b, c, d, e);
      h || (a.position += b);
      return b;
    }
    function pa(a, b, c, d, e) {
      if (0 > d || 0 > e) throw new N(28);
      if (null === a.fd) throw new N(8);
      if (0 === (a.flags & 2097155)) throw new N(8);
      if (P(a.node.mode)) throw new N(31);
      if (!a.Ma.write) throw new N(28);
      a.seekable && a.flags & 1024 && mc(a, 0, 2);
      var h = 'undefined' != typeof e;
      if (!h) e = a.position;
      else if (!a.seekable) throw new N(70);
      b = a.Ma.write(a, b, c, d, e, void 0);
      h || (a.position += b);
      return b;
    }
    function ya(a) {
      var b = 'binary';
      if ('utf8' !== b && 'binary' !== b)
        throw Error(`Invalid encoding type "${b}"`);
      var c;
      var d = oa(a, d || 0);
      a = ac(a).size;
      var e = new Uint8Array(a);
      Ec(d, e, 0, a, 0);
      'utf8' === b ? (c = B(e)) : 'binary' === b && (c = e);
      qa(d);
      return c;
    }
    function V(a, b, c) {
      a = ka('/dev/' + a);
      var d = la(!!b, !!c);
      V.yb ?? (V.yb = 64);
      var e = (V.yb++ << 8) | 0;
      wb(e, {
        open(h) {
          h.seekable = !1;
        },
        close() {
          c?.buffer?.length && c(10);
        },
        read(h, k, q, w) {
          for (var v = 0, C = 0; C < w; C++) {
            try {
              var G = b();
            } catch (pb) {
              throw new N(29);
            }
            if (void 0 === G && 0 === v) throw new N(6);
            if (null === G || void 0 === G) break;
            v++;
            k[q + C] = G;
          }
          v && (h.node.atime = Date.now());
          return v;
        },
        write(h, k, q, w) {
          for (var v = 0; v < w; v++)
            try {
              c(k[q + v]);
            } catch (C) {
              throw new N(29);
            }
          w && (h.node.mtime = h.node.ctime = Date.now());
          return v;
        },
      });
      Yb(a, d, e);
    }
    var W = {};
    function Gc(a, b, c) {
      if ('/' === b.charAt(0)) return b;
      a = -100 === a ? '/' : T(a).path;
      if (0 == b.length) {
        if (!c) throw new N(44);
        return a;
      }
      return a + '/' + b;
    }
    function Hc(a, b) {
      E[a >> 2] = b.dev;
      E[(a + 4) >> 2] = b.mode;
      F[(a + 8) >> 2] = b.nlink;
      E[(a + 12) >> 2] = b.uid;
      E[(a + 16) >> 2] = b.gid;
      E[(a + 20) >> 2] = b.rdev;
      H[(a + 24) >> 3] = BigInt(b.size);
      E[(a + 32) >> 2] = 4096;
      E[(a + 36) >> 2] = b.blocks;
      var c = b.atime.getTime(),
        d = b.mtime.getTime(),
        e = b.ctime.getTime();
      H[(a + 40) >> 3] = BigInt(Math.floor(c / 1e3));
      F[(a + 48) >> 2] = (c % 1e3) * 1e6;
      H[(a + 56) >> 3] = BigInt(Math.floor(d / 1e3));
      F[(a + 64) >> 2] = (d % 1e3) * 1e6;
      H[(a + 72) >> 3] = BigInt(Math.floor(e / 1e3));
      F[(a + 80) >> 2] = (e % 1e3) * 1e6;
      H[(a + 88) >> 3] = BigInt(b.ino);
      return 0;
    }
    var Ic = void 0,
      Jc = () => {
        var a = E[+Ic >> 2];
        Ic += 4;
        return a;
      },
      Kc = 0,
      Lc = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335],
      Mc = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
      Nc = {},
      Oc = a => {
        Ma = a;
        cb || 0 < Kc || (f.onExit?.(a), (La = !0));
        Da(a, new Ya(a));
      },
      Pc = a => {
        if (!La)
          try {
            if ((a(), !(cb || 0 < Kc)))
              try {
                (Ma = a = Ma), Oc(a);
              } catch (b) {
                b instanceof Ya || 'unwind' == b || Da(1, b);
              }
          } catch (b) {
            b instanceof Ya || 'unwind' == b || Da(1, b);
          }
      },
      Qc = {},
      Sc = () => {
        if (!Rc) {
          var a = {
              USER: 'web_user',
              LOGNAME: 'web_user',
              PATH: '/',
              PWD: '/',
              HOME: '/home/web_user',
              LANG:
                (
                  ('object' == typeof navigator &&
                    navigator.languages &&
                    navigator.languages[0]) ||
                  'C'
                ).replace('-', '_') + '.UTF-8',
              _: Ca || './this.program',
            },
            b;
          for (b in Qc) void 0 === Qc[b] ? delete a[b] : (a[b] = Qc[b]);
          var c = [];
          for (b in a) c.push(`${b}=${a[b]}`);
          Rc = c;
        }
        return Rc;
      },
      Rc,
      xa = a => {
        var b = ha(a) + 1,
          c = z(b);
        u(a, x, c, b);
        return c;
      },
      Tc = (a, b, c, d) => {
        var e = {
          string: v => {
            var C = 0;
            null !== v && void 0 !== v && 0 !== v && (C = xa(v));
            return C;
          },
          array: v => {
            var C = z(v.length);
            p.set(v, C);
            return C;
          },
        };
        a = f['_' + a];
        var h = [],
          k = 0;
        if (d)
          for (var q = 0; q < d.length; q++) {
            var w = e[c[q]];
            w ? (0 === k && (k = sa()), (h[q] = w(d[q]))) : (h[q] = d[q]);
          }
        c = a(...h);
        return (c = (function (v) {
          0 !== k && wa(k);
          return 'string' === b
            ? v
              ? B(x, v)
              : ''
            : 'boolean' === b
              ? !!v
              : v;
        })(c));
      },
      ea = 0,
      da = (a, b) => {
        b = 1 == b ? z(a.length) : ia(a.length);
        a.subarray || a.slice || (a = new Uint8Array(a));
        x.set(a, b);
        return b;
      },
      Uc,
      Vc = [],
      Y,
      A = a => {
        Uc.delete(Y.get(a));
        Y.set(a, null);
        Vc.push(a);
      },
      Aa = (a, b) => {
        if (!Uc) {
          Uc = new WeakMap();
          var c = Y.length;
          if (Uc)
            for (var d = 0; d < 0 + c; d++) {
              var e = Y.get(d);
              e && Uc.set(e, d);
            }
        }
        if ((c = Uc.get(a) || 0)) return c;
        if (Vc.length) c = Vc.pop();
        else {
          try {
            Y.grow(1);
          } catch (w) {
            if (!(w instanceof RangeError)) throw w;
            throw 'Unable to grow wasm table. Set ALLOW_TABLE_GROWTH.';
          }
          c = Y.length - 1;
        }
        try {
          Y.set(c, a);
        } catch (w) {
          if (!(w instanceof TypeError)) throw w;
          if ('function' == typeof WebAssembly.Function) {
            var h = WebAssembly.Function;
            d = {
              i: 'i32',
              j: 'i64',
              f: 'f32',
              d: 'f64',
              e: 'externref',
              p: 'i32',
            };
            e = { parameters: [], results: 'v' == b[0] ? [] : [d[b[0]]] };
            for (var k = 1; k < b.length; ++k) e.parameters.push(d[b[k]]);
            b = new h(e, a);
          } else {
            d = [1];
            e = b.slice(0, 1);
            b = b.slice(1);
            k = { i: 127, p: 127, j: 126, f: 125, d: 124, e: 111 };
            d.push(96);
            var q = b.length;
            128 > q ? d.push(q) : d.push(q % 128 | 128, q >> 7);
            for (h of b) d.push(k[h]);
            'v' == e ? d.push(0) : d.push(1, k[e]);
            b = [0, 97, 115, 109, 1, 0, 0, 0, 1];
            h = d.length;
            128 > h ? b.push(h) : b.push(h % 128 | 128, h >> 7);
            b.push(...d);
            b.push(2, 7, 1, 1, 101, 1, 102, 0, 0, 7, 5, 1, 1, 102, 0, 0);
            b = new WebAssembly.Module(new Uint8Array(b));
            b = new WebAssembly.Instance(b, { e: { f: a } }).exports.f;
          }
          Y.set(c, b);
        }
        Uc.set(a, c);
        return c;
      };
    R = Array(4096);
    Wb(O, '/');
    U('/tmp');
    U('/home');
    U('/home/web_user');
    (function () {
      U('/dev');
      wb(259, { read: () => 0, write: (d, e, h, k) => k, Va: () => 0 });
      Yb('/dev/null', 259);
      nb(1280, yb);
      nb(1536, zb);
      Yb('/dev/tty', 1280);
      Yb('/dev/tty1', 1536);
      var a = new Uint8Array(1024),
        b = 0,
        c = () => {
          0 === b && (ib(a), (b = a.byteLength));
          return a[--b];
        };
      V('random', c);
      V('urandom', c);
      U('/dev/shm');
      U('/dev/shm/tmp');
    })();
    (function () {
      U('/proc');
      var a = U('/proc/self');
      U('/proc/self/fd');
      Wb(
        {
          Xa() {
            var b = Bb(a, 'fd', 16895, 73);
            b.Ma = { Va: O.Ma.Va };
            b.La = {
              lookup(c, d) {
                c = +d;
                var e = T(c);
                c = {
                  parent: null,
                  Xa: { zb: 'fake' },
                  La: { readlink: () => e.path },
                  id: c + 1,
                };
                return (c.parent = c);
              },
              readdir() {
                return Array.from(Gb.entries())
                  .filter(([, c]) => c)
                  .map(([c]) => c.toString());
              },
            };
            return b;
          },
        },
        '/proc/self/fd'
      );
    })();
    O.vb = new N(44);
    O.vb.stack = '<generic error, no stack>';
    var Xc = {
        a: (a, b, c, d) =>
          Ta(
            `Assertion failed: ${a ? B(x, a) : ''}, at: ` +
              [
                b ? (b ? B(x, b) : '') : 'unknown filename',
                c,
                d ? (d ? B(x, d) : '') : 'unknown function',
              ]
          ),
        i: function (a, b) {
          try {
            return (a = a ? B(x, a) : ''), na(a, b), 0;
          } catch (c) {
            if ('undefined' == typeof W || 'ErrnoError' !== c.name) throw c;
            return -c.Pa;
          }
        },
        L: function (a, b, c) {
          try {
            b = b ? B(x, b) : '';
            b = Gc(a, b);
            if (c & -8) return -28;
            var d = S(b, { $a: !0 }).node;
            if (!d) return -44;
            a = '';
            c & 4 && (a += 'r');
            c & 2 && (a += 'w');
            c & 1 && (a += 'x');
            return a && Ob(d, a) ? -2 : 0;
          } catch (e) {
            if ('undefined' == typeof W || 'ErrnoError' !== e.name) throw e;
            return -e.Pa;
          }
        },
        j: function (a, b) {
          try {
            var c = T(a);
            bc(c, c.node, b, !1);
            return 0;
          } catch (d) {
            if ('undefined' == typeof W || 'ErrnoError' !== d.name) throw d;
            return -d.Pa;
          }
        },
        h: function (a) {
          try {
            var b = T(a);
            Vb(b, b.node, { timestamp: Date.now(), Fb: !1 });
            return 0;
          } catch (c) {
            if ('undefined' == typeof W || 'ErrnoError' !== c.name) throw c;
            return -c.Pa;
          }
        },
        b: function (a, b, c) {
          Ic = c;
          try {
            var d = T(a);
            switch (b) {
              case 0:
                var e = Jc();
                if (0 > e) break;
                for (; Gb[e]; ) e++;
                return Ub(d, e).fd;
              case 1:
              case 2:
                return 0;
              case 3:
                return d.flags;
              case 4:
                return (e = Jc()), (d.flags |= e), 0;
              case 12:
                return (e = Jc()), (Na[(e + 0) >> 1] = 2), 0;
              case 13:
              case 14:
                return 0;
            }
            return -28;
          } catch (h) {
            if ('undefined' == typeof W || 'ErrnoError' !== h.name) throw h;
            return -h.Pa;
          }
        },
        g: function (a, b) {
          try {
            var c = T(a),
              d = c.node,
              e = c.Ma.Ta;
            a = e ? c : d;
            e ??= d.La.Ta;
            Sb(e);
            var h = e(a);
            return Hc(b, h);
          } catch (k) {
            if ('undefined' == typeof W || 'ErrnoError' !== k.name) throw k;
            return -k.Pa;
          }
        },
        H: function (a, b) {
          b = -9007199254740992 > b || 9007199254740992 < b ? NaN : Number(b);
          try {
            if (isNaN(b)) return 61;
            var c = T(a);
            if (0 > b || 0 === (c.flags & 2097155)) throw new N(28);
            cc(c, c.node, b);
            return 0;
          } catch (d) {
            if ('undefined' == typeof W || 'ErrnoError' !== d.name) throw d;
            return -d.Pa;
          }
        },
        G: function (a, b) {
          try {
            if (0 === b) return -28;
            var c = ha('/') + 1;
            if (b < c) return -68;
            u('/', x, a, b);
            return c;
          } catch (d) {
            if ('undefined' == typeof W || 'ErrnoError' !== d.name) throw d;
            return -d.Pa;
          }
        },
        K: function (a, b) {
          try {
            return (a = a ? B(x, a) : ''), Hc(b, ac(a, !0));
          } catch (c) {
            if ('undefined' == typeof W || 'ErrnoError' !== c.name) throw c;
            return -c.Pa;
          }
        },
        C: function (a, b, c) {
          try {
            return (b = b ? B(x, b) : ''), (b = Gc(a, b)), U(b, c), 0;
          } catch (d) {
            if ('undefined' == typeof W || 'ErrnoError' !== d.name) throw d;
            return -d.Pa;
          }
        },
        J: function (a, b, c, d) {
          try {
            b = b ? B(x, b) : '';
            var e = d & 256;
            b = Gc(a, b, d & 4096);
            return Hc(c, e ? ac(b, !0) : ac(b));
          } catch (h) {
            if ('undefined' == typeof W || 'ErrnoError' !== h.name) throw h;
            return -h.Pa;
          }
        },
        x: function (a, b, c, d) {
          Ic = d;
          try {
            b = b ? B(x, b) : '';
            b = Gc(a, b);
            var e = d ? Jc() : 0;
            return oa(b, c, e).fd;
          } catch (h) {
            if ('undefined' == typeof W || 'ErrnoError' !== h.name) throw h;
            return -h.Pa;
          }
        },
        v: function (a, b, c, d) {
          try {
            b = b ? B(x, b) : '';
            b = Gc(a, b);
            if (0 >= d) return -28;
            var e = S(b).node;
            if (!e) throw new N(44);
            if (!e.La.readlink) throw new N(28);
            var h = e.La.readlink(e);
            var k = Math.min(d, ha(h)),
              q = p[c + k];
            u(h, x, c, d + 1);
            p[c + k] = q;
            return k;
          } catch (w) {
            if ('undefined' == typeof W || 'ErrnoError' !== w.name) throw w;
            return -w.Pa;
          }
        },
        u: function (a) {
          try {
            return (a = a ? B(x, a) : ''), $b(a), 0;
          } catch (b) {
            if ('undefined' == typeof W || 'ErrnoError' !== b.name) throw b;
            return -b.Pa;
          }
        },
        f: function (a, b) {
          try {
            return (a = a ? B(x, a) : ''), Hc(b, ac(a));
          } catch (c) {
            if ('undefined' == typeof W || 'ErrnoError' !== c.name) throw c;
            return -c.Pa;
          }
        },
        r: function (a, b, c) {
          try {
            return (
              (b = b ? B(x, b) : ''),
              (b = Gc(a, b)),
              0 === c
                ? za(b)
                : 512 === c
                  ? $b(b)
                  : Ta('Invalid flags passed to unlinkat'),
              0
            );
          } catch (d) {
            if ('undefined' == typeof W || 'ErrnoError' !== d.name) throw d;
            return -d.Pa;
          }
        },
        q: function (a, b, c) {
          try {
            b = b ? B(x, b) : '';
            b = Gc(a, b, !0);
            var d = Date.now(),
              e,
              h;
            if (c) {
              var k = F[c >> 2] + 4294967296 * E[(c + 4) >> 2],
                q = E[(c + 8) >> 2];
              1073741823 == q
                ? (e = d)
                : 1073741822 == q
                  ? (e = null)
                  : (e = 1e3 * k + q / 1e6);
              c += 16;
              k = F[c >> 2] + 4294967296 * E[(c + 4) >> 2];
              q = E[(c + 8) >> 2];
              1073741823 == q
                ? (h = d)
                : 1073741822 == q
                  ? (h = null)
                  : (h = 1e3 * k + q / 1e6);
            } else h = e = d;
            if (null !== (h ?? e)) {
              a = e;
              var w = S(b, { $a: !0 }).node;
              Sb(w.La.Ua)(w, { atime: a, mtime: h });
            }
            return 0;
          } catch (v) {
            if ('undefined' == typeof W || 'ErrnoError' !== v.name) throw v;
            return -v.Pa;
          }
        },
        m: () => Ta(''),
        l: () => {
          cb = !1;
          Kc = 0;
        },
        A: function (a, b) {
          a = -9007199254740992 > a || 9007199254740992 < a ? NaN : Number(a);
          a = new Date(1e3 * a);
          E[b >> 2] = a.getSeconds();
          E[(b + 4) >> 2] = a.getMinutes();
          E[(b + 8) >> 2] = a.getHours();
          E[(b + 12) >> 2] = a.getDate();
          E[(b + 16) >> 2] = a.getMonth();
          E[(b + 20) >> 2] = a.getFullYear() - 1900;
          E[(b + 24) >> 2] = a.getDay();
          var c = a.getFullYear();
          E[(b + 28) >> 2] =
            ((0 !== c % 4 || (0 === c % 100 && 0 !== c % 400) ? Mc : Lc)[
              a.getMonth()
            ] +
              a.getDate() -
              1) |
            0;
          E[(b + 36) >> 2] = -(60 * a.getTimezoneOffset());
          c = new Date(a.getFullYear(), 6, 1).getTimezoneOffset();
          var d = new Date(a.getFullYear(), 0, 1).getTimezoneOffset();
          E[(b + 32) >> 2] =
            (c != d && a.getTimezoneOffset() == Math.min(d, c)) | 0;
        },
        y: function (a, b, c, d, e, h, k) {
          e = -9007199254740992 > e || 9007199254740992 < e ? NaN : Number(e);
          try {
            if (isNaN(e)) return 61;
            var q = T(d);
            if (0 !== (b & 2) && 0 === (c & 2) && 2 !== (q.flags & 2097155))
              throw new N(2);
            if (1 === (q.flags & 2097155)) throw new N(2);
            if (!q.Ma.ib) throw new N(43);
            if (!a) throw new N(28);
            var w = q.Ma.ib(q, a, e, b, c);
            var v = w.Kb;
            E[h >> 2] = w.Ab;
            F[k >> 2] = v;
            return 0;
          } catch (C) {
            if ('undefined' == typeof W || 'ErrnoError' !== C.name) throw C;
            return -C.Pa;
          }
        },
        z: function (a, b, c, d, e, h) {
          h = -9007199254740992 > h || 9007199254740992 < h ? NaN : Number(h);
          try {
            var k = T(e);
            if (c & 2) {
              c = h;
              if (32768 !== (k.node.mode & 61440)) throw new N(43);
              if (!(d & 2)) {
                var q = x.slice(a, a + b);
                k.Ma.jb && k.Ma.jb(k, q, c, b, d);
              }
            }
          } catch (w) {
            if ('undefined' == typeof W || 'ErrnoError' !== w.name) throw w;
            return -w.Pa;
          }
        },
        n: (a, b) => {
          Nc[a] && (clearTimeout(Nc[a].id), delete Nc[a]);
          if (!b) return 0;
          var c = setTimeout(() => {
            delete Nc[a];
            Pc(() => Wc(a, performance.now()));
          }, b);
          Nc[a] = { id: c, Xb: b };
          return 0;
        },
        B: (a, b, c, d) => {
          var e = new Date().getFullYear(),
            h = new Date(e, 0, 1).getTimezoneOffset();
          e = new Date(e, 6, 1).getTimezoneOffset();
          F[a >> 2] = 60 * Math.max(h, e);
          E[b >> 2] = Number(h != e);
          b = k => {
            var q = Math.abs(k);
            return `UTC${0 <= k ? '-' : '+'}${String(Math.floor(q / 60)).padStart(2, '0')}${String(q % 60).padStart(2, '0')}`;
          };
          a = b(h);
          b = b(e);
          e < h
            ? (u(a, x, c, 17), u(b, x, d, 17))
            : (u(a, x, d, 17), u(b, x, c, 17));
        },
        d: () => Date.now(),
        s: () => 2147483648,
        c: () => performance.now(),
        o: a => {
          var b = x.length;
          a >>>= 0;
          if (2147483648 < a) return !1;
          for (var c = 1; 4 >= c; c *= 2) {
            var d = b * (1 + 0.2 / c);
            d = Math.min(d, a + 100663296);
            a: {
              d =
                ((Math.min(
                  2147483648,
                  65536 * Math.ceil(Math.max(a, d) / 65536)
                ) -
                  Ka.buffer.byteLength +
                  65535) /
                  65536) |
                0;
              try {
                Ka.grow(d);
                Qa();
                var e = 1;
                break a;
              } catch (h) {}
              e = void 0;
            }
            if (e) return !0;
          }
          return !1;
        },
        E: (a, b) => {
          var c = 0;
          Sc().forEach((d, e) => {
            var h = b + c;
            e = F[(a + 4 * e) >> 2] = h;
            for (h = 0; h < d.length; ++h) p[e++] = d.charCodeAt(h);
            p[e] = 0;
            c += d.length + 1;
          });
          return 0;
        },
        F: (a, b) => {
          var c = Sc();
          F[a >> 2] = c.length;
          var d = 0;
          c.forEach(e => (d += e.length + 1));
          F[b >> 2] = d;
          return 0;
        },
        e: function (a) {
          try {
            var b = T(a);
            qa(b);
            return 0;
          } catch (c) {
            if ('undefined' == typeof W || 'ErrnoError' !== c.name) throw c;
            return c.Pa;
          }
        },
        p: function (a, b) {
          try {
            var c = T(a);
            p[b] = c.tty
              ? 2
              : P(c.mode)
                ? 3
                : 40960 === (c.mode & 61440)
                  ? 7
                  : 4;
            Na[(b + 2) >> 1] = 0;
            H[(b + 8) >> 3] = BigInt(0);
            H[(b + 16) >> 3] = BigInt(0);
            return 0;
          } catch (d) {
            if ('undefined' == typeof W || 'ErrnoError' !== d.name) throw d;
            return d.Pa;
          }
        },
        w: function (a, b, c, d) {
          try {
            a: {
              var e = T(a);
              a = b;
              for (var h, k = (b = 0); k < c; k++) {
                var q = F[a >> 2],
                  w = F[(a + 4) >> 2];
                a += 8;
                var v = Ec(e, p, q, w, h);
                if (0 > v) {
                  var C = -1;
                  break a;
                }
                b += v;
                if (v < w) break;
                'undefined' != typeof h && (h += v);
              }
              C = b;
            }
            F[d >> 2] = C;
            return 0;
          } catch (G) {
            if ('undefined' == typeof W || 'ErrnoError' !== G.name) throw G;
            return G.Pa;
          }
        },
        D: function (a, b, c, d) {
          b = -9007199254740992 > b || 9007199254740992 < b ? NaN : Number(b);
          try {
            if (isNaN(b)) return 61;
            var e = T(a);
            mc(e, b, c);
            H[d >> 3] = BigInt(e.position);
            e.ob && 0 === b && 0 === c && (e.ob = null);
            return 0;
          } catch (h) {
            if ('undefined' == typeof W || 'ErrnoError' !== h.name) throw h;
            return h.Pa;
          }
        },
        I: function (a) {
          try {
            var b = T(a);
            return b.Ma?.fsync ? b.Ma.fsync(b) : 0;
          } catch (c) {
            if ('undefined' == typeof W || 'ErrnoError' !== c.name) throw c;
            return c.Pa;
          }
        },
        t: function (a, b, c, d) {
          try {
            a: {
              var e = T(a);
              a = b;
              for (var h, k = (b = 0); k < c; k++) {
                var q = F[a >> 2],
                  w = F[(a + 4) >> 2];
                a += 8;
                var v = pa(e, p, q, w, h);
                if (0 > v) {
                  var C = -1;
                  break a;
                }
                b += v;
                if (v < w) break;
                'undefined' != typeof h && (h += v);
              }
              C = b;
            }
            F[d >> 2] = C;
            return 0;
          } catch (G) {
            if ('undefined' == typeof W || 'ErrnoError' !== G.name) throw G;
            return G.Pa;
          }
        },
        k: Oc,
      },
      Z;
    (async function () {
      function a(c) {
        Z = c.exports;
        Ka = Z.M;
        Qa();
        Y = Z.O;
        K--;
        f.monitorRunDependencies?.(K);
        0 == K && Sa && ((c = Sa), (Sa = null), c());
        return Z;
      }
      K++;
      f.monitorRunDependencies?.(K);
      var b = { a: Xc };
      if (f.instantiateWasm)
        return new Promise(c => {
          f.instantiateWasm(b, (d, e) => {
            a(d, e);
            c(d.exports);
          });
        });
      Ua ??= f.locateFile
        ? f.locateFile('sql-wasm.wasm', D)
        : D + 'sql-wasm.wasm';
      return a((await Xa(b)).instance);
    })();
    f._sqlite3_free = a => (f._sqlite3_free = Z.P)(a);
    f._sqlite3_value_text = a => (f._sqlite3_value_text = Z.Q)(a);
    f._sqlite3_prepare_v2 = (a, b, c, d, e) =>
      (f._sqlite3_prepare_v2 = Z.R)(a, b, c, d, e);
    f._sqlite3_step = a => (f._sqlite3_step = Z.S)(a);
    f._sqlite3_reset = a => (f._sqlite3_reset = Z.T)(a);
    f._sqlite3_exec = (a, b, c, d, e) => (f._sqlite3_exec = Z.U)(a, b, c, d, e);
    f._sqlite3_finalize = a => (f._sqlite3_finalize = Z.V)(a);
    f._sqlite3_column_name = (a, b) => (f._sqlite3_column_name = Z.W)(a, b);
    f._sqlite3_column_text = (a, b) => (f._sqlite3_column_text = Z.X)(a, b);
    f._sqlite3_column_type = (a, b) => (f._sqlite3_column_type = Z.Y)(a, b);
    f._sqlite3_errmsg = a => (f._sqlite3_errmsg = Z.Z)(a);
    f._sqlite3_clear_bindings = a => (f._sqlite3_clear_bindings = Z._)(a);
    f._sqlite3_value_blob = a => (f._sqlite3_value_blob = Z.$)(a);
    f._sqlite3_value_bytes = a => (f._sqlite3_value_bytes = Z.aa)(a);
    f._sqlite3_value_double = a => (f._sqlite3_value_double = Z.ba)(a);
    f._sqlite3_value_int = a => (f._sqlite3_value_int = Z.ca)(a);
    f._sqlite3_value_type = a => (f._sqlite3_value_type = Z.da)(a);
    f._sqlite3_result_blob = (a, b, c, d) =>
      (f._sqlite3_result_blob = Z.ea)(a, b, c, d);
    f._sqlite3_result_double = (a, b) =>
      (f._sqlite3_result_double = Z.fa)(a, b);
    f._sqlite3_result_error = (a, b, c) =>
      (f._sqlite3_result_error = Z.ga)(a, b, c);
    f._sqlite3_result_int = (a, b) => (f._sqlite3_result_int = Z.ha)(a, b);
    f._sqlite3_result_int64 = (a, b) => (f._sqlite3_result_int64 = Z.ia)(a, b);
    f._sqlite3_result_null = a => (f._sqlite3_result_null = Z.ja)(a);
    f._sqlite3_result_text = (a, b, c, d) =>
      (f._sqlite3_result_text = Z.ka)(a, b, c, d);
    f._sqlite3_aggregate_context = (a, b) =>
      (f._sqlite3_aggregate_context = Z.la)(a, b);
    f._sqlite3_column_count = a => (f._sqlite3_column_count = Z.ma)(a);
    f._sqlite3_data_count = a => (f._sqlite3_data_count = Z.na)(a);
    f._sqlite3_column_blob = (a, b) => (f._sqlite3_column_blob = Z.oa)(a, b);
    f._sqlite3_column_bytes = (a, b) => (f._sqlite3_column_bytes = Z.pa)(a, b);
    f._sqlite3_column_double = (a, b) =>
      (f._sqlite3_column_double = Z.qa)(a, b);
    f._sqlite3_bind_blob = (a, b, c, d, e) =>
      (f._sqlite3_bind_blob = Z.ra)(a, b, c, d, e);
    f._sqlite3_bind_double = (a, b, c) =>
      (f._sqlite3_bind_double = Z.sa)(a, b, c);
    f._sqlite3_bind_int = (a, b, c) => (f._sqlite3_bind_int = Z.ta)(a, b, c);
    f._sqlite3_bind_text = (a, b, c, d, e) =>
      (f._sqlite3_bind_text = Z.ua)(a, b, c, d, e);
    f._sqlite3_bind_parameter_index = (a, b) =>
      (f._sqlite3_bind_parameter_index = Z.va)(a, b);
    f._sqlite3_sql = a => (f._sqlite3_sql = Z.wa)(a);
    f._sqlite3_normalized_sql = a => (f._sqlite3_normalized_sql = Z.xa)(a);
    f._sqlite3_changes = a => (f._sqlite3_changes = Z.ya)(a);
    f._sqlite3_close_v2 = a => (f._sqlite3_close_v2 = Z.za)(a);
    f._sqlite3_create_function_v2 = (a, b, c, d, e, h, k, q, w) =>
      (f._sqlite3_create_function_v2 = Z.Aa)(a, b, c, d, e, h, k, q, w);
    f._sqlite3_update_hook = (a, b, c) =>
      (f._sqlite3_update_hook = Z.Ba)(a, b, c);
    f._sqlite3_open = (a, b) => (f._sqlite3_open = Z.Ca)(a, b);
    var ia = (f._malloc = a => (ia = f._malloc = Z.Da)(a)),
      fa = (f._free = a => (fa = f._free = Z.Ea)(a));
    f._RegisterExtensionFunctions = a =>
      (f._RegisterExtensionFunctions = Z.Fa)(a);
    var Db = (a, b) => (Db = Z.Ga)(a, b),
      Wc = (a, b) => (Wc = Z.Ha)(a, b),
      wa = a => (wa = Z.Ia)(a),
      z = a => (z = Z.Ja)(a),
      sa = () => (sa = Z.Ka)();
    f.stackSave = () => sa();
    f.stackRestore = a => wa(a);
    f.stackAlloc = a => z(a);
    f.cwrap = (a, b, c, d) => {
      var e = !c || c.every(h => 'number' === h || 'boolean' === h);
      return 'string' !== b && e && !d ? f['_' + a] : (...h) => Tc(a, b, c, h);
    };
    f.addFunction = Aa;
    f.removeFunction = A;
    f.UTF8ToString = ua;
    f.ALLOC_NORMAL = ea;
    f.allocate = da;
    f.allocateUTF8OnStack = xa;
    function Yc() {
      function a() {
        f.calledRun = !0;
        if (!La) {
          if (!f.noFSInit && !Ib) {
            var b, c;
            Ib = !0;
            d ??= f.stdin;
            b ??= f.stdout;
            c ??= f.stderr;
            d ? V('stdin', d) : Zb('/dev/tty', '/dev/stdin');
            b ? V('stdout', null, b) : Zb('/dev/tty', '/dev/stdout');
            c ? V('stderr', null, c) : Zb('/dev/tty1', '/dev/stderr');
            oa('/dev/stdin', 0);
            oa('/dev/stdout', 1);
            oa('/dev/stderr', 1);
          }
          Z.N();
          Jb = !1;
          f.onRuntimeInitialized?.();
          if (f.postRun)
            for (
              'function' == typeof f.postRun && (f.postRun = [f.postRun]);
              f.postRun.length;

            ) {
              var d = f.postRun.shift();
              $a.unshift(d);
            }
          Za($a);
        }
      }
      if (0 < K) Sa = Yc;
      else {
        if (f.preRun)
          for (
            'function' == typeof f.preRun && (f.preRun = [f.preRun]);
            f.preRun.length;

          )
            bb();
        Za(ab);
        0 < K
          ? (Sa = Yc)
          : f.setStatus
            ? (f.setStatus('Running...'),
              setTimeout(() => {
                setTimeout(() => f.setStatus(''), 1);
                a();
              }, 1))
            : a();
      }
    }
    if (f.preInit)
      for (
        'function' == typeof f.preInit && (f.preInit = [f.preInit]);
        0 < f.preInit.length;

      )
        f.preInit.pop()();
    Yc();

    // The shell-pre.js and emcc-generated code goes above
    return Module;
  }); // The end of the promise being returned

  return initSqlJsPromise;
}; // The end of our initSqlJs function

// This bit below is copied almost exactly from what you get when you use the MODULARIZE=1 flag with emcc
// However, we don't want to use the emcc modularization. See shell-pre.js
if (typeof exports === 'object' && typeof module === 'object') {
  module.exports = initSqlJs;
  // This will allow the module to be used in ES6 or CommonJS
  module.exports.default = initSqlJs;
} else if (typeof define === 'function' && define['amd']) {
  define([], function () {
    return initSqlJs;
  });
} else if (typeof exports === 'object') {
  exports['Module'] = initSqlJs;
}
