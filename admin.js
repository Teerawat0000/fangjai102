(function () {
"use strict";

var API_BASE = String(window.FJ_API_BASE || "").replace(/\/+$/, "");
var STATIC = !API_BASE && window.FJ_STATIC === true;
function $(id) { return document.getElementById(id); }
function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
function fmt(t) { try { return new Date(t).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
function toast(t) { var d = h("div", "toast", t); document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200); }

var A = { students: {}, triage: {}, settings: null, defaults: null, sel: null, tab: "inbox", pending: false, formDirty: false, timer: null };

async function call(method, url, body) {
  var opt = { method: method, headers: { "X-Requested-With": "fj" }, credentials: API_BASE ? "include" : "same-origin" };
  if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  var r, j = null;
  try { r = await fetch(API_BASE + url, opt); } catch (e) { return { status: 0, data: null }; }
  try { j = await r.json(); } catch (e) {}
  if (r.status === 401 && url !== "/api/admin/login") { showLogin("เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง"); }
  return { status: r.status, data: j };
}

/* ---------- login ---------- */
function showLogin(msg) {
  clearInterval(A.timer);
  $("adminApp").hidden = true; $("loginBox").hidden = false; $("loginMsg").textContent = msg || ""; $("pw").value = "";
}
$("loginForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  $("loginMsg").textContent = "";
  var r = await call("POST", "/api/admin/login", { password: $("pw").value });
  if (r.status === 200) { $("loginBox").hidden = true; $("adminApp").hidden = false; await load(true); A.timer = setInterval(function () { load(false); }, 20000); }
  else if (r.status === 429) $("loginMsg").textContent = "ลองผิดหลายครั้ง รอสักครู่แล้วลองใหม่";
  else if (r.status === 401 || r.status === 403) $("loginMsg").textContent = "รหัสผ่านไม่ถูกต้อง";
  else $("loginMsg").textContent = "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง";
});
if (STATIC) {
  $("loginMsg").textContent = "หน้านี้ต้องใช้เซิร์ฟเวอร์หลังบ้าน ซึ่งยังไม่ได้เชื่อมต่อ จึงเข้าสู่ระบบไม่ได้";
  $("pw").disabled = true; $("loginForm").querySelector("button[type=submit]").disabled = true;
}
$("logoutBtn").addEventListener("click", async function () { await call("POST", "/api/admin/logout", {}); showLogin("ออกจากระบบแล้ว"); });

async function load(first) {
  var r = await call("GET", "/api/admin/data");
  if (r.status !== 200) return;
  A.students = r.data.students || {}; A.triage = r.data.triage || {}; A.settings = r.data.settings; A.defaults = r.data.defaults;
  if (first) { fillSettingsForm(true); $("brandName").textContent = (A.settings.siteName || "ฟังใจ") + " · เจ้าของ"; }
  else fillSettingsForm(false);
  render(first);
}

/* ---------- inbox ---------- */
function adminName(d) { return d.anon ? ("ผู้ใช้ #" + d.code) : ((d.nick || "ไม่ระบุชื่อ") + " #" + d.code); }
function maxOf(arr, f) { var m = 0; arr.forEach(function (x) { var v = f(x); if (v > m) m = v; }); return m; }
function summarize(id) {
  var d = A.students[id] || {};
  var threads = Object.keys(d.threads || {}).map(function (k) { return d.threads[k]; });
  var urgent = threads.some(function (t) { var tr = A.triage[t.id]; return t.risk >= 2 && !(tr && tr.status === "handled"); });
  var om = (d.officer && d.officer.messages) || [];
  var lastMe = maxOf(om, function (m) { return m.t; });
  var rp = d.replies || {};
  var lastStaff = maxOf(Object.keys(rp), function (k) { return rp[k].t || Number(k); });
  return { d: d, threads: threads, urgent: urgent, waiting: lastMe > lastStaff, sug: Object.keys(d.suggestions || {}).length, updated: d.updated || 0 };
}
function render(force) {
  var det = $("aDetail");
  if (!force && det.contains(document.activeElement) && document.activeElement.tagName !== "BUTTON") { A.pending = true; return; }
  A.pending = false;
  var ids = Object.keys(A.students), weekAgo = Date.now() - 7 * 86400000;
  var nThreads = 0, nSug = 0, nWait = 0, nUrg = 0;
  var rows = ids.map(function (id) {
    var s = summarize(id); s.id = id;
    s.threads.forEach(function (t) { if (t.updated > weekAgo) nThreads++; });
    nSug += s.sug; if (s.waiting) nWait++; if (s.urgent) nUrg++; return s;
  });
  var st = $("aStats"); clear(st);
  [["บทสนทนาสัปดาห์นี้", nThreads], ["ข้อเสนอถึงสภา", nSug], ["รอเจ้าหน้าที่ตอบ", nWait], ["ต้องดูแลด่วน", nUrg]].forEach(function (x) {
    var d = h("div", "stat"), b = h("b", null, String(x[1]));
    if (x[0] === "ต้องดูแลด่วน" && x[1]) b.style.color = "var(--crisis)";
    d.appendChild(b); d.appendChild(h("span", null, x[0])); st.appendChild(d);
  });
  var need = nWait + nUrg, ad = $("admDot"); ad.hidden = !need; ad.textContent = "ต้องดู " + need;
  document.title = (need ? "(" + need + ") " : "") + "ฟังใจ เจ้าของ";
  var f = $("aFilter").value;
  rows = rows.filter(function (r) { return f === "all" || (f === "urgent" && r.urgent) || (f === "waiting" && r.waiting); });
  rows.sort(function (a, b) { return (b.urgent - a.urgent) || (b.waiting - a.waiting) || (b.updated - a.updated); });
  var list = $("aList"); clear(list);
  if (!rows.length) list.appendChild(h("p", "muted", ids.length ? "ไม่มีรายการในตัวกรองนี้" : "ยังไม่มีข้อความจากน้องๆ"));
  rows.forEach(function (r) {
    var b = h("button", "srow"); b.type = "button"; if (r.id === A.sel) b.setAttribute("aria-current", "true");
    var l1 = h("div", "l1"); l1.appendChild(h("span", null, adminName(r.d))); l1.appendChild(h("span", "muted", fmt(r.updated)));
    var l2 = h("div", "l2");
    if (r.urgent) l2.appendChild(h("span", "pill urgent", "ด่วน"));
    if (r.waiting) l2.appendChild(h("span", "pill warn", "รอตอบ"));
    l2.appendChild(h("span", null, r.threads.length + " แชท · " + r.sug + " ข้อเสนอ"));
    b.appendChild(l1); b.appendChild(l2);
    b.addEventListener("click", function () { A.sel = r.id; render(true); });
    list.appendChild(b);
  });
  renderDetail();
}
function statusSel(opts, val, onChange) {
  var s = h("select");
  opts.forEach(function (o) { var op = h("option", null, o[1]); op.value = o[0]; s.appendChild(op); });
  s.value = val; s.addEventListener("change", function () { onChange(s.value); }); return s;
}
async function saveTriage(id, patch) {
  var c = A.triage[id] || {};
  var next = { id: id, status: c.status || "open", note: c.note || "" };
  Object.keys(patch).forEach(function (k) { next[k] = patch[k]; });
  var r = await call("POST", "/api/admin/triage", next);
  if (r.status === 200) { A.triage[id] = { status: next.status, note: next.note, t: Date.now() }; render(false); }
  else toast("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
}
function renderDetail() {
  var box = $("aDetail"); clear(box);
  var id = A.sel;
  if (!id || !A.students[id]) { box.appendChild(h("p", "muted", "เลือกรายการทางซ้ายเพื่อดูข้อความ")); return; }
  var s = summarize(id), d = s.d;
  box.appendChild(h("h3", null, adminName(d)));
  var oc = h("div", "stack");
  oc.appendChild(h("h3", null, "แชทกับเจ้าหน้าที่"));
  var items = [];
  ((d.officer && d.officer.messages) || []).forEach(function (m) { items.push({ from: "me", text: m.text, t: m.t }); });
  var rp = d.replies || {};
  Object.keys(rp).forEach(function (k) { items.push({ from: "staff", text: rp[k].text, t: rp[k].t || Number(k) }); });
  items.sort(function (a, b) { return a.t - b.t; });
  var bl = h("div", "bubbles");
  if (!items.length) bl.appendChild(h("p", "muted", "ยังไม่มีข้อความ ส่งข้อความหาน้องได้ น้องจะเห็นเมื่อกลับมาเปิดเว็บ"));
  items.forEach(function (i) {
    var m = h("div", "msg " + (i.from === "me" ? "ai" : "me"));
    m.appendChild(document.createTextNode(i.text)); m.appendChild(h("span", "when", (i.from === "me" ? "น้อง" : "เจ้าหน้าที่") + " · " + fmt(i.t))); bl.appendChild(m);
  });
  oc.appendChild(bl);
  var rf = h("form", "reply stack");
  var ta = h("textarea"); ta.maxLength = 1500; ta.placeholder = "พิมพ์ข้อความถึงน้องคนนี้"; ta.setAttribute("aria-label", "ข้อความถึงน้อง");
  var sb = h("button", "btn small", "ส่งข้อความ"); sb.type = "submit";
  rf.appendChild(ta); rf.appendChild(sb);
  rf.addEventListener("submit", async function (e) {
    e.preventDefault(); var t = ta.value.trim(); if (!t) return; sb.disabled = true;
    var r = await call("POST", "/api/admin/reply", { id: id, text: t });
    if (r.status === 200) { ta.value = ""; toast("ส่งแล้ว"); await load(false); render(true); } else toast("ส่งไม่สำเร็จ ลองใหม่อีกครั้ง");
    sb.disabled = false;
  });
  oc.appendChild(rf); box.appendChild(oc);

  box.appendChild(h("h3", null, "แชทกับผู้ช่วย AI (" + s.threads.length + ")"));
  s.threads.sort(function (a, b) { return b.updated - a.updated; }).forEach(function (t) {
    var tr = A.triage[t.id] || {};
    var th = h("div", "thread"), hd = h("div", "hd");
    var left = h("div", "row"); left.appendChild(h("b", null, fmt(t.started)));
    if (t.risk >= 2) left.appendChild(h("span", "pill urgent", "เสี่ยงสูง")); else if (t.risk === 1) left.appendChild(h("span", "pill warn", "ควรพบผู้เชี่ยวชาญ"));
    hd.appendChild(left);
    hd.appendChild(statusSel([["open", "ใหม่"], ["watching", "กำลังติดตาม"], ["handled", "ดูแลแล้ว"]], tr.status || "open", function (v) { saveTriage(t.id, { status: v }); }));
    th.appendChild(hd);
    var bb = h("div", "bubbles");
    t.messages.forEach(function (m) { var x = h("div", "msg " + (m.r === "me" ? "me" : m.r === "ai" ? "ai" : "sys")); x.textContent = m.text; bb.appendChild(x); });
    th.appendChild(bb);
    var nt = h("textarea"); nt.placeholder = "บันทึกของเจ้าของ (น้องไม่เห็น)"; nt.value = tr.note || ""; nt.maxLength = 800; nt.setAttribute("aria-label", "บันทึก");
    nt.addEventListener("change", function () { saveTriage(t.id, { note: nt.value }); });
    th.appendChild(nt); box.appendChild(th);
  });

  var sg = Object.keys(d.suggestions || {}).map(function (k) { return d.suggestions[k]; }).sort(function (a, b) { return b.t - a.t; });
  box.appendChild(h("h3", null, "ข้อเสนอถึงสภา (" + sg.length + ")"));
  sg.forEach(function (x) {
    var tr = A.triage[x.id] || {};
    var th = h("div", "thread"), hd = h("div", "hd");
    hd.appendChild(h("b", null, x.cat + " · " + fmt(x.t)));
    hd.appendChild(statusSel([["open", "ใหม่"], ["forwarded", "ส่งต่อสภาแล้ว"], ["done", "ดำเนินการแล้ว"]], tr.status || "open", function (v) { saveTriage(x.id, { status: v }); }));
    th.appendChild(hd); th.appendChild(h("p", null, x.text)); box.appendChild(th);
  });
}
$("aFilter").addEventListener("change", function () { render(true); });
$("aDetail").addEventListener("focusout", function () { setTimeout(function () { if (A.pending) render(true); }, 50); });
$("aTabs").addEventListener("click", function (e) {
  var b = e.target.closest("button"); if (!b) return;
  A.tab = b.getAttribute("data-t");
  document.querySelectorAll("#aTabs button").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
  $("aInbox").hidden = A.tab !== "inbox"; $("aSettings").hidden = A.tab !== "settings";
  if (A.tab === "settings") fillSettingsForm(true);
});

/* ---------- settings ---------- */
var SF = ["siteName", "heroTitle", "heroText", "cardConsult", "cardSuggest", "privacyNote", "disclaimer", "greeting", "officerName", "officerIntro", "persona"];
function fillSettingsForm(force) {
  if (!A.settings) return;
  if (!force && A.formDirty) return;
  var S = A.settings;
  SF.forEach(function (k) { $("f_" + k).value = S[k] || ""; });
  $("f_categories").value = S.categories.join("\n");
  $("f_hotlines").value = S.hotlines.map(function (x) { return x.label + " | " + x.number; }).join("\n");
  $("f_aiEnabled").checked = !!S.aiEnabled;
  $("f_aiTier").value = S.aiTier === "quick" ? "quick" : "default";
  A.formDirty = false;
}
$("setForm").addEventListener("input", function () { A.formDirty = true; $("setMsg").textContent = ""; });
$("setForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  var d = {};
  SF.forEach(function (k) { d[k] = $("f_" + k).value.trim(); });
  d.categories = $("f_categories").value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
  d.hotlines = $("f_hotlines").value.split("\n").map(function (l) { var p = l.split("|"); return { label: (p[0] || "").trim(), number: p.slice(1).join("|").trim() }; }).filter(function (x) { return x.label && x.number; });
  d.aiEnabled = $("f_aiEnabled").checked; d.aiTier = $("f_aiTier").value;
  if (!d.categories.length || !d.persona) { $("setMsg").textContent = "ต้องมีหมวดเรื่องอย่างน้อย 1 หมวดและคำสั่ง AI"; return; }
  $("setSave").disabled = true;
  var r = await call("PUT", "/api/admin/settings", d);
  if (r.status === 200) { A.formDirty = false; $("setMsg").textContent = "บันทึกแล้ว"; toast("บันทึกการตั้งค่าแล้ว"); await load(false); }
  else $("setMsg").textContent = "บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง";
  $("setSave").disabled = false;
});
var resetArmed = false;
$("setReset").addEventListener("click", async function () {
  var b = $("setReset");
  if (!resetArmed) { resetArmed = true; b.textContent = "กดอีกครั้งเพื่อยืนยัน"; setTimeout(function () { resetArmed = false; b.textContent = "คืนค่าเริ่มต้น"; }, 4000); return; }
  resetArmed = false; b.textContent = "คืนค่าเริ่มต้น";
  var r = await call("POST", "/api/admin/settings/reset", {});
  if (r.status === 200) { A.formDirty = false; $("setMsg").textContent = "คืนค่าเริ่มต้นแล้ว"; await load(true); }
  else $("setMsg").textContent = "ทำไม่สำเร็จ ลองใหม่อีกครั้ง";
});

/* ---------- boot: ลองเข้าด้วยคุกกี้เดิม ---------- */
(async function () {
  if (STATIC) return;
  var r = await call("GET", "/api/admin/data");
  if (r.status === 200) {
    $("loginBox").hidden = true; $("adminApp").hidden = false;
    A.students = r.data.students || {}; A.triage = r.data.triage || {}; A.settings = r.data.settings; A.defaults = r.data.defaults;
    fillSettingsForm(true); $("brandName").textContent = (A.settings.siteName || "ฟังใจ") + " · เจ้าของ"; render(true);
    A.timer = setInterval(function () { load(false); }, 20000);
  }
})();
})();
