(function () {
  const t = document.createElement("link").relList;
  if (t && t.supports && t.supports("modulepreload")) return;
  for (const n of document.querySelectorAll('link[rel="modulepreload"]')) s(n);
  new MutationObserver((n) => {
    for (const i of n)
      if (i.type === "childList")
        for (const a of i.addedNodes)
          a.tagName === "LINK" && a.rel === "modulepreload" && s(a);
  }).observe(document, {
    childList: !0,
    subtree: !0,
  });

  function r(n) {
    const i = {};
    return (
      n.integrity && (i.integrity = n.integrity),
      n.referrerPolicy && (i.referrerPolicy = n.referrerPolicy),
      n.crossOrigin === "use-credentials"
        ? (i.credentials = "include")
        : n.crossOrigin === "anonymous"
          ? (i.credentials = "omit")
          : (i.credentials = "same-origin"),
      i
    );
  }

  function s(n) {
    if (n.ep) return;
    n.ep = !0;
    const i = r(n);
    fetch(n.href, i);
  }
})();
try {
} catch (e) {
  console.error("[wxt] Failed to initialize plugins", e);
}
const gt = !1,
  ut = (e, t) => e === t,
  ae = {
    equals: ut,
  };
let Je = Xe;
const R = 1,
  le = 2,
  Ke = {
    owned: null,
    cleanups: null,
    context: null,
    owner: null,
  };
var E = null;
let Ae = null,
  ft = null,
  S = null,
  k = null,
  B = null,
  me = 0;

function dt(e, t) {
  const r = S,
    s = E,
    n = e.length === 0,
    i = t === void 0 ? s : t,
    a = n
      ? Ke
      : {
          owned: null,
          cleanups: null,
          context: i ? i.context : null,
          owner: i,
        },
    o = n ? e : () => e(() => Q(() => te(a)));
  ((E = a), (S = null));
  try {
    return se(o, !0);
  } finally {
    ((S = r), (E = s));
  }
}

function G(e, t) {
  t = t ? Object.assign({}, ae, t) : ae;
  const r = {
      value: e,
      observers: null,
      observerSlots: null,
      comparator: t.equals || void 0,
    },
    s = (n) => (typeof n == "function" && (n = n(r.value)), Qe(r, n));
  return [Ze.bind(r), s];
}

function Z(e, t, r) {
  const s = Me(e, t, !1, R);
  re(s);
}

function ke(e, t, r) {
  Je = At;
  const s = Me(e, t, !1, R);
  ((s.user = !0), B ? B.push(s) : re(s));
}

function ye(e, t, r) {
  r = r ? Object.assign({}, ae, r) : ae;
  const s = Me(e, t, !0, 0);
  return (
    (s.observers = null),
    (s.observerSlots = null),
    (s.comparator = r.equals || void 0),
    re(s),
    Ze.bind(s)
  );
}

function Q(e) {
  if (S === null) return e();
  const t = S;
  S = null;
  try {
    return e();
  } finally {
    S = t;
  }
}

function mt(e) {
  ke(() => Q(e));
}

function ze(e) {
  return (
    E === null ||
      (E.cleanups === null ? (E.cleanups = [e]) : E.cleanups.push(e)),
    e
  );
}

function Ze() {
  if (this.sources && this.state)
    if (this.state === R) re(this);
    else {
      const e = k;
      ((k = null), se(() => ge(this), !1), (k = e));
    }
  if (S) {
    const e = this.observers ? this.observers.length : 0;
    (S.sources
      ? (S.sources.push(this), S.sourceSlots.push(e))
      : ((S.sources = [this]), (S.sourceSlots = [e])),
      this.observers
        ? (this.observers.push(S),
          this.observerSlots.push(S.sources.length - 1))
        : ((this.observers = [S]),
          (this.observerSlots = [S.sources.length - 1])));
  }
  return this.value;
}

function Qe(e, t, r) {
  let s = e.value;
  return (
    (!e.comparator || !e.comparator(s, t)) &&
      ((e.value = t),
      e.observers &&
        e.observers.length &&
        se(() => {
          for (let n = 0; n < e.observers.length; n += 1) {
            const i = e.observers[n],
              a = Ae && Ae.running;
            (a && Ae.disposed.has(i),
              (a ? !i.tState : !i.state) &&
                (i.pure ? k.push(i) : B.push(i), i.observers && Ye(i)),
              a || (i.state = R));
          }
          if (k.length > 1e6) throw ((k = []), new Error());
        }, !1)),
    t
  );
}

function re(e) {
  if (!e.fn) return;
  te(e);
  const t = me;
  pt(e, e.value, t);
}

function pt(e, t, r) {
  let s;
  const n = E,
    i = S;
  S = E = e;
  try {
    s = e.fn(t);
  } catch (a) {
    return (
      e.pure &&
        ((e.state = R), e.owned && e.owned.forEach(te), (e.owned = null)),
      (e.updatedAt = r + 1),
      et(a)
    );
  } finally {
    ((S = i), (E = n));
  }
  (!e.updatedAt || e.updatedAt <= r) &&
    (e.updatedAt != null && "observers" in e ? Qe(e, s) : (e.value = s),
    (e.updatedAt = r));
}

function Me(e, t, r, s = R, n) {
  const i = {
    fn: e,
    state: s,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: t,
    owner: E,
    context: E ? E.context : null,
    pure: r,
  };
  return (
    E === null || (E !== Ke && (E.owned ? E.owned.push(i) : (E.owned = [i]))),
    i
  );
}

function ce(e) {
  if (e.state === 0) return;
  if (e.state === le) return ge(e);
  if (e.suspense && Q(e.suspense.inFallback)) return e.suspense.effects.push(e);
  const t = [e];
  for (; (e = e.owner) && (!e.updatedAt || e.updatedAt < me); )
    e.state && t.push(e);
  for (let r = t.length - 1; r >= 0; r--)
    if (((e = t[r]), e.state === R)) re(e);
    else if (e.state === le) {
      const s = k;
      ((k = null), se(() => ge(e, t[0]), !1), (k = s));
    }
}

function se(e, t) {
  if (k) return e();
  let r = !1;
  (t || (k = []), B ? (r = !0) : (B = []), me++);
  try {
    const s = e();
    return (ht(r), s);
  } catch (s) {
    (r || (B = null), (k = null), et(s));
  }
}

function ht(e) {
  if ((k && (Xe(k), (k = null)), e)) return;
  const t = B;
  ((B = null), t.length && se(() => Je(t), !1));
}

function Xe(e) {
  for (let t = 0; t < e.length; t++) ce(e[t]);
}

function At(e) {
  let t,
    r = 0;
  for (t = 0; t < e.length; t++) {
    const s = e[t];
    s.user ? (e[r++] = s) : ce(s);
  }
  for (t = 0; t < r; t++) ce(e[t]);
}

function ge(e, t) {
  e.state = 0;
  for (let r = 0; r < e.sources.length; r += 1) {
    const s = e.sources[r];
    if (s.sources) {
      const n = s.state;
      n === R
        ? s !== t && (!s.updatedAt || s.updatedAt < me) && ce(s)
        : n === le && ge(s, t);
    }
  }
}

function Ye(e) {
  for (let t = 0; t < e.observers.length; t += 1) {
    const r = e.observers[t];
    r.state ||
      ((r.state = le), r.pure ? k.push(r) : B.push(r), r.observers && Ye(r));
  }
}

function te(e) {
  let t;
  if (e.sources)
    for (; e.sources.length; ) {
      const r = e.sources.pop(),
        s = e.sourceSlots.pop(),
        n = r.observers;
      if (n && n.length) {
        const i = n.pop(),
          a = r.observerSlots.pop();
        s < n.length &&
          ((i.sourceSlots[a] = s), (n[s] = i), (r.observerSlots[s] = a));
      }
    }
  if (e.tOwned) {
    for (t = e.tOwned.length - 1; t >= 0; t--) te(e.tOwned[t]);
    delete e.tOwned;
  }
  if (e.owned) {
    for (t = e.owned.length - 1; t >= 0; t--) te(e.owned[t]);
    e.owned = null;
  }
  if (e.cleanups) {
    for (t = e.cleanups.length - 1; t >= 0; t--) e.cleanups[t]();
    e.cleanups = null;
  }
  e.state = 0;
}

function yt(e) {
  return e instanceof Error
    ? e
    : new Error(typeof e == "string" ? e : "Unknown error", {
        cause: e,
      });
}

function et(e, t = E) {
  throw yt(e);
}

function oe(e, t) {
  return Q(() => e(t || {}));
}
const bt = (e) => `Stale read from <${e}>.`;

function be(e) {
  const t = e.keyed,
    r = ye(() => e.when, void 0, void 0),
    s = t
      ? r
      : ye(r, void 0, {
          equals: (n, i) => !n == !i,
        });
  return ye(
    () => {
      const n = s();
      if (n) {
        const i = e.children;
        return typeof i == "function" && i.length > 0
          ? Q(() =>
              i(
                t
                  ? n
                  : () => {
                      if (!Q(s)) throw bt("Show");
                      return r();
                    },
              ),
            )
          : i;
      }
      return e.fallback;
    },
    void 0,
    void 0,
  );
}

function xt(e, t, r) {
  let s = r.length,
    n = t.length,
    i = s,
    a = 0,
    o = 0,
    c = t[n - 1].nextSibling,
    u = null;
  for (; a < n || o < i; ) {
    if (t[a] === r[o]) {
      (a++, o++);
      continue;
    }
    for (; t[n - 1] === r[i - 1]; ) (n--, i--);
    if (n === a) {
      const p = i < s ? (o ? r[o - 1].nextSibling : r[i - o]) : c;
      for (; o < i; ) e.insertBefore(r[o++], p);
    } else if (i === o)
      for (; a < n; ) ((!u || !u.has(t[a])) && t[a].remove(), a++);
    else if (t[a] === r[i - 1] && r[o] === t[n - 1]) {
      const p = t[--n].nextSibling;
      (e.insertBefore(r[o++], t[a++].nextSibling),
        e.insertBefore(r[--i], p),
        (t[n] = r[i]));
    } else {
      if (!u) {
        u = new Map();
        let h = o;
        for (; h < i; ) u.set(r[h], h++);
      }
      const p = u.get(t[a]);
      if (p != null)
        if (o < p && p < i) {
          let h = a,
            v = 1,
            x;
          for (
            ;
            ++h < n && h < i && !((x = u.get(t[h])) == null || x !== p + v);
          )
            v++;
          if (v > p - o) {
            const w = t[a];
            for (; o < p; ) e.insertBefore(r[o++], w);
          } else e.replaceChild(r[o++], t[a++]);
        } else a++;
      else t[a++].remove();
    }
  }
}
const Oe = "_$DX_DELEGATE";

function wt(e, t, r, s = {}) {
  let n;
  return (
    dt((i) => {
      ((n = i),
        t === document ? e() : J(t, e(), t.firstChild ? null : void 0, r));
    }, s.owner),
    () => {
      (n(), (t.textContent = ""));
    }
  );
}

function j(e, t, r, s) {
  let n;
  const i = () => {
      const o = document.createElement("template");
      return ((o.innerHTML = e), o.content.firstChild);
    },
    a = () => (n || (n = i())).cloneNode(!0);
  return ((a.cloneNode = a), a);
}

function vt(e, t = window.document) {
  const r = t[Oe] || (t[Oe] = new Set());
  for (let s = 0, n = e.length; s < n; s++) {
    const i = e[s];
    r.has(i) || (r.add(i), t.addEventListener(i, St));
  }
}

function J(e, t, r, s) {
  if ((r !== void 0 && !s && (s = []), typeof t != "function"))
    return ue(e, t, s, r);
  Z((n) => ue(e, t(), n, r), s);
}

function St(e) {
  let t = e.target;
  const r = `$$${e.type}`,
    s = e.target,
    n = e.currentTarget,
    i = (c) =>
      Object.defineProperty(e, "target", {
        configurable: !0,
        value: c,
      }),
    a = () => {
      const c = t[r];
      if (c && !t.disabled) {
        const u = t[`${r}Data`];
        if ((u !== void 0 ? c.call(t, u, e) : c.call(t, e), e.cancelBubble))
          return;
      }
      return (
        t.host &&
          typeof t.host != "string" &&
          !t.host._$host &&
          t.contains(e.target) &&
          i(t.host),
        !0
      );
    },
    o = () => {
      for (; a() && (t = t._$host || t.parentNode || t.host); );
    };
  if (
    (Object.defineProperty(e, "currentTarget", {
      configurable: !0,
      get() {
        return t || document;
      },
    }),
    e.composedPath)
  ) {
    const c = e.composedPath();
    i(c[0]);
    for (let u = 0; u < c.length - 2 && ((t = c[u]), !!a()); u++) {
      if (t._$host) {
        ((t = t._$host), o());
        break;
      }
      if (t.parentNode === n) break;
    }
  } else o();
  i(s);
}

function ue(e, t, r, s, n) {
  for (; typeof r == "function"; ) r = r();
  if (t === r) return r;
  const i = typeof t,
    a = s !== void 0;
  if (
    ((e = (a && r[0] && r[0].parentNode) || e),
    i === "string" || i === "number")
  ) {
    if (i === "number" && ((t = t.toString()), t === r)) return r;
    if (a) {
      let o = r[0];
      (o && o.nodeType === 3
        ? o.data !== t && (o.data = t)
        : (o = document.createTextNode(t)),
        (r = H(e, r, s, o)));
    } else
      r !== "" && typeof r == "string"
        ? (r = e.firstChild.data = t)
        : (r = e.textContent = t);
  } else if (t == null || i === "boolean") r = H(e, r, s);
  else {
    if (i === "function")
      return (
        Z(() => {
          let o = t();
          for (; typeof o == "function"; ) o = o();
          r = ue(e, o, r, s);
        }),
        () => r
      );
    if (Array.isArray(t)) {
      const o = [],
        c = r && Array.isArray(r);
      if (Se(o, t, r, n)) return (Z(() => (r = ue(e, o, r, s, !0))), () => r);
      if (o.length === 0) {
        if (((r = H(e, r, s)), a)) return r;
      } else
        c
          ? r.length === 0
            ? Ne(e, o, s)
            : xt(e, r, o)
          : (r && H(e), Ne(e, o));
      r = o;
    } else if (t.nodeType) {
      if (Array.isArray(r)) {
        if (a) return (r = H(e, r, s, t));
        H(e, r, null, t);
      } else
        r == null || r === "" || !e.firstChild
          ? e.appendChild(t)
          : e.replaceChild(t, e.firstChild);
      r = t;
    }
  }
  return r;
}

function Se(e, t, r, s) {
  let n = !1;
  for (let i = 0, a = t.length; i < a; i++) {
    let o = t[i],
      c = r && r[e.length],
      u;
    if (!(o == null || o === !0 || o === !1))
      if ((u = typeof o) == "object" && o.nodeType) e.push(o);
      else if (Array.isArray(o)) n = Se(e, o, c) || n;
      else if (u === "function")
        if (s) {
          for (; typeof o == "function"; ) o = o();
          n =
            Se(e, Array.isArray(o) ? o : [o], Array.isArray(c) ? c : [c]) || n;
        } else (e.push(o), (n = !0));
      else {
        const p = String(o);
        c && c.nodeType === 3 && c.data === p
          ? e.push(c)
          : e.push(document.createTextNode(p));
      }
  }
  return n;
}

function Ne(e, t, r = null) {
  for (let s = 0, n = t.length; s < n; s++) e.insertBefore(t[s], r);
}

function H(e, t, r, s) {
  if (r === void 0) return (e.textContent = "");
  const n = s || document.createTextNode("");
  if (t.length) {
    let i = !1;
    for (let a = t.length - 1; a >= 0; a--) {
      const o = t[a];
      if (n !== o) {
        const c = o.parentNode === e;
        !i && !a
          ? c
            ? e.replaceChild(n, o)
            : e.insertBefore(n, r)
          : c && o.remove();
      } else i = !0;
    }
  } else e.insertBefore(n, r);
  return [n];
}
const Et = globalThis.browser?.runtime?.id
    ? globalThis.browser
    : globalThis.chrome,
  O = Et;

function tt(e) {
  return e && e.__esModule && Object.prototype.hasOwnProperty.call(e, "default")
    ? e.default
    : e;
}
var ne = {
    exports: {},
  },
  Le;

function Pt() {
  if (Le) return ne.exports;
  Le = 1;
  const e = (r) =>
      typeof crypto < "u" && typeof crypto.getRandomValues == "function"
        ? () => {
            const s = crypto.getRandomValues(new Uint8Array(1))[0];
            return (s >= r ? s % r : s).toString(r);
          }
        : () => Math.floor(Math.random() * r).toString(r),
    t = (r = 7, s = !1) =>
      Array.from(
        {
          length: r,
        },
        e(s ? 16 : 36),
      ).join("");
  return ((ne.exports = t), (ne.exports.default = t), ne.exports);
}
var Tt = Pt();
const fe = tt(Tt);
var Ct = () => `uid::${fe(7)}`,
  It = (e, t = ["endpointName", "fingerprint"]) =>
    typeof e == "object" && e !== null && t.every((r) => r in e),
  _t = (e) => {
    if (!It(e)) throw new TypeError("Invalid connection args");
    return JSON.stringify(e);
  },
  kt = () => {
    let e = [];
    return {
      add: (...t) => {
        e = [...e, ...t];
      },
      remove: (t) => {
        e =
          typeof t == "string"
            ? e.filter((r) => r.message.transactionId !== t)
            : e.filter((r) => !t.includes(r));
      },
      entries: () => e,
    };
  },
  xe = class {
    static toBackground(e, t) {
      return e.postMessage(t);
    }
    static toExtensionContext(e, t) {
      return e.postMessage(t);
    }
  },
  ie = {
    exports: {},
  },
  Mt = ie.exports,
  De;

function $t() {
  return (
    De ||
      ((De = 1),
      (function (e, t) {
        (function (r, s) {
          s(e);
        })(
          typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : Mt,
          function (r) {
            if (
              typeof globalThis != "object" ||
              typeof chrome != "object" ||
              !chrome ||
              !chrome.runtime ||
              !chrome.runtime.id
            )
              throw new Error(
                "This script should only be loaded in a browser extension.",
              );
            if (
              typeof globalThis.browser > "u" ||
              Object.getPrototypeOf(globalThis.browser) !== Object.prototype
            ) {
              const s =
                  "The message port closed before a response was received.",
                n =
                  "Returning a Promise is the preferred way to send a reply from an onMessage/onMessageExternal listener, as the sendResponse will be removed from the specs (See https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/runtime/onMessage)",
                i = (a) => {
                  const o = {
                    alarms: {
                      clear: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      clearAll: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      get: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      getAll: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                    },
                    bookmarks: {
                      create: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      get: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getChildren: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getRecent: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getSubTree: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getTree: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      move: {
                        minArgs: 2,
                        maxArgs: 2,
                      },
                      remove: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      removeTree: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      search: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      update: {
                        minArgs: 2,
                        maxArgs: 2,
                      },
                    },
                    browserAction: {
                      disable: {
                        minArgs: 0,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      enable: {
                        minArgs: 0,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      getBadgeBackgroundColor: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getBadgeText: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getPopup: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getTitle: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      openPopup: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      setBadgeBackgroundColor: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      setBadgeText: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      setIcon: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      setPopup: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      setTitle: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                    },
                    browsingData: {
                      remove: {
                        minArgs: 2,
                        maxArgs: 2,
                      },
                      removeCache: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      removeCookies: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      removeDownloads: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      removeFormData: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      removeHistory: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      removeLocalStorage: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      removePasswords: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      removePluginData: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      settings: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                    },
                    commands: {
                      getAll: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                    },
                    contextMenus: {
                      remove: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      removeAll: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      update: {
                        minArgs: 2,
                        maxArgs: 2,
                      },
                    },
                    cookies: {
                      get: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getAll: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getAllCookieStores: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      remove: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      set: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                    },
                    devtools: {
                      inspectedWindow: {
                        eval: {
                          minArgs: 1,
                          maxArgs: 2,
                          singleCallbackArg: !1,
                        },
                      },
                      panels: {
                        create: {
                          minArgs: 3,
                          maxArgs: 3,
                          singleCallbackArg: !0,
                        },
                        elements: {
                          createSidebarPane: {
                            minArgs: 1,
                            maxArgs: 1,
                          },
                        },
                      },
                    },
                    downloads: {
                      cancel: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      download: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      erase: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getFileIcon: {
                        minArgs: 1,
                        maxArgs: 2,
                      },
                      open: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      pause: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      removeFile: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      resume: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      search: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      show: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                    },
                    extension: {
                      isAllowedFileSchemeAccess: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      isAllowedIncognitoAccess: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                    },
                    history: {
                      addUrl: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      deleteAll: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      deleteRange: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      deleteUrl: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getVisits: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      search: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                    },
                    i18n: {
                      detectLanguage: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getAcceptLanguages: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                    },
                    identity: {
                      launchWebAuthFlow: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                    },
                    idle: {
                      queryState: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                    },
                    management: {
                      get: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getAll: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      getSelf: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      setEnabled: {
                        minArgs: 2,
                        maxArgs: 2,
                      },
                      uninstallSelf: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                    },
                    notifications: {
                      clear: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      create: {
                        minArgs: 1,
                        maxArgs: 2,
                      },
                      getAll: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      getPermissionLevel: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      update: {
                        minArgs: 2,
                        maxArgs: 2,
                      },
                    },
                    pageAction: {
                      getPopup: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getTitle: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      hide: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      setIcon: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      setPopup: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      setTitle: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                      show: {
                        minArgs: 1,
                        maxArgs: 1,
                        fallbackToNoCallback: !0,
                      },
                    },
                    permissions: {
                      contains: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getAll: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      remove: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      request: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                    },
                    runtime: {
                      getBackgroundPage: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      getPlatformInfo: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      openOptionsPage: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      requestUpdateCheck: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      sendMessage: {
                        minArgs: 1,
                        maxArgs: 3,
                      },
                      sendNativeMessage: {
                        minArgs: 2,
                        maxArgs: 2,
                      },
                      setUninstallURL: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                    },
                    sessions: {
                      getDevices: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      getRecentlyClosed: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      restore: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                    },
                    storage: {
                      local: {
                        clear: {
                          minArgs: 0,
                          maxArgs: 0,
                        },
                        get: {
                          minArgs: 0,
                          maxArgs: 1,
                        },
                        getBytesInUse: {
                          minArgs: 0,
                          maxArgs: 1,
                        },
                        remove: {
                          minArgs: 1,
                          maxArgs: 1,
                        },
                        set: {
                          minArgs: 1,
                          maxArgs: 1,
                        },
                      },
                      managed: {
                        get: {
                          minArgs: 0,
                          maxArgs: 1,
                        },
                        getBytesInUse: {
                          minArgs: 0,
                          maxArgs: 1,
                        },
                      },
                      sync: {
                        clear: {
                          minArgs: 0,
                          maxArgs: 0,
                        },
                        get: {
                          minArgs: 0,
                          maxArgs: 1,
                        },
                        getBytesInUse: {
                          minArgs: 0,
                          maxArgs: 1,
                        },
                        remove: {
                          minArgs: 1,
                          maxArgs: 1,
                        },
                        set: {
                          minArgs: 1,
                          maxArgs: 1,
                        },
                      },
                    },
                    tabs: {
                      captureVisibleTab: {
                        minArgs: 0,
                        maxArgs: 2,
                      },
                      create: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      detectLanguage: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      discard: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      duplicate: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      executeScript: {
                        minArgs: 1,
                        maxArgs: 2,
                      },
                      get: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getCurrent: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                      getZoom: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      getZoomSettings: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      goBack: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      goForward: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      highlight: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      insertCSS: {
                        minArgs: 1,
                        maxArgs: 2,
                      },
                      move: {
                        minArgs: 2,
                        maxArgs: 2,
                      },
                      query: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      reload: {
                        minArgs: 0,
                        maxArgs: 2,
                      },
                      remove: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      removeCSS: {
                        minArgs: 1,
                        maxArgs: 2,
                      },
                      sendMessage: {
                        minArgs: 2,
                        maxArgs: 3,
                      },
                      setZoom: {
                        minArgs: 1,
                        maxArgs: 2,
                      },
                      setZoomSettings: {
                        minArgs: 1,
                        maxArgs: 2,
                      },
                      update: {
                        minArgs: 1,
                        maxArgs: 2,
                      },
                    },
                    topSites: {
                      get: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                    },
                    webNavigation: {
                      getAllFrames: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      getFrame: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                    },
                    webRequest: {
                      handlerBehaviorChanged: {
                        minArgs: 0,
                        maxArgs: 0,
                      },
                    },
                    windows: {
                      create: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      get: {
                        minArgs: 1,
                        maxArgs: 2,
                      },
                      getAll: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      getCurrent: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      getLastFocused: {
                        minArgs: 0,
                        maxArgs: 1,
                      },
                      remove: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      update: {
                        minArgs: 2,
                        maxArgs: 2,
                      },
                    },
                  };
                  if (Object.keys(o).length === 0)
                    throw new Error(
                      "api-metadata.json has not been included in browser-polyfill",
                    );
                  class c extends WeakMap {
                    constructor(g, f = void 0) {
                      (super(f), (this.createItem = g));
                    }
                    get(g) {
                      return (
                        this.has(g) || this.set(g, this.createItem(g)),
                        super.get(g)
                      );
                    }
                  }
                  const u = (l) =>
                      l && typeof l == "object" && typeof l.then == "function",
                    p =
                      (l, g) =>
                      (...f) => {
                        a.runtime.lastError
                          ? l.reject(new Error(a.runtime.lastError.message))
                          : g.singleCallbackArg ||
                              (f.length <= 1 && g.singleCallbackArg !== !1)
                            ? l.resolve(f[0])
                            : l.resolve(f);
                      },
                    h = (l) => (l == 1 ? "argument" : "arguments"),
                    v = (l, g) =>
                      function (d, ...A) {
                        if (A.length < g.minArgs)
                          throw new Error(
                            `Expected at least ${g.minArgs} ${h(g.minArgs)} for ${l}(), got ${A.length}`,
                          );
                        if (A.length > g.maxArgs)
                          throw new Error(
                            `Expected at most ${g.maxArgs} ${h(g.maxArgs)} for ${l}(), got ${A.length}`,
                          );
                        return new Promise((P, I) => {
                          if (g.fallbackToNoCallback)
                            try {
                              d[l](
                                ...A,
                                p(
                                  {
                                    resolve: P,
                                    reject: I,
                                  },
                                  g,
                                ),
                              );
                            } catch (m) {
                              (console.warn(
                                `${l} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `,
                                m,
                              ),
                                d[l](...A),
                                (g.fallbackToNoCallback = !1),
                                (g.noCallback = !0),
                                P());
                            }
                          else
                            g.noCallback
                              ? (d[l](...A), P())
                              : d[l](
                                  ...A,
                                  p(
                                    {
                                      resolve: P,
                                      reject: I,
                                    },
                                    g,
                                  ),
                                );
                        });
                      },
                    x = (l, g, f) =>
                      new Proxy(g, {
                        apply(d, A, P) {
                          return f.call(A, l, ...P);
                        },
                      });
                  let w = Function.call.bind(Object.prototype.hasOwnProperty);
                  const M = (l, g = {}, f = {}) => {
                      let d = Object.create(null),
                        A = {
                          has(I, m) {
                            return m in l || m in d;
                          },
                          get(I, m, _) {
                            if (m in d) return d[m];
                            if (!(m in l)) return;
                            let T = l[m];
                            if (typeof T == "function")
                              if (typeof g[m] == "function")
                                T = x(l, l[m], g[m]);
                              else if (w(f, m)) {
                                let q = v(m, f[m]);
                                T = x(l, l[m], q);
                              } else T = T.bind(l);
                            else if (
                              typeof T == "object" &&
                              T !== null &&
                              (w(g, m) || w(f, m))
                            )
                              T = M(T, g[m], f[m]);
                            else if (w(f, "*")) T = M(T, g[m], f["*"]);
                            else
                              return (
                                Object.defineProperty(d, m, {
                                  configurable: !0,
                                  enumerable: !0,
                                  get() {
                                    return l[m];
                                  },
                                  set(q) {
                                    l[m] = q;
                                  },
                                }),
                                T
                              );
                            return ((d[m] = T), T);
                          },
                          set(I, m, _, T) {
                            return (m in d ? (d[m] = _) : (l[m] = _), !0);
                          },
                          defineProperty(I, m, _) {
                            return Reflect.defineProperty(d, m, _);
                          },
                          deleteProperty(I, m) {
                            return Reflect.deleteProperty(d, m);
                          },
                        },
                        P = Object.create(l);
                      return new Proxy(P, A);
                    },
                    $ = (l) => ({
                      addListener(g, f, ...d) {
                        g.addListener(l.get(f), ...d);
                      },
                      hasListener(g, f) {
                        return g.hasListener(l.get(f));
                      },
                      removeListener(g, f) {
                        g.removeListener(l.get(f));
                      },
                    }),
                    F = new c((l) =>
                      typeof l != "function"
                        ? l
                        : function (f) {
                            const d = M(
                              f,
                              {},
                              {
                                getContent: {
                                  minArgs: 0,
                                  maxArgs: 0,
                                },
                              },
                            );
                            l(d);
                          },
                    );
                  let U = !1;
                  const V = new c((l) =>
                      typeof l != "function"
                        ? l
                        : function (f, d, A) {
                            let P = !1,
                              I,
                              m = new Promise((X) => {
                                I = function (N) {
                                  (U ||
                                    (console.warn(n, new Error().stack),
                                    (U = !0)),
                                    (P = !0),
                                    X(N));
                                };
                              }),
                              _;
                            try {
                              _ = l(f, d, I);
                            } catch (X) {
                              _ = Promise.reject(X);
                            }
                            const T = _ !== !0 && u(_);
                            if (_ !== !0 && !T && !P) return !1;
                            const q = (X) => {
                              X.then(
                                (N) => {
                                  A(N);
                                },
                                (N) => {
                                  let he;
                                  (N &&
                                  (N instanceof Error ||
                                    typeof N.message == "string")
                                    ? (he = N.message)
                                    : (he = "An unexpected error occurred"),
                                    A({
                                      __mozWebExtensionPolyfillReject__: !0,
                                      message: he,
                                    }));
                                },
                              ).catch((N) => {
                                console.error(
                                  "Failed to send onMessage rejected reply",
                                  N,
                                );
                              });
                            };
                            return (q(T ? _ : m), !0);
                          },
                    ),
                    y = ({ reject: l, resolve: g }, f) => {
                      a.runtime.lastError
                        ? a.runtime.lastError.message === s
                          ? g()
                          : l(new Error(a.runtime.lastError.message))
                        : f && f.__mozWebExtensionPolyfillReject__
                          ? l(new Error(f.message))
                          : g(f);
                    },
                    b = (l, g, f, ...d) => {
                      if (d.length < g.minArgs)
                        throw new Error(
                          `Expected at least ${g.minArgs} ${h(g.minArgs)} for ${l}(), got ${d.length}`,
                        );
                      if (d.length > g.maxArgs)
                        throw new Error(
                          `Expected at most ${g.maxArgs} ${h(g.maxArgs)} for ${l}(), got ${d.length}`,
                        );
                      return new Promise((A, P) => {
                        const I = y.bind(null, {
                          resolve: A,
                          reject: P,
                        });
                        (d.push(I), f.sendMessage(...d));
                      });
                    },
                    C = {
                      devtools: {
                        network: {
                          onRequestFinished: $(F),
                        },
                      },
                      runtime: {
                        onMessage: $(V),
                        onMessageExternal: $(V),
                        sendMessage: b.bind(null, "sendMessage", {
                          minArgs: 1,
                          maxArgs: 3,
                        }),
                      },
                      tabs: {
                        sendMessage: b.bind(null, "sendMessage", {
                          minArgs: 2,
                          maxArgs: 3,
                        }),
                      },
                    },
                    L = {
                      clear: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      get: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                      set: {
                        minArgs: 1,
                        maxArgs: 1,
                      },
                    };
                  return (
                    (o.privacy = {
                      network: {
                        "*": L,
                      },
                      services: {
                        "*": L,
                      },
                      websites: {
                        "*": L,
                      },
                    }),
                    M(a, C, o)
                  );
                };
              r.exports = i(chrome);
            } else r.exports = globalThis.browser;
          },
        );
      })(ie)),
    ie.exports
  );
}
var Ot = $t();
const Nt = tt(Ot);
var Lt = (e = "") => {
    const t = Ct();
    let r,
      s = [];
    const n = kt(),
      i = new Set(),
      a = new Set(),
      o = (u, p) => {
        switch (u.status) {
          case "undeliverable":
            s.some((h) => h.message.messageID === u.message.messageID) ||
              (s = [
                ...s,
                {
                  message: u.message,
                  resolvedDestination: u.resolvedDestination,
                },
              ]);
            return;
          case "deliverable":
            s = s.reduce(
              (h, v) =>
                v.resolvedDestination === u.deliverableTo
                  ? (xe.toBackground(p, {
                      type: "deliver",
                      message: v.message,
                    }),
                    h)
                  : [...h, v],
              [],
            );
            return;
          case "delivered":
            u.receipt.message.messageType === "message" && n.add(u.receipt);
            return;
          case "incoming":
            (u.message.messageType === "reply" && n.remove(u.message.messageID),
              i.forEach((h) => h(u.message, p)));
            return;
          case "terminated": {
            const h = n.entries().filter((v) => u.fingerprint === v.to);
            (n.remove(h),
              h.forEach(({ message: v }) => a.forEach((x) => x(v))));
          }
        }
      },
      c = () => {
        ((r = Nt.runtime.connect({
          name: _t({
            endpointName: e,
            fingerprint: t,
          }),
        })),
          r.onMessage.addListener(o),
          r.onDisconnect.addListener(c),
          xe.toBackground(r, {
            type: "sync",
            pendingResponses: n.entries(),
            pendingDeliveries: [
              ...new Set(s.map(({ resolvedDestination: u }) => u)),
            ],
          }));
      };
    return (
      c(),
      {
        onFailure(u) {
          a.add(u);
        },
        onMessage(u) {
          i.add(u);
        },
        postMessage(u) {
          xe.toBackground(r, {
            type: "deliver",
            message: u,
          });
        },
      }
    );
  },
  Dt = Object.defineProperty,
  Bt = Object.defineProperties,
  jt = Object.getOwnPropertyDescriptors,
  Be = Object.getOwnPropertySymbols,
  Rt = Object.prototype.hasOwnProperty,
  Ft = Object.prototype.propertyIsEnumerable,
  je = (e, t, r) =>
    t in e
      ? Dt(e, t, {
          enumerable: !0,
          configurable: !0,
          writable: !0,
          value: r,
        })
      : (e[t] = r),
  rt = (e, t) => {
    for (var r in t || (t = {})) Rt.call(t, r) && je(e, r, t[r]);
    if (Be) for (var r of Be(t)) Ft.call(t, r) && je(e, r, t[r]);
    return e;
  },
  st = (e, t) => Bt(e, jt(t)),
  Ut =
    /^((?:background$)|devtools|popup|options|content-script|window)(?:@(\d+)(?:\.(\d+))?)?$/,
  nt = (e) => {
    const [, t, r, s] = e.match(Ut) || [];
    return {
      context: t,
      tabId: +r,
      frameId: s ? +s : void 0,
    };
  };
const Vt = [
    {
      property: "name",
      enumerable: !1,
    },
    {
      property: "message",
      enumerable: !1,
    },
    {
      property: "stack",
      enumerable: !1,
    },
    {
      property: "code",
      enumerable: !0,
    },
  ],
  Ee = Symbol(".toJSON was called"),
  Wt = (e) => {
    e[Ee] = !0;
    const t = e.toJSON();
    return (delete e[Ee], t);
  },
  ot = ({
    from: e,
    seen: t,
    to_: r,
    forceEnumerable: s,
    maxDepth: n,
    depth: i,
  }) => {
    const a = r || (Array.isArray(e) ? [] : {});
    if ((t.push(e), i >= n)) return a;
    if (typeof e.toJSON == "function" && e[Ee] !== !0) return Wt(e);
    for (const [o, c] of Object.entries(e)) {
      if (typeof Buffer == "function" && Buffer.isBuffer(c)) {
        a[o] = "[object Buffer]";
        continue;
      }
      if (c !== null && typeof c == "object" && typeof c.pipe == "function") {
        a[o] = "[object Stream]";
        continue;
      }
      if (typeof c != "function") {
        if (!c || typeof c != "object") {
          a[o] = c;
          continue;
        }
        if (!t.includes(e[o])) {
          (i++,
            (a[o] = ot({
              from: e[o],
              seen: [...t],
              forceEnumerable: s,
              maxDepth: n,
              depth: i,
            })));
          continue;
        }
        a[o] = "[Circular]";
      }
    }
    for (const { property: o, enumerable: c } of Vt)
      typeof e[o] == "string" &&
        Object.defineProperty(a, o, {
          value: e[o],
          enumerable: !0,
          configurable: !0,
          writable: !0,
        });
    return a;
  };

function qt(e, t = {}) {
  const { maxDepth: r = Number.POSITIVE_INFINITY } = t;
  return typeof e == "object" && e !== null
    ? ot({
        from: e,
        seen: [],
        forceEnumerable: !0,
        maxDepth: r,
        depth: 0,
      })
    : typeof e == "function"
      ? `[Function: ${e.name || "anonymous"}]`
      : e;
}
let it = () => ({
  events: {},
  emit(e, ...t) {
    (this.events[e] || []).forEach((r) => r(...t));
  },
  on(e, t) {
    return (
      (this.events[e] = this.events[e] || []).push(t),
      () => (this.events[e] = (this.events[e] || []).filter((r) => r !== t))
    );
  },
});
var Ht = (e, t, r) => {
    const s = fe(),
      n = new Map(),
      i = new Map(),
      a = (o) => {
        if (
          o.destination.context === e &&
          !o.destination.frameId &&
          !o.destination.tabId
        ) {
          const { transactionId: c, messageID: u, messageType: p } = o,
            h = () => {
              const x = n.get(c);
              if (x) {
                const { err: w, data: M } = o;
                if (w) {
                  const $ = w,
                    F = self[$.name],
                    U = new (typeof F == "function" ? F : Error)($.message);
                  for (const V in $) U[V] = $[V];
                  x.reject(U);
                } else x.resolve(M);
                n.delete(c);
              }
            },
            v = async () => {
              let x,
                w,
                M = !1;
              try {
                const $ = i.get(u);
                if (typeof $ == "function")
                  x = await $({
                    sender: o.origin,
                    id: u,
                    data: o.data,
                    timestamp: o.timestamp,
                  });
                else
                  throw (
                    (M = !0),
                    new Error(
                      `[webext-bridge] No handler registered in '${e}' to accept messages with id '${u}'`,
                    )
                  );
              } catch ($) {
                w = $;
              } finally {
                if (
                  (w && (o.err = qt(w)),
                  a(
                    st(rt({}, o), {
                      messageType: "reply",
                      data: x,
                      origin: {
                        context: e,
                        tabId: null,
                      },
                      destination: o.origin,
                      hops: [],
                    }),
                  ),
                  w && !M)
                )
                  throw x;
              }
            };
          switch (p) {
            case "reply":
              return h();
            case "message":
              return v();
          }
        }
        return (o.hops.push(`${e}::${s}`), t(o));
      };
    return {
      handleMessage: a,
      endTransaction: (o) => {
        const c = n.get(o);
        (c?.reject("Transaction was ended before it could complete"),
          n.delete(o));
      },
      sendMessage: (o, c, u = "background") => {
        const p = typeof u == "string" ? nt(u) : u,
          h = "Bridge#sendMessage ->";
        if (!p.context)
          throw new TypeError(
            `${h} Destination must be any one of known destinations`,
          );
        return new Promise((v, x) => {
          const w = {
            messageID: o,
            data: c,
            destination: p,
            messageType: "message",
            transactionId: fe(),
            origin: {
              context: e,
              tabId: null,
            },
            hops: [],
            timestamp: Date.now(),
          };
          n.set(w.transactionId, {
            resolve: v,
            reject: x,
          });
          try {
            a(w);
          } catch (M) {
            (n.delete(w.transactionId), x(M));
          }
        });
      },
      onMessage: (o, c) => (i.set(o, c), () => i.delete(o)),
    };
  },
  K = class {
    constructor(e, t) {
      ((this.endpointRuntime = e),
        (this.streamInfo = t),
        (this.emitter = it()),
        (this.isClosed = !1),
        (this.handleStreamClose = () => {
          this.isClosed ||
            ((this.isClosed = !0),
            this.emitter.emit("closed", !0),
            (this.emitter.events = {}));
        }),
        K.initDone ||
          (e.onMessage("__crx_bridge_stream_transfer__", (r) => {
            const { streamId: s, streamTransfer: n, action: i } = r.data,
              a = K.openStreams.get(s);
            a &&
              !a.isClosed &&
              (i === "transfer" && a.emitter.emit("message", n),
              i === "close" &&
                (K.openStreams.delete(s), a.handleStreamClose()));
          }),
          (K.initDone = !0)),
        K.openStreams.set(this.streamInfo.streamId, this));
    }
    get info() {
      return this.streamInfo;
    }
    send(e) {
      if (this.isClosed)
        throw new Error(
          "Attempting to send a message over closed stream. Use stream.onClose(<callback>) to keep an eye on stream status",
        );
      this.endpointRuntime.sendMessage(
        "__crx_bridge_stream_transfer__",
        {
          streamId: this.streamInfo.streamId,
          streamTransfer: e,
          action: "transfer",
        },
        this.streamInfo.endpoint,
      );
    }
    close(e) {
      (e && this.send(e),
        this.handleStreamClose(),
        this.endpointRuntime.sendMessage(
          "__crx_bridge_stream_transfer__",
          {
            streamId: this.streamInfo.streamId,
            streamTransfer: null,
            action: "close",
          },
          this.streamInfo.endpoint,
        ));
    }
    onMessage(e) {
      return this.getDisposable("message", e);
    }
    onClose(e) {
      return this.getDisposable("closed", e);
    }
    getDisposable(e, t) {
      const r = this.emitter.on(e, t);
      return Object.assign(r, {
        dispose: r,
        close: r,
      });
    }
  },
  de = K;
de.initDone = !1;
de.openStreams = new Map();
var Gt = (e) => {
    const t = new Map(),
      r = new Map(),
      s = it();
    e.onMessage(
      "__crx_bridge_stream_open__",
      (a) =>
        new Promise((o) => {
          const { sender: c, data: u } = a,
            { channel: p } = u;
          let h = !1,
            v = () => {};
          const x = () => {
            const w = r.get(p);
            typeof w == "function"
              ? (w(
                  new de(
                    e,
                    st(rt({}, u), {
                      endpoint: c,
                    }),
                  ),
                ),
                h && v(),
                o(!0))
              : h || ((h = !0), (v = s.on("did-change-stream-callbacks", x)));
          };
          x();
        }),
    );
    async function n(a, o) {
      if (t.has(a))
        throw new Error(
          "webext-bridge: A Stream is already open at this channel",
        );
      const c = typeof o == "string" ? nt(o) : o,
        u = {
          streamId: fe(),
          channel: a,
          endpoint: c,
        },
        p = new de(e, u);
      return (
        p.onClose(() => t.delete(a)),
        await e.sendMessage("__crx_bridge_stream_open__", u, c),
        t.set(a, p),
        p
      );
    }

    function i(a, o) {
      if (r.has(a))
        throw new Error(
          "webext-bridge: This channel has already been claimed. Stream allows only one-on-one communication",
        );
      (r.set(a, o), s.emit("did-change-stream-callbacks"));
    }
    return {
      openStream: n,
      onOpenStreamChannel: i,
    };
  },
  at = Lt("popup"),
  $e = Ht("popup", (e) => at.postMessage(e));
at.onMessage($e.handleMessage);
var { sendMessage: D, onMessage: hr } = $e;
Gt($e);
const Pe = (e, t) => t.some((r) => e instanceof r);
let Re, Fe;

function Jt() {
  return (
    Re ||
    (Re = [IDBDatabase, IDBObjectStore, IDBIndex, IDBCursor, IDBTransaction])
  );
}

function Kt() {
  return (
    Fe ||
    (Fe = [
      IDBCursor.prototype.advance,
      IDBCursor.prototype.continue,
      IDBCursor.prototype.continuePrimaryKey,
    ])
  );
}
const Te = new WeakMap(),
  we = new WeakMap(),
  pe = new WeakMap();

function zt(e) {
  const t = new Promise((r, s) => {
    const n = () => {
        (e.removeEventListener("success", i),
          e.removeEventListener("error", a));
      },
      i = () => {
        (r(W(e.result)), n());
      },
      a = () => {
        (s(e.error), n());
      };
    (e.addEventListener("success", i), e.addEventListener("error", a));
  });
  return (pe.set(t, e), t);
}

function Zt(e) {
  if (Te.has(e)) return;
  const t = new Promise((r, s) => {
    const n = () => {
        (e.removeEventListener("complete", i),
          e.removeEventListener("error", a),
          e.removeEventListener("abort", a));
      },
      i = () => {
        (r(), n());
      },
      a = () => {
        (s(e.error || new DOMException("AbortError", "AbortError")), n());
      };
    (e.addEventListener("complete", i),
      e.addEventListener("error", a),
      e.addEventListener("abort", a));
  });
  Te.set(e, t);
}
let Ce = {
  get(e, t, r) {
    if (e instanceof IDBTransaction) {
      if (t === "done") return Te.get(e);
      if (t === "store")
        return r.objectStoreNames[1]
          ? void 0
          : r.objectStore(r.objectStoreNames[0]);
    }
    return W(e[t]);
  },
  set(e, t, r) {
    return ((e[t] = r), !0);
  },
  has(e, t) {
    return e instanceof IDBTransaction && (t === "done" || t === "store")
      ? !0
      : t in e;
  },
};

function lt(e) {
  Ce = e(Ce);
}

function Qt(e) {
  return Kt().includes(e)
    ? function (...t) {
        return (e.apply(Ie(this), t), W(this.request));
      }
    : function (...t) {
        return W(e.apply(Ie(this), t));
      };
}

function Xt(e) {
  return typeof e == "function"
    ? Qt(e)
    : (e instanceof IDBTransaction && Zt(e),
      Pe(e, Jt()) ? new Proxy(e, Ce) : e);
}

function W(e) {
  if (e instanceof IDBRequest) return zt(e);
  if (we.has(e)) return we.get(e);
  const t = Xt(e);
  return (t !== e && (we.set(e, t), pe.set(t, e)), t);
}
const Ie = (e) => pe.get(e);

function Yt(e, t, { blocked: r, upgrade: s, blocking: n, terminated: i } = {}) {
  const a = indexedDB.open(e, t),
    o = W(a);
  return (
    s &&
      a.addEventListener("upgradeneeded", (c) => {
        s(W(a.result), c.oldVersion, c.newVersion, W(a.transaction), c);
      }),
    r && a.addEventListener("blocked", (c) => r(c.oldVersion, c.newVersion, c)),
    o
      .then((c) => {
        (i && c.addEventListener("close", () => i()),
          n &&
            c.addEventListener("versionchange", (u) =>
              n(u.oldVersion, u.newVersion, u),
            ));
      })
      .catch(() => {}),
    o
  );
}
const er = ["get", "getKey", "getAll", "getAllKeys", "count"],
  tr = ["put", "add", "delete", "clear"],
  ve = new Map();

function Ue(e, t) {
  if (!(e instanceof IDBDatabase && !(t in e) && typeof t == "string")) return;
  if (ve.get(t)) return ve.get(t);
  const r = t.replace(/FromIndex$/, ""),
    s = t !== r,
    n = tr.includes(r);
  if (
    !(r in (s ? IDBIndex : IDBObjectStore).prototype) ||
    !(n || er.includes(r))
  )
    return;
  const i = async function (a, ...o) {
    const c = this.transaction(a, n ? "readwrite" : "readonly");
    let u = c.store;
    return (
      s && (u = u.index(o.shift())),
      (await Promise.all([u[r](...o), n && c.done]))[0]
    );
  };
  return (ve.set(t, i), i);
}
lt((e) => ({
  ...e,
  get: (t, r, s) => Ue(t, r) || e.get(t, r, s),
  has: (t, r) => !!Ue(t, r) || e.has(t, r),
}));
const rr = ["continue", "continuePrimaryKey", "advance"],
  Ve = {},
  _e = new WeakMap(),
  ct = new WeakMap(),
  sr = {
    get(e, t) {
      if (!rr.includes(t)) return e[t];
      let r = Ve[t];
      return (
        r ||
          (r = Ve[t] =
            function (...s) {
              _e.set(this, ct.get(this)[t](...s));
            }),
        r
      );
    },
  };
async function* nr(...e) {
  let t = this;
  if ((t instanceof IDBCursor || (t = await t.openCursor(...e)), !t)) return;
  t = t;
  const r = new Proxy(t, sr);
  for (ct.set(r, t), pe.set(r, Ie(t)); t; )
    (yield r, (t = await (_e.get(r) || t.continue())), _e.delete(r));
}

function We(e, t) {
  return (
    (t === Symbol.asyncIterator &&
      Pe(e, [IDBIndex, IDBObjectStore, IDBCursor])) ||
    (t === "iterate" && Pe(e, [IDBIndex, IDBObjectStore]))
  );
}
lt((e) => ({
  ...e,
  get(t, r, s) {
    return We(t, r) ? nr : e.get(t, r, s);
  },
  has(t, r) {
    return We(t, r) || e.has(t, r);
  },
}));
class z {
  db;
  static instance;
  listeners;
  constructor() {
    ((this.db = Yt("settings-db", 2, {
      upgrade(t) {
        t.objectStoreNames.contains("settings") ||
          t.createObjectStore("settings", {
            keyPath: "key",
          });
      },
    })),
      (this.listeners = new Map()));
  }
  static getInstance() {
    return (z.instance || (z.instance = new z()), z.instance);
  }
  async getSetting(t) {
    try {
      return (await (await this.db).get("settings", t))?.value;
    } catch (r) {
      console.error(`Error retrieving setting "${t}":`, r);
      return;
    }
  }
  async setSetting(t, r) {
    try {
      (await (
        await this.db
      ).put("settings", {
        key: t,
        value: r,
      }),
        this.notifyListeners(t, r));
    } catch (s) {
      throw (console.error(`Error storing setting "${t}":`, s), s);
    }
  }
  subscribe(t, r) {
    return (
      this.listeners.has(t) || this.listeners.set(t, new Set()),
      this.listeners.get(t)?.add(r),
      () => {
        this.listeners.get(t)?.delete(r);
      }
    );
  }
  notifyListeners(t, r) {
    this.listeners.get(t)?.forEach((s) => s(r));
  }
}
const ee = z.getInstance();

function qe(e, t) {
  const [r, s] = G(t);
  return (
    ke(() => {
      (console.log(`Syncing with settings key: "${e}"`),
        ee.getSetting(e).then((a) => {
          a !== void 0 && s(() => a);
        }));
      const i = ee.subscribe(e, (a) => {
        s(() => a);
      });
      ze(() => {
        (console.log(`Unsubscribing from settings key: "${e}"`), i());
      });
    }),
    [
      r,
      async (i) => {
        await ee.setSetting(e, i);
      },
    ]
  );
}

function He(e) {
  try {
    const r = new URL(e).hostname.split(".");
    if (r[0] !== "shopee")
      return r[0] === "shop-id" && r[1] === "tokopedia" ? "id" : null;
    if (r.length >= 2) return r[r.length - 1];
  } catch (t) {
    return (console.error("Invalid URL:", t), null);
  }
  return null;
}
const Y = async () => {
  try {
    const t = (
      await O.tabs.query({
        active: !0,
        currentWindow: !0,
      })
    ).find((s) => s.url?.includes("shopee") || s.url?.includes("tokopedia"));
    if ((console.log("Active eligible tab found:", t), t)) return t;
    const r = await O.tabs.query({
      url: [
        "*://*.shopee.co.id/*",
        "*://*.shopee.com.my/*",
        "*://*.shopee.ph/*",
        "*://*.shopee.sg/*",
        "*://*.shopee.co.th/*",
        "*://*.shopee.vn/*",
        "*://shop-id.tokopedia.com/*",
      ],
    });
    return (console.log("Found eligible tabs:", r), r[0] || null);
  } catch (e) {
    return (console.error("Error finding eligible tab:", e), null);
  }
};
var or = j("<p>Email: "),
  ir = j("<button>Logout"),
  ar = j(
    "<div><h3>Settings</h3><div><label><input type=checkbox><span>Captcha Solver",
  ),
  lr = j("<div><button>Start</button><button>Stop"),
  cr = j(
    "<div>ÔÜá´©Å Multiple tabs detected. Please close other Shopee/Tiktok Shop tabs to avoid issues.",
  ),
  gr = j("<div><h3>Task Controls"),
  inputTemplate = j(
    '<input type="text" placeholder="Enter keyword to sweep...">',
  ),
  ur = j("<div><h2>Autorun Scraping Extension</h2><p>Version: </p><p>Region: "),
  fr = j("<button>Log In"),
  dr = j("<p>Navigate to a Shopee page to start.");
const Ge = "https://rentmybrowser.com",
  mr = "1.4.1",
  pr = () => {
    const [e, t] = G(""),
      [r, s] = G(!1),
      [n, i] = G(!1);
    const [a, o] = G("id");
    const [c, u] = qe("email", "");
    const [p, h] = qe("captchaSolverEnabled", !1);
    const [v, x] = G(!1);
    const [searchKeyword, setSearchKeyword] = G("");
    chrome.storage.local.get(["isFetching"], (res) => {
      if (res.isFetching !== undefined) i(res.isFetching);
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.isFetching) i(changes.isFetching.newValue);
    });
    const w = async () => {
      const b = (await O.tabs.query({})).filter((C) => C.url && He(C.url));
      return (x(b.length > 1), b.length);
    };
    const M = async (y) => {
      const b = He(y);
      b ? (s(!0), o(b), t(y), await w()) : (s(!1), t(""), x(!1));
    };
    (ke(async () => {
      const y = async () => {
        try {
          const l = await D("getBackgroundState", {});
          (console.log("Background state:", l), l && i(l.isFetching));
        } catch (l) {
          console.error("Error updating background state:", l);
        }
      };
      y();
      const b = (l, g) => {
          g.status === "complete" && y();
        },
        C = (l, g, f) => {
          g.status === "complete" && f.active && f.url && M(f.url);
        },
        L = async (l) => {
          const g = await O.tabs.get(l.tabId);
          g.url && M(g.url);
        };
      (O.tabs.onUpdated.addListener(C),
        O.tabs.onActivated.addListener(L),
        O.tabs.onUpdated.addListener(b),
        O.tabs
          .query({
            active: !0,
            currentWindow: !0,
          })
          .then(async (l) => {
            l[0]?.url && M(l[0].url);
          }),
        ze(() => {
          (O.tabs.onUpdated.removeListener(C),
            O.tabs.onActivated.removeListener(L),
            O.tabs.onUpdated.removeListener(b));
        }));
    }),
      mt(async () => {
        try {
          if (!(await Y())?.id) return;
          const b = await D("getBackgroundState", {});
          (console.log("Background state:", b), b && i(b.isFetching));
        } catch (y) {
          console.error("Error initializing popup state:", y);
        }
      }));
    const $ = async () => {
        if (!r() || e().includes("/buyer/login")) {
          alert("Please navigate to a Shopee page and log in.");
          return;
        }
        if ((await w()) > 1) {
          alert(
            "Please close other Shopee/Tiktok Shop tabs before starting. Multiple tabs may cause issues.",
          );
          return;
        }
        const b = await Y();
        if (!b?.id) return;
        const C = b.id;
        (await D(
          "updateEmail",
          {
            email: c(),
          },
          {
            context: "content-script",
            tabId: b.id,
          },
        ),
          await D(
            "updateFetchingStatus",
            {
              isFetching: !0,
            },
            {
              context: "content-script",
              tabId: b.id,
            },
          ),
          await D("startTaskFetching", {
            region: a(),
            keyword: searchKeyword(),
          }),
          await O.tabs.sendMessage(C, {
            type: "updateMessage",
            content: "Starting task fetching...",
          }));
      },
      F = async () => {
        const y = await Y();
        y?.id &&
          (await D("stopTaskFetching", {}),
          await D(
            "updateFetchingStatus",
            {
              isFetching: !1,
            },
            {
              context: "content-script",
              tabId: y.id,
            },
          ));
      },
      U = async () => {
        try {
          const y = await Y();
          if (!y?.id) {
            alert("No active Shopee tab found. Please open a Shopee page.");
            return;
          }
          const b = await fetch(`${Ge}/api/isAuthorized`, {
            method: "GET",
            cache: "no-cache",
            redirect: "manual",
          });
          if ((console.log("Login response:", b), b.ok)) {
            const C = await b.json();
            (await D(
              "updateEmail",
              {
                email: C.email,
              },
              {
                context: "content-script",
                tabId: y.id,
              },
            ),
              u(C.email),
              await ee.setSetting("email", C.email));
          } else window.open(`${Ge}/login`, "_blank");
        } catch (y) {
          console.error("Login failed:", y);
        }
      },
      V = async () => {
        const y = await Y();
        if (!y?.id) {
          alert("No active Shopee tab found. Please open a Shopee page.");
          return;
        }
        (await ee.setSetting("email", ""),
          await D(
            "updateEmail",
            {
              email: "",
            },
            {
              context: "content-script",
              tabId: y.id,
            },
          ),
          n() && (await F()));
      };
    return (() => {
      var y = ur(),
        b = y.firstChild,
        C = b.nextSibling;
      C.firstChild;
      var L = C.nextSibling;
      return (
        L.firstChild,
        y.style.setProperty("padding", "16px"),
        y.style.setProperty("width", "320px"),
        J(C, mr, null),
        J(L, a, null),
        J(
          y,
          oe(be, {
            get when() {
              return c();
            },
            get fallback() {
              return (() => {
                var l = fr();
                return ((l.$$click = U), l);
              })();
            },
            get children() {
              return [
                (() => {
                  var l = or();
                  return (l.firstChild, J(l, c, null), l);
                })(),
                (() => {
                  var l = ir();
                  return ((l.$$click = V), Z(() => (l.disabled = n())), l);
                })(),
                (() => {
                  var l = ar(),
                    g = l.firstChild,
                    f = g.nextSibling,
                    d = f.firstChild,
                    A = d.firstChild;
                  return (
                    l.style.setProperty("margin-top", "16px"),
                    f.style.setProperty("display", "flex"),
                    f.style.setProperty("align-items", "center"),
                    f.style.setProperty("gap", "8px"),
                    f.style.setProperty("margin-top", "8px"),
                    d.style.setProperty("display", "flex"),
                    d.style.setProperty("align-items", "center"),
                    d.style.setProperty("gap", "8px"),
                    d.style.setProperty("cursor", "pointer"),
                    A.addEventListener("change", (P) =>
                      h(P.currentTarget.checked),
                    ),
                    A.style.setProperty("cursor", "pointer"),
                    Z(() => (A.checked = p())),
                    l
                  );
                })(),
                (() => {
                  var l = gr();
                  return (
                    l.firstChild,
                    l.style.setProperty("margin-top", "16px"),
                    J(
                      l,
                      oe(be, {
                        get when() {
                          return r();
                        },
                        get fallback() {
                          return dr();
                        },
                        get children() {
                          return [
                            (() => {
                              var inp = inputTemplate();
                              inp.oninput = (e) =>
                                setSearchKeyword(e.target.value);
                              inp.style.setProperty("width", "100%");
                              inp.style.setProperty("padding", "8px");
                              inp.style.setProperty("margin-top", "8px");
                              inp.style.setProperty("border", "1px solid #ccc");
                              inp.style.setProperty("border-radius", "4px");
                              Z(() => (inp.disabled = r()));
                              return inp;
                            })(),
                            (() => {
                              var g = lr(),
                                f = g.firstChild,
                                d = f.nextSibling;
                              return (
                                g.style.setProperty("display", "flex"),
                                g.style.setProperty("gap", "8px"),
                                g.style.setProperty("margin-top", "8px"),
                                (f.$$click = $),
                                f.style.setProperty(
                                  "background-color",
                                  "#4CAF50",
                                ),
                                f.style.setProperty("color", "white"),
                                f.style.setProperty("border", "none"),
                                f.style.setProperty("padding", "8px 16px"),
                                f.style.setProperty("border-radius", "4px"),
                                f.style.setProperty("cursor", "pointer"),
                                f.style.setProperty(
                                  "transition",
                                  "opacity 0.2s ease",
                                ),
                                (d.$$click = F),
                                d.style.setProperty(
                                  "background-color",
                                  "#f44336",
                                ),
                                d.style.setProperty("color", "white"),
                                d.style.setProperty("border", "none"),
                                d.style.setProperty("padding", "8px 16px"),
                                d.style.setProperty("border-radius", "4px"),
                                d.style.setProperty("cursor", "pointer"),
                                d.style.setProperty(
                                  "transition",
                                  "opacity 0.2s ease",
                                ),
                                Z(
                                  (A) => {
                                    var P = n(),
                                      I = n() ? "0.6" : "1",
                                      m = !n(),
                                      _ = n() ? "1" : "0.6";
                                    return (
                                      P !== A.e && (f.disabled = A.e = P),
                                      I !== A.t &&
                                        ((A.t = I) != null
                                          ? f.style.setProperty("opacity", I)
                                          : f.style.removeProperty("opacity")),
                                      m !== A.a && (d.disabled = A.a = m),
                                      _ !== A.o &&
                                        ((A.o = _) != null
                                          ? d.style.setProperty("opacity", _)
                                          : d.style.removeProperty("opacity")),
                                      A
                                    );
                                  },
                                  {
                                    e: void 0,
                                    t: void 0,
                                    a: void 0,
                                    o: void 0,
                                  },
                                ),
                                g
                              );
                            })(),
                            oe(be, {
                              get when() {
                                return v();
                              },
                              get children() {
                                var g = cr();
                                return (
                                  g.style.setProperty("padding", "8px"),
                                  g.style.setProperty("color", "#856404"),
                                  g
                                );
                              },
                            }),
                          ];
                        },
                      }),
                      null,
                    ),
                    l
                  );
                })(),
              ];
            },
          }),
          null,
        ),
        y
      );
    })();
  };
vt(["click"]);
wt(() => oe(pr, {}), document.getElementById("root"));
