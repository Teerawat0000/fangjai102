(function () {
"use strict";

var DEF = {
  siteName: "ฟังใจ", heroTitle: "มีอะไรในใจ เล่าให้ฟังได้", heroText: "", cardConsult: "", cardSuggest: "",
  privacyNote: "", disclaimer: "", greeting: "สวัสดี ช่วงนี้เป็นยังไงบ้าง มีอะไรค้างในใจอยู่ไหม",
  officerName: "เจ้าหน้าที่สภา", officerIntro: "", categories: ["อื่นๆ"], hotlines: [], aiEnabled: true
};
var CRISIS = /ฆ่าตัวตาย|อยากตาย|ไม่อยากมีชีวิต|ไม่อยากอยู่|ทำร้ายตัวเอง|กรีดแขน|กรีดข้อมือ|จบชีวิต|หายไปจากโลก|กินยาเกินขนาด|ล่วงละเมิด|ข่มขืน|โดนทำร้าย|ถูกทำร้าย/;

var API_BASE = String(window.FJ_API_BASE || "").replace(/\/+$/, "");
// โหมดไม่มีเซิร์ฟเวอร์ (เช่น GitHub Pages): ไม่เรียก /api เลย แสดงหน้าเว็บอย่างเดียว
var STATIC = !API_BASE && window.FJ_STATIC === true;
function $(id) { return document.getElementById(id); }
function h(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); }
function fmt(t) { try { return new Date(t).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
function rid(p) { return p + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }
function toast(t) { var d = h("div", "toast", t); document.body.appendChild(d); setTimeout(function () { d.remove(); }, 2200); }
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

var S = JSON.parse(JSON.stringify(DEF));
var TOKEN = null, online = false;
var notes = [];
function newMe() { return { code: "----", nick: "", anon: true, threads: {}, officer: { messages: [] }, suggestions: {}, officerSeen: 0, updated: Date.now() }; }
var me = newMe();
var staff = { replies: {} };
var cur = null, busy = false, ctl = null;

async function req(method, url, body, signal) {
  var opt = { method: method, headers: {}, signal: signal };
  if (TOKEN) opt.headers.Authorization = "Bearer " + TOKEN;
  if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  var r = await fetch(API_BASE + url, opt), j = null;
  try { j = await r.json(); } catch (e) {}
  return { status: r.status, data: j };
}

/* ---------- settings ---------- */
function mergeSettings(d) {
  S = Object.assign(JSON.parse(JSON.stringify(DEF)), d || {});
  if (!Array.isArray(S.categories) || !S.categories.length) S.categories = DEF.categories;
  if (!Array.isArray(S.hotlines)) S.hotlines = [];
}
var FALLBACK_HOT = [{ label: "การแพทย์ฉุกเฉิน", number: "1669" }, { label: "สายด่วนสุขภาพจิต", number: "1323" }];
function fillHot(box, useFallback) {
  clear(box);
  var list = (!S.hotlines.length && useFallback) ? FALLBACK_HOT : S.hotlines;
  list.forEach(function (x) { box.appendChild(h("span", null, x.label + " " + x.number)); });
}
function applySettings() {
  $("brandName").textContent = S.siteName;
  $("heroTitle").textContent = S.heroTitle;
  $("heroText").textContent = S.heroText;
  $("cardConsult").textContent = S.cardConsult;
  $("cardSuggest").textContent = S.cardSuggest;
  $("privacyNote").textContent = S.privacyNote;
  $("footDisclaimer").textContent = S.disclaimer;
  $("gateDisclaimer").textContent = S.disclaimer;
  $("officerTitle").textContent = S.officerName;
  $("officerIntro").textContent = S.officerIntro;
  fillHot($("homeHot"));
  var sel = $("sCat"), old = sel.value; clear(sel);
  S.categories.forEach(function (c) { var o = h("option", null, c); o.value = c; sel.appendChild(o); });
  if (old) sel.value = old;
  document.title = S.siteName;
  renderCrisis();
}

/* ---------- saving ---------- */
var saveTimer = null, saving = false, dirty = false;
function setSaveState(s) {
  var e = $("saveState"); e.hidden = false;
  e.textContent = !online ? "ยังไม่ได้บันทึก" : (s === "saving" ? "กำลังบันทึก…" : (s === "error" ? "บันทึกไม่สำเร็จ" : "บันทึกแล้ว"));
}
function touch() {
  me.updated = Date.now(); dirty = true;
  clearTimeout(saveTimer); saveTimer = setTimeout(flush, 500);
  if (online) setSaveState("saving");
}
async function flush() {
  if (!dirty) return;
  if (!online) { dirty = false; return; }
  if (saving) { saveTimer = setTimeout(flush, 400); return; }
  saving = true; dirty = false;
  try {
    var r = await req("PUT", "/api/me", me);
    if (r.status === 200) setSaveState("saved");
    else if (r.status === 401) { setSaveState("error"); notes.push("เซสชันหมดอายุ ลองรีเฟรชหน้านี้"); renderBanner(); }
    else { setSaveState("error"); if (r.status === 413) { notes.push("ข้อมูลของคุณมากเกินไป ลองเริ่มเรื่องใหม่"); renderBanner(); } }
  } catch (e) { setSaveState("error"); dirty = true; }
  finally { saving = false; if (dirty) saveTimer = setTimeout(flush, 3000); }
}
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden" && dirty) { clearTimeout(saveTimer); flush(); }
  if (document.visibilityState === "visible") pollReplies();
});

/* ---------- banner / routing ---------- */
function curView() { var v = (location.hash || "#home").slice(1); return VIEWS.indexOf(v) < 0 ? "home" : v; }
function renderBanner() {
  var b = $("banner"); clear(b);
  if (!notes.length || (STATIC && curView() === "home")) { b.hidden = true; return; }
  b.hidden = false;
  notes.forEach(function (n) { b.appendChild(h("div", null, n)); });
}
var VIEWS = ["home", "consult", "suggest", "officer"];
function route() {
  var v = (location.hash || "#home").slice(1);
  if (VIEWS.indexOf(v) < 0) v = "home";
  document.querySelectorAll("[data-view]").forEach(function (el) { el.hidden = el.getAttribute("data-view") !== v; });
  document.querySelectorAll("#nav a").forEach(function (a) { if (a.getAttribute("data-v") === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  if (v === "consult") refreshWho();
  if (v === "officer") { renderOfficer(); markSeen(); }
  if (v === "suggest") renderSuggest();
  renderBanner();
}
window.addEventListener("hashchange", route);

/* ---------- privacy ---------- */
function whoLabel() { return me.anon ? ("ผู้ใช้ #" + me.code) : ((me.nick || "ผู้ใช้ไม่ระบุชื่อ") + " #" + me.code); }
function refreshWho() {
  var t = me.anon ? ("ตอนนี้ส่งแบบไม่ระบุตัวตน: เจ้าหน้าที่เห็นเป็น ผู้ใช้ #" + me.code) : ("ตอนนี้ส่งโดยใช้ชื่อเล่น: " + (me.nick || "(ยังไม่ได้ใส่)") + " (รหัส #" + me.code + ")");
  $("privState").textContent = t;
  $("whoami").textContent = whoLabel();
  $("sWho").textContent = t + " เปลี่ยนได้ที่หน้าแรก";
  $("oWho").textContent = t + " เปลี่ยนได้ที่หน้าแรก";
}
function syncPrivacyUI() { $("anon").checked = me.anon; $("nickBox").hidden = me.anon; $("nick").value = me.nick || ""; refreshWho(); }
$("anon").addEventListener("change", function () { me.anon = $("anon").checked; if (me.anon) me.nick = ""; $("nickBox").hidden = me.anon; refreshWho(); touch(); });
var nickT = null;
$("nick").addEventListener("input", function () { clearTimeout(nickT); nickT = setTimeout(function () { me.nick = $("nick").value.trim().slice(0, 30); refreshWho(); touch(); }, 500); });
var wipeArmed = false;
$("wipeBtn").addEventListener("click", function () {
  var b = $("wipeBtn"), n = $("wipeNote");
  if (!wipeArmed) {
    wipeArmed = true; b.textContent = "กดอีกครั้งเพื่อยืนยัน";
    n.hidden = false; n.textContent = "จะลบรหัสของคุณออกจากเครื่องนี้ แชทเดิมจะเปิดกลับมาในเครื่องนี้ไม่ได้อีก (เจ้าหน้าที่ยังเห็นข้อความที่ส่งไปแล้ว) เหมาะกับการใช้เครื่องร่วมกับคนอื่น";
    setTimeout(function () { wipeArmed = false; b.textContent = "ไม่ใช่เครื่องของฉัน / ล้างข้อมูลในเครื่องนี้"; n.hidden = true; }, 6000);
    return;
  }
  lsDel("fj_token"); TOKEN = null; location.hash = "#home"; location.reload();
});

/* ---------- consult ---------- */
function renderPrev() {
  var ids = Object.keys(me.threads).sort(function (a, b) { return me.threads[b].updated - me.threads[a].updated; }).slice(0, 5);
  var box = $("prevList"); clear(box);
  $("prevBox").hidden = !ids.length;
  ids.forEach(function (id) {
    var t = me.threads[id], first = "";
    for (var i = 0; i < t.messages.length; i++) { if (t.messages[i].r === "me") { first = t.messages[i].text; break; } }
    var b = h("button", "btn ghost small", fmt(t.updated) + " · " + (first.length > 34 ? first.slice(0, 34) + "…" : first));
    b.type = "button"; b.style.textAlign = "left";
    b.addEventListener("click", function () { if (!$("agree").checked) { toast("ติ๊กรับทราบก่อนนะ"); return; } openThread(t); });
    box.appendChild(b);
  });
}
function openThread(t) { cur = t; $("gate").hidden = true; $("chatBox").hidden = false; renderChat(); renderCrisis(); $("chatInput").focus(); }
function newThread() {
  cur = { id: rid("t"), started: Date.now(), updated: Date.now(), risk: 0, messages: [{ r: "ai", text: S.greeting, t: Date.now(), greet: true }] };
  $("gate").hidden = true; $("chatBox").hidden = false; renderChat(); renderCrisis(); $("chatInput").focus();
}
$("agree").addEventListener("change", function () { $("start").disabled = !$("agree").checked; });
$("start").addEventListener("click", newThread);
$("endBtn").addEventListener("click", function () {
  if (busy && ctl) ctl.abort();
  cur = null; $("chatBox").hidden = true; $("gate").hidden = false; $("agree").checked = false; $("start").disabled = true; renderPrev();
});
function bubble(m) {
  var d = h("div", "msg " + m.r);
  d.appendChild(document.createTextNode(m.text));
  return d;
}
function renderChat() {
  var c = $("chat"); clear(c);
  if (!cur) return;
  cur.messages.forEach(function (m) { c.appendChild(bubble(m)); });
  c.scrollTop = c.scrollHeight;
}
function renderCrisis() {
  var b = $("crisisBox"); clear(b);
  if (!cur || cur.risk < 1) { b.hidden = true; return; }
  b.hidden = false;
  var n = h("div", "notice" + (cur.risk >= 2 ? " crisis" : ""));
  if (cur.risk >= 2) {
    n.appendChild(h("b", null, "เรื่องนี้สำคัญมาก ขอให้มีคนที่ช่วยได้จริงอยู่ข้างๆ"));
    n.appendChild(h("div", null, "AI ดูแลเรื่องนี้ได้ไม่พอ รบกวนติดต่อสายด่วนตอนนี้ และบอกผู้ใหญ่ที่ไว้ใจ เช่น ครู หรือคนที่บ้าน"));
    var hl = h("div", "hotline"); fillHot(hl, true); n.appendChild(hl);
  } else {
    n.appendChild(h("b", null, "ถ้าเรื่องนี้หนักหรือเป็นมานาน"));
    n.appendChild(h("div", null, "ลองคุยกับแพทย์หรือผู้เชี่ยวชาญด้านสุขภาพใจดูนะ ไม่ต้องรอให้แย่ลงก่อน"));
  }
  var a = h("a", "btn warm small", "คุยกับ" + S.officerName); a.href = "#officer"; a.style.marginTop = "10px"; n.appendChild(a);
  b.appendChild(n);
}
function errText(status) {
  if (!online) return "ตอนนี้ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ ผู้ช่วย AI ตอบไม่ได้ และข้อความนี้ยังไม่ได้ถูกส่งหรือบันทึกไว้ที่ไหน ถ้าเรื่องนี้เร่งด่วน กรุณาติดต่อสายด่วนหรือผู้ใหญ่ที่ไว้ใจได้โดยตรง";
  if (status === 429) return "ใช้ผู้ช่วย AI ถี่เกินไป รอสักครู่แล้วลองใหม่นะ ข้อความของน้องยังถูกเก็บไว้ให้เจ้าหน้าที่";
  if (status === 503 || status === "off") return "ตอนนี้ผู้ช่วย AI ยังไม่พร้อมใช้ แต่ข้อความของน้องถูกเก็บไว้ให้เจ้าหน้าที่แล้ว ถ้าอยากคุยกับคนจริง กด “คุยกับเจ้าหน้าที่” ได้เลย";
  return "ผู้ช่วย AI ตอบไม่ได้ในตอนนี้ ลองส่งใหม่อีกครั้ง หรือกด “คุยกับเจ้าหน้าที่” ได้เลย";
}
async function send(text) {
  if (busy || !cur) return;
  busy = true; $("sendBtn").disabled = true;
  if (!me.threads[cur.id]) me.threads[cur.id] = cur;
  cur.messages.push({ r: "me", text: text, t: Date.now() });
  cur.updated = Date.now();
  if (CRISIS.test(text) && cur.risk < 2) cur.risk = 2;
  renderChat(); renderCrisis(); touch();
  var bub = h("div", "msg ai", "กำลังพิมพ์…"); $("chat").appendChild(bub); $("chat").scrollTop = $("chat").scrollHeight;
  try {
    if (!online || !S.aiEnabled) throw { status: "off" };
    ctl = new AbortController(); $("stopBtn").hidden = false;
    var msgs = cur.messages.filter(function (m) { return (m.r === "me" || m.r === "ai") && !m.greet; }).slice(-16).map(function (m) { return { r: m.r, text: m.text }; });
    var r = await req("POST", "/api/chat", { messages: msgs, nick: me.anon ? "" : me.nick }, ctl.signal);
    if (r.status !== 200) { if (r.data && r.data.risk > cur.risk) cur.risk = r.data.risk; throw { status: r.status }; }
    cur.messages.push({ r: "ai", text: r.data.text, t: Date.now() });
    if (r.data.risk > cur.risk) cur.risk = r.data.risk;
  } catch (e) {
    if (!(e && e.name === "AbortError")) cur.messages.push({ r: "sys", text: errText(e && e.status), t: Date.now() });
  } finally {
    cur.updated = Date.now(); ctl = null; $("stopBtn").hidden = true; busy = false; $("sendBtn").disabled = false;
    renderChat(); renderCrisis(); touch();
  }
}
$("chatForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var i = $("chatInput"), v = i.value.trim();
  if (!v) return;
  i.value = ""; send(v);
});
$("stopBtn").addEventListener("click", function () { if (ctl) ctl.abort(); });

/* ---------- suggest ---------- */
function renderSuggest() {
  var ids = Object.keys(me.suggestions).sort(function (a, b) { return me.suggestions[b].t - me.suggestions[a].t; });
  $("mySugBox").hidden = !ids.length;
  var box = $("mySug"); clear(box);
  ids.forEach(function (id) {
    var s = me.suggestions[id], d = h("div", "notice");
    d.appendChild(h("b", null, s.cat + " · " + fmt(s.t)));
    d.appendChild(h("div", null, s.text));
    box.appendChild(d);
  });
}
$("suggestForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var txt = $("sMsg").value.trim(); if (!txt) return;
  if (!online) { toast("ยังส่งไม่ได้ เพราะยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์"); return; }
  var id = rid("s");
  me.suggestions[id] = { id: id, cat: $("sCat").value, text: txt, t: Date.now(), nick: me.anon ? "" : me.nick };
  touch();
  $("sMsg").value = ""; $("suggestForm").hidden = true; $("suggestDone").hidden = false; renderSuggest();
});
$("sAgain").addEventListener("click", function () { $("suggestForm").hidden = false; $("suggestDone").hidden = true; $("sMsg").focus(); });

/* ---------- officer ---------- */
function officerItems() {
  var items = [];
  (me.officer.messages || []).forEach(function (m) { items.push({ from: "me", text: m.text, t: m.t }); });
  var rp = staff.replies || {};
  Object.keys(rp).forEach(function (k) { items.push({ from: "staff", text: rp[k].text, t: rp[k].t || Number(k) }); });
  items.sort(function (a, b) { return a.t - b.t; });
  return items;
}
function unseenCount() { var n = 0; officerItems().forEach(function (i) { if (i.from === "staff" && i.t > (me.officerSeen || 0)) n++; }); return n; }
function updateBadge() { var n = unseenCount(), d = $("offDot"); d.hidden = !n; d.textContent = n; }
function markSeen() {
  var mx = me.officerSeen || 0;
  officerItems().forEach(function (i) { if (i.from === "staff" && i.t > mx) mx = i.t; });
  if (mx > (me.officerSeen || 0)) { me.officerSeen = mx; touch(); }
  updateBadge();
}
function renderOfficer() {
  var log = $("offLog"); clear(log);
  var items = officerItems();
  if (!items.length) log.appendChild(h("div", "msg sys", "ยังไม่มีข้อความ พิมพ์ด้านล่างเพื่อเริ่มคุยกับเจ้าหน้าที่ได้เลย"));
  items.forEach(function (i) {
    var d = h("div", "msg " + (i.from === "me" ? "me" : "staff"));
    if (i.from === "staff") d.appendChild(h("span", "who", S.officerName));
    d.appendChild(document.createTextNode(i.text));
    d.appendChild(h("span", "when", fmt(i.t)));
    log.appendChild(d);
  });
  log.scrollTop = log.scrollHeight;
  updateBadge();
}
$("officerForm").addEventListener("submit", function (e) {
  e.preventDefault();
  var txt = $("oMsg").value.trim(); if (!txt) return;
  if (!online) { toast("ยังส่งไม่ได้ เพราะยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์"); return; }
  me.officer.messages = me.officer.messages || [];
  me.officer.messages.push({ id: rid("o"), text: txt, t: Date.now(), nick: me.anon ? "" : me.nick });
  touch(); $("oMsg").value = ""; renderOfficer();
});
async function pollReplies() {
  if (!online || !TOKEN || document.visibilityState !== "visible") return;
  try {
    var r = await req("GET", "/api/replies");
    if (r.status === 200 && r.data) {
      staff.replies = r.data.replies || {};
      if ((location.hash || "") === "#officer") { renderOfficer(); markSeen(); } else updateBadge();
    }
  } catch (e) {}
}
setInterval(pollReplies, 30000);

/* ---------- boot ---------- */
function loadMe(d) {
  me = Object.assign(newMe(), d.me || {});
  me.threads = me.threads || {}; me.officer = me.officer || { messages: [] }; me.officer.messages = me.officer.messages || []; me.suggestions = me.suggestions || {};
  staff.replies = d.replies || {};
}
async function boot() {
  applySettings(); syncPrivacyUI(); renderPrev(); renderSuggest(); renderOfficer(); route();
  if (STATIC) {
    mergeSettings(window.FJ_SETTINGS); applySettings();
    notes.push("ตอนนี้เป็นโหมดแสดงตัวอย่าง ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์ ข้อความที่พิมพ์จะไม่ถูกส่งและไม่ถูกบันทึก");
    renderBanner(); syncPrivacyUI(); renderPrev(); renderSuggest(); renderOfficer(); route();
    return;
  }
  TOKEN = lsGet("fj_token");
  try {
    var s = await req("GET", "/api/settings");
    if (s.status === 200) { mergeSettings(s.data); applySettings(); }
    if (TOKEN) {
      var m = await req("GET", "/api/me");
      if (m.status === 200) { loadMe(m.data); mergeSettings(m.data.settings); applySettings(); } else TOKEN = null;
    }
    if (!TOKEN) {
      var c = await req("POST", "/api/session", {});
      if (c.status !== 200) throw new Error("session");
      TOKEN = c.data.token; me.code = c.data.code;
      if (!lsSet("fj_token", TOKEN)) { notes.push("เบราว์เซอร์นี้เก็บรหัสไว้ไม่ได้ (อาจเปิดโหมดส่วนตัว) แชทจะคุยต่อไม่ได้เมื่อปิดหน้านี้"); }
    }
    online = true; setSaveState("saved");
  } catch (e) {
    online = false; notes.push("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองรีเฟรชหน้านี้ ข้อความที่พิมพ์ตอนนี้จะไม่ถูกส่งและไม่ถูกบันทึก"); setSaveState("local");
  }
  renderBanner(); syncPrivacyUI(); renderPrev(); renderSuggest(); renderOfficer(); route();
}
boot();
})();
