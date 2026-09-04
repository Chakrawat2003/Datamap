const C = window.APP_CONFIG || {};
const $ = id => document.getElementById(id);
const dbConfigured = () => C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !C.SUPABASE_URL.includes("YOUR_");

const S = {
  sb: null, ch: null, session: null, room: "", passcode: "",
  adding: false, pending: null, editing: null, markers: new Map(),
  all: [], savedRooms: [], _locMarker: null, authMode: "signin"
};

const toast = s => {
  const el = $("toast");
  if (!el) return;
  el.textContent = s;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
};

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
const username = () => S.session?.user?.user_metadata?.username || S.session?.user?.email?.split("@")[0] || "ผู้ใช้";

// --- MAP INITIALIZATION ---
const map = L.map("map", { preferCanvas: true, zoomControl: false, minZoom: 0, maxZoom: 19 }).setView([13.7563, 100.5018], 6);
L.control.zoom({ position: "bottomright" }).addTo(map);

// Esri Imagery Hybrid (current): satellite imagery + current street/place labels in Thai.
// The imagery remains the existing Esri World Imagery raster layer.
const esriImageryUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" + (C.ESRI_API_KEY ? "?token=" + encodeURIComponent(C.ESRI_API_KEY) : "");
const esriImageryLayer = L.tileLayer(esriImageryUrl, {
  maxZoom: 19,
  maxNativeZoom: 19,
  attribution: "Imagery © Esri"
}).addTo(map);

// Current ArcGIS Static Basemap Tiles reference layer.
// This replaces the retired/legacy World_Transportation overlay and supports Thai labels.
const esriImageryLabelsUrl = "https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/arcgis/imagery/labels/static/tile/{z}/{y}/{x}?language=th" + (C.ESRI_API_KEY ? "&token=" + encodeURIComponent(C.ESRI_API_KEY) : "");
const esriImageryLabelsLayer = L.tileLayer(esriImageryLabelsUrl, {
  tileSize: 512,
  maxZoom: 19,
  maxNativeZoom: 19,
  opacity: 1,
  pane: "overlayPane",
  attribution: "Labels & streets © Esri"
}).addTo(map);

// DOL (Department of Lands) Layer
// Exact WMS source copied from the working QGIS layer properties:
// URL: https://ms.longdo.com/mapproxy/service
// Layer: dol
// WMS: 1.3.0
// CRS: EPSG:4326
// Format: image/png
const DOL_WMS_URL = "https://ms.longdo.com/mapproxy/service";
const DOL_WMS_LAYER = "dol";

const dolLayer = L.tileLayer.wms(DOL_WMS_URL, {
  layers: DOL_WMS_LAYER,
  styles: "",
  version: "1.3.0",
  format: "image/png",
  transparent: true,
  crs: L.CRS.EPSG4326,
  minZoom: 0,
  maxZoom: 19,
  maxNativeZoom: 19,
  tileSize: 256,
  opacity: 0.90,
  updateWhenIdle: false,
  keepBuffer: 2,
  attribution: "กรมที่ดิน (DOL) / Longdo MapProxy"
});

let dolOn = false;
let dolTileLoaded = false;
let dolTileErrors = 0;
let dolFallbackTimer = null;

function dolClearFallbackTimer() {
  if (dolFallbackTimer) {
    clearTimeout(dolFallbackTimer);
    dolFallbackTimer = null;
  }
}

dolLayer.on("tileload", () => {
  if (!dolOn) return;
  dolTileLoaded = true;
  dolTileErrors = 0;
  dolClearFallbackTimer();
  toast("เปิดชั้นข้อมูลแปลงที่ดิน (DOL) แล้ว — Longdo WMS");
});

dolLayer.on("tileerror", () => {
  if (!dolOn) return;
  dolTileErrors++;

  if (!dolTileLoaded && dolTileErrors >= 3) {
    dolClearFallbackTimer();
    toast("DOL Longdo WMS ตอบกลับผิดพลาด — กรุณาตรวจสอบการเชื่อมต่อหรือเซิร์ฟเวอร์");
  }
});

function toggleDol() {
  dolOn = !dolOn;

  if (dolOn) {
    dolTileLoaded = false;
    dolTileErrors = 0;
    dolClearFallbackTimer();

    dolLayer.addTo(map);
    toast("กำลังโหลด DOL จาก Longdo WMS...");

    dolFallbackTimer = setTimeout(() => {
      dolFallbackTimer = null;
      if (dolOn && !dolTileLoaded && dolTileErrors > 0) {
        toast("ไม่สามารถโหลด DOL จาก Longdo WMS ได้");
      }
    }, 7000);
  } else {
    map.removeLayer(dolLayer);
    dolClearFallbackTimer();
    dolTileLoaded = false;
    dolTileErrors = 0;
    toast("ปิดชั้นข้อมูลแปลงที่ดินแล้ว");
  }

  if ($("dolToggle")) $("dolToggle").classList.toggle("active", dolOn);
  if ($("mDolBtn")) $("mDolBtn").classList.toggle("active", dolOn);
}

if ($("dolToggle")) $("dolToggle").onclick = toggleDol;
if ($("mDolBtn")) $("mDolBtn").onclick = toggleDol;

const cluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 55, disableClusteringAtZoom: 16 }).addTo(map);

/* ── 7-ELEVEN LAYER ── */
const s11Cluster = L.markerClusterGroup({
  chunkedLoading: true, maxClusterRadius: 60, disableClusteringAtZoom: 17,
  iconCreateFunction: c => L.divIcon({ html: `<div>${c.getChildCount()}</div>`, className: "marker-cluster marker-cluster-s11", iconSize: [38, 38] })
});

const S11_ON_KEY = "pinmap-s11-on";
const S11_CUSTOM_KEY = "pinmap-s11-custom";     // user-added extra branches (array of records)
const S11_DELETED_KEY = "pinmap-s11-deleted";   // ids of default branches hidden by user
const S11_EDITS_KEY = "pinmap-s11-edits";       // { [id]: { n, a, note } } overrides for default branches

const loadJSON = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};

const S11 = {
  all: [],
  custom: loadJSON(S11_CUSTOM_KEY, []),
  deletedIds: new Set(loadJSON(S11_DELETED_KEY, [])),
  edits: new Map(Object.entries(loadJSON(S11_EDITS_KEY, {}))),
  on: localStorage.getItem(S11_ON_KEY) !== "0"
};

const s11Persist = () => {
  localStorage.setItem(S11_CUSTOM_KEY, JSON.stringify(S11.custom));
  localStorage.setItem(S11_DELETED_KEY, JSON.stringify([...S11.deletedIds]));
  localStorage.setItem(S11_EDITS_KEY, JSON.stringify(Object.fromEntries(S11.edits)));
};

// Some seven11-data.js versions do not contain an `id` field.
// Always create a stable key from the branch id/code, or finally its coordinates.
function s11Key(rec, index = 0) {
  const raw = rec?.id ?? rec?.branch_id ?? rec?.branchCode ?? rec?.code ?? rec?.รหัสสาขา;
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") return String(raw);
  const y = Number(rec?.y ?? rec?.lat ?? rec?.latitude);
  const x = Number(rec?.x ?? rec?.lng ?? rec?.lon ?? rec?.longitude);
  if (Number.isFinite(y) && Number.isFinite(x)) return `coord:${y.toFixed(7)},${x.toFixed(7)}`;
  return `idx:${index}`;
}

function s11PopupHtml(rec, opts = {}) {
  const gmapUrl = `https://www.google.com/maps/dir/?api=1&destination=${rec.y},${rec.x}`;
  const editBtn = opts.custom || opts.editable
    ? `<button type="button" class="pin-nav-link s11EditBtn" data-key="${esc(rec._s11Key ?? rec._localId ?? rec.id ?? "")}" data-custom="${opts.custom ? "1" : "0"}" style="background:#111;position:relative;z-index:10000;pointer-events:auto;touch-action:manipulation">✎ แก้ไข</button>`
    : "";
  return `<div class="pin-title">🏪 ${esc(rec.n)}</div>
    <div>${esc(rec.a)}</div>
    ${rec.note ? `<div class="pin-note">${esc(rec.note)}</div>` : ""}
    <div class="pin-meta"><a href="${gmapUrl}" target="_blank" rel="noopener" class="pin-nav-link">🧭 นำทาง (Google Maps)</a> ${editBtn}</div>`;
}

const S11_COLORS = {
  green: "#008450",
  red: "#ef4444",
  blue: "#2563eb",
  yellow: "#eab308"
};

function s11SafeColor(color) {
  if (color === "default" || !color) return S11_COLORS.green;
  if (S11_COLORS[color]) return S11_COLORS[color];
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : S11_COLORS.green;
}

function s11MakeIcon(color = "green") {
  const border = s11SafeColor(color);
  const html = `<span class="s11-logo-marker" style="--s11-border:${border}">
    <img src="7-11-logo.png" alt="7-Eleven" draggable="false">
  </span>`;
  return L.divIcon({
    className: "s11-logo-icon",
    html,
    iconSize: [50, 50],
    iconAnchor: [25, 25],
    popupAnchor: [0, -22]
  });
}

function s11BuildAll() {
  const base = (window.SEVEN11_DATA || [])
    .map((rec, index) => {
      const key = s11Key(rec, index);
      return { rec, key };
    })
    .filter(({ key }) => !S11.deletedIds.has(String(key)))
    .map(({ rec, key }) => {
      const edit = S11.edits.get(String(key)) || {};
      const merged = { ...rec, ...edit, _s11Key: key };
      const m = L.marker([merged.y, merged.x], { icon: s11MakeIcon(merged.color) });
      m.bindPopup(s11PopupHtml(merged, { editable: true }), { closeButton: true, autoClose: true, closeOnClick: false });
      m.on("popupopen", ev => {
        const btn = ev.popup.getElement()?.querySelector(".s11EditBtn");
        if (btn) btn.onclick = click => { click.preventDefault(); click.stopPropagation(); openS11Modal(merged, null, false, key); };
      });
      return { rec: merged, m, id: key, key, isCustom: false };
    });
  const custom = S11.custom.map(rec => {
    const key = rec._s11Key || rec._localId;
    rec._s11Key = key;
    const m = L.marker([rec.y, rec.x], { icon: s11MakeIcon(rec.color) });
    m.bindPopup(s11PopupHtml(rec, { custom: true }), { closeButton: true, autoClose: true, closeOnClick: false });
    m.on("popupopen", ev => {
      const btn = ev.popup.getElement()?.querySelector(".s11EditBtn");
      if (btn) btn.onclick = click => { click.preventDefault(); click.stopPropagation(); openS11Modal(rec, null, true); };
    });
    return { rec, m, id: key, key, isCustom: true };
  });
  S11.all = base.concat(custom);
}

function s11Update() {
  if (!window.SEVEN11_DATA) return;
  if (!S11.all.length) s11BuildAll();
  const q = (($("search") ? $("search").value : "") || ($("mSearchInput") ? $("mSearchInput").value : "")).toLowerCase().trim();
  const list = q ? S11.all.filter(x => (x.rec.n + " " + x.rec.a).toLowerCase().includes(q)) : (S11.on ? S11.all : []);
  s11Cluster.clearLayers();
  if (list.length) s11Cluster.addLayers(list.map(x => x.m));
  if (list.length && !map.hasLayer(s11Cluster)) s11Cluster.addTo(map);
  if (!list.length && map.hasLayer(s11Cluster)) map.removeLayer(s11Cluster);
  if ($("s11Count")) $("s11Count").textContent = list.length ? list.length.toLocaleString("th-TH") : "";
  if ($("s11Toggle")) $("s11Toggle").classList.toggle("active", S11.on);
  if ($("mS11Btn")) $("mS11Btn").classList.toggle("active", S11.on);
}

const toggleS11 = () => {
  S11.on = !S11.on;
  localStorage.setItem(S11_ON_KEY, S11.on ? "1" : "0");
  s11Update();
  toast(S11.on ? "แสดง 7-Eleven" : "ซ่อน 7-Eleven");
};
if ($("s11Toggle")) $("s11Toggle").onclick = toggleS11;
if ($("mS11Btn")) $("mS11Btn").onclick = toggleS11;

// Use document-level delegation. Leaflet may rebuild popup DOM after opening,
// so binding directly to the button is unreliable.
document.addEventListener("click", e => {
  const btn = e.target.closest?.(".s11EditBtn");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();

  const key = btn.dataset.key || "";
  const item = S11.all.find(x => String(x.key ?? x.id) === String(key));
  if (!item) {
    toast("ไม่พบข้อมูลจุด 7-Eleven นี้");
    return;
  }
  if (item.isCustom) {
    openS11Modal(item.rec, null, true);
  } else {
    const base = (window.SEVEN11_DATA || []).find((r, i) => s11Key(r, i) === item.key);
    if (base) openS11Modal({ ...base, ...S11.edits.get(String(item.key)), _s11Key: item.key }, null, false, item.key);
  }
}, true);

/* ── S11 ADD/EDIT MODAL ── */
function s11PopulateColors() {
  const wrap = $("s11Colors");
  if (!wrap) return;
  const colors = [
    ["red", "#ef4444", "แดง"],
    ["blue", "#2563eb", "ฟ้า"],
    ["yellow", "#eab308", "เหลือง"],
    ["green", "#008450", "เขียว"]
  ];
  wrap.innerHTML = colors.map(([name, hex, label]) =>
    `<button type="button" class="swatch s11ColorSwatch" data-color="${name}" style="--s11-border:${hex}" title="${label}" aria-label="${label}">
       <img src="7-11-logo.png" alt="">
     </button>`
  ).join("");
  wrap.querySelectorAll(".swatch").forEach(b => {
    b.onclick = () => {
      wrap.querySelectorAll(".swatch").forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      $("s11Color").value = b.dataset.color;
    };
  });
}

function selectS11Color(color) {
  const value = S11_COLORS[color] ? color : (color === "default" || !color ? "green" : "green");
  $("s11Color").value = value;
  $("s11Colors")?.querySelectorAll(".swatch").forEach(b => b.classList.toggle("active", b.dataset.color === value));
}

function openS11Modal(rec = null, latlng = null, isCustomEdit = false, baseEditId = null) {
  s11PopulateColors();
  S.editingS11 = { rec, isCustomEdit, baseEditId, latlng };
  if ($("s11ModalTitle")) $("s11ModalTitle").textContent = rec ? "แก้ไขจุด 7-Eleven" : "เพิ่มจุด 7-Eleven";
  if ($("s11Title")) $("s11Title").value = rec?.n || "";
  if ($("s11Address")) $("s11Address").value = rec?.a || "";
  if ($("s11Note")) $("s11Note").value = rec?.note || "";
  selectS11Color(rec?.color || "green");
  if ($("s11Delete")) $("s11Delete").classList.toggle("hidden", !rec);
  const ll = latlng || (rec ? { lat: rec.y, lng: rec.x } : map.getCenter());
  if ($("s11Coord")) $("s11Coord").textContent = `พิกัด: ${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`;
  if ($("s11Modal")) $("s11Modal").classList.remove("hidden");
}
function closeS11Modal() { if ($("s11Modal")) $("s11Modal").classList.add("hidden"); }
if ($("s11Close")) $("s11Close").onclick = closeS11Modal;
if ($("s11Cancel")) $("s11Cancel").onclick = closeS11Modal;

if ($("s11Save")) {
  $("s11Save").onclick = () => {
    const n = ($("s11Title")?.value || "").trim();
    if (!n) return toast("กรุณาใส่ชื่อสาขา");
    const a = ($("s11Address")?.value || "").trim();
    const note = ($("s11Note")?.value || "").trim();
    const color = $("s11Color")?.value || "green";
    const ctx = S.editingS11 || {};
    if (ctx.rec && ctx.isCustomEdit) {
      const rec = S11.custom.find(r => r._localId === ctx.rec._localId);
      if (rec) { rec.n = n; rec.a = a; rec.note = note; rec.color = color; }
    } else if (ctx.rec && ctx.baseEditId != null) {
      S11.edits.set(String(ctx.baseEditId), { n, a, note, color });
    } else {
      const ll = ctx.latlng || map.getCenter();
      const localId = "c_" + Date.now();
      S11.custom.push({ _localId: localId, _s11Key: localId, n, a, note, color, y: ll.lat, x: ll.lng });
    }
    s11Persist();
    S11.all = [];
    s11Update();
    closeS11Modal();
    toast("บันทึกจุด 7-Eleven แล้ว");
  };
}
if ($("s11Delete")) {
  $("s11Delete").onclick = () => {
    const ctx = S.editingS11 || {};
    if (!ctx.rec) return;
    if (ctx.isCustomEdit) {
      S11.custom = S11.custom.filter(r => r._localId !== ctx.rec._localId);
    } else if (ctx.baseEditId != null) {
      S11.deletedIds.add(String(ctx.baseEditId));
      S11.edits.delete(String(ctx.baseEditId));
    }
    s11Persist();
    S11.all = [];
    s11Update();
    closeS11Modal();
    toast("ลบจุดแล้ว");
  };
}

let s11AddMode = false;
function triggerS11Add() {
  s11AddMode = !s11AddMode;
  if ($("mode")) $("mode").classList.toggle("hidden", !s11AddMode);
  if ($("modeText")) $("modeText").textContent = "🏪 คลิกตำแหน่งบนแผนที่เพื่อเพิ่มจุด 7-Eleven";
  toast(s11AddMode ? "แตะบนแผนที่เพื่อเพิ่มจุด 7-Eleven" : "ยกเลิก");
}
if ($("s11Add")) $("s11Add").onclick = triggerS11Add;

/* ── PINS MANAGEMENT & GOOGLE MAPS DIRECT NAV ── */
const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];
const ICONS = { pin: "📍", star: "⭐", heart: "❤️", flag: "🚩", home: "🏠", food: "🍜", shop: "🏪", hotel: "🏨", photo: "📷" };

function pinIcon(color, icon, iconImg) {
  const c = /^#[0-9a-fA-F]{6}$/.test(color) ? color : COLORS[0];
  if (icon === "photo" && iconImg) {
    return L.divIcon({ className: "", html: `<div style="width:36px;height:36px;border-radius:50%;border:4px solid ${c};background:#fff;box-shadow:0 2px 6px #0006;overflow:hidden;box-sizing:border-box"><img src="${iconImg}" style="width:100%;height:100%;display:block;object-fit:cover"></div>`, iconSize: [36, 36], iconAnchor: [18, 32] });
  }
  const html = `<div style="width:36px;height:36px;border-radius:50%;border:4px solid ${c};background:#fff;box-shadow:0 2px 6px #0006;display:flex;align-items:center;justify-content:center;box-sizing:border-box"><span style="font-size:21px;line-height:1">${ICONS[icon] || "📍"}</span></div>`;
  return L.divIcon({ className: "", html, iconSize: [36, 36], iconAnchor: [18, 32] });
}

function marker(p) {
  const m = L.marker([p.lat, p.lng], { icon: pinIcon(p.color, p.icon, p.icon_img) });
  const gmapUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  const canEdit = S.session && p.created_by_user_id === S.session.user.id;
  m.bindPopup(`<div class="pin-title">${esc(p.title)}</div>
    <div>${esc(p.address || "")}</div>
    <div class="pin-note">${esc(p.note || "")}</div>
    <div class="pin-meta">ปักโดย ${esc(p.created_by || "ผู้ใช้")}</div>
    <a href="${gmapUrl}" target="_blank" rel="noopener" class="pin-nav-link">🧭 นำทาง (Google Maps)</a>
    ${canEdit ? `<button type="button" class="pin-nav-link pinEditBtn" data-id="${p.id}" style="background:#111">✎ แก้ไข/ลบ</button>` : ""}`);
  S.markers.set(p.id, m);
  cluster.addLayer(m);
}

map.getContainer().addEventListener("click", e => {
  const btn = e.target.closest(".pinEditBtn");
  if (!btn) return;
  const p = S.all.find(x => String(x.id) === btn.dataset.id);
  if (p) openModal(p);
});

function rebuild() {
  cluster.clearLayers(); S.markers.clear();
  const q = (($("search") ? $("search").value : "") || ($("mSearchInput") ? $("mSearchInput").value : "")).toLowerCase().trim();
  const filtered = S.all.filter(p => !q || (p.title + " " + (p.address || "") + " " + (p.note || "")).toLowerCase().includes(q));
  filtered.forEach(marker);
  if ($("pinCount")) $("pinCount").textContent = S.all.length.toLocaleString("th-TH");
}

const handleSearch = () => { rebuild(); s11Update(); };
if ($("search")) $("search").oninput = handleSearch;
if ($("mSearchInput")) $("mSearchInput").oninput = handleSearch;

/* ── AUTH ── */
function setAuthMode(mode) {
  S.authMode = mode;
  if ($("authTitle")) $("authTitle").textContent = mode === "signup" ? "สร้างบัญชี" : "เข้าสู่ระบบ";
  if ($("authSubmit")) $("authSubmit").textContent = mode === "signup" ? "สร้างบัญชี" : "เข้าสู่ระบบ";
  if ($("authSwitch")) $("authSwitch").textContent = mode === "signup" ? "มีบัญชีแล้ว? เข้าสู่ระบบ" : "สร้างบัญชีใหม่";
  if ($("usernameWrap")) $("usernameWrap").classList.toggle("hidden", mode !== "signup");
}

function openAuth(msg = "") {
  if (!$("authModal")) return;
  setAuthMode("signin");
  $("authModal").classList.remove("hidden");
  if ($("authMessage")) $("authMessage").textContent = msg;
}
if ($("authClose")) $("authClose").onclick = () => $("authModal").classList.add("hidden");
if ($("authSwitch")) $("authSwitch").onclick = () => setAuthMode(S.authMode === "signup" ? "signin" : "signup");

/* ── PASSWORD RESET (EMAIL LINK) ── */
function resetMsg(text, ok = false) {
  const el = $("resetMessage");
  if (!el) return;
  el.style.color = ok ? "#008450" : "#ef4444";
  el.textContent = text || "";
}

function openResetModal(recovery = false) {
  if (!$("resetModal")) return;
  if (!recovery) {
    const email = ($("authEmail")?.value || "").trim();
    if ($("resetEmail") && email) $("resetEmail").value = email;
    if ($("resetHint")) $("resetHint").textContent = "กรอกอีเมล แล้วระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ให้คุณ";
    if ($("resetEmailWrap")) $("resetEmailWrap").classList.remove("hidden");
    if ($("sendResetLink")) $("sendResetLink").classList.remove("hidden");
  } else {
    if ($("resetHint")) $("resetHint").textContent = "ยืนยันตัวตนแล้ว กรุณาตั้งรหัสผ่านใหม่";
    if ($("resetEmailWrap")) $("resetEmailWrap").classList.add("hidden");
    if ($("sendResetLink")) $("sendResetLink").classList.add("hidden");
    if ($("newPasswordWrap")) $("newPasswordWrap").classList.remove("hidden");
    if ($("resetPassword")) $("resetPassword").value = "";
    if ($("resetPasswordConfirm")) $("resetPasswordConfirm").value = "";
  }
  resetMsg("");
  $("resetModal").classList.remove("hidden");
  setTimeout(() => (recovery ? $("resetPassword") : $("resetEmail"))?.focus(), 50);
}

async function requestResetLink() {
  if (!S.sb) return toast("ยังไม่ได้ตั้งค่า Supabase (ตรวจสอบ config.js)");
  const email = ($("resetEmail")?.value || $("authEmail")?.value || "").trim();
  if (!email) { resetMsg("กรุณากรอกอีเมล"); $("resetEmail")?.focus(); return; }
  if (!/^\S+@\S+\.\S+$/.test(email)) { resetMsg("รูปแบบอีเมลไม่ถูกต้อง"); $("resetEmail")?.focus(); return; }
  const btn = $("sendResetLink");
  if (btn) btn.disabled = true;
  try {
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await S.sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
    resetMsg("ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว กรุณาเปิดอีเมลและกดปุ่ม Reset password", true);
    if ($("resetHint")) $("resetHint").textContent = "ตรวจสอบอีเมลของคุณ แล้วกดลิงก์ Reset password เพื่อกลับมาตั้งรหัสผ่านใหม่";
  } catch (err) {
    resetMsg(err.message || "ส่งลิงก์รีเซ็ตรหัสผ่านไม่สำเร็จ");
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function saveNewPassword() {
  if (!S.sb) return toast("ยังไม่ได้ตั้งค่า Supabase (ตรวจสอบ config.js)");
  const password = $("resetPassword")?.value || "";
  const confirm = $("resetPasswordConfirm")?.value || "";
  if (password.length < 6) return resetMsg("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
  if (password !== confirm) return resetMsg("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
  const btn = $("saveNewPassword");
  if (btn) btn.disabled = true;
  try {
    const { error } = await S.sb.auth.updateUser({ password });
    if (error) throw error;
    resetMsg("เปลี่ยนรหัสผ่านสำเร็จแล้ว", true);
    setTimeout(() => {
      $("resetModal")?.classList.add("hidden");
      $("authModal")?.classList.add("hidden");
      onAuthReady();
      toast(`ยินดีต้อนรับ ${username()}`);
    }, 700);
  } catch (err) {
    resetMsg(err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
  } finally {
    if (btn) btn.disabled = false;
  }
}

if ($("forgotPassword")) $("forgotPassword").onclick = () => {
  $("authModal")?.classList.add("hidden");
  openResetModal(false);
};
if ($("resetClose")) $("resetClose").onclick = () => $("resetModal").classList.add("hidden");
if ($("sendResetLink")) $("sendResetLink").onclick = requestResetLink;
if ($("saveNewPassword")) $("saveNewPassword").onclick = saveNewPassword;

const openProfileOrAuth = () => {
  if (!S.session) return openAuth("เข้าสู่ระบบก่อนใช้งานโปรไฟล์");
  openProfile();
};
if ($("profileBtn")) $("profileBtn").onclick = openProfileOrAuth;
if ($("mProfileBtn")) $("mProfileBtn").onclick = () => { closeMobileMenu(); openProfileOrAuth(); };

if ($("authSubmit")) {
  $("authSubmit").onclick = async () => {
    if (!S.sb) return toast("ยังไม่ได้ตั้งค่า Supabase (ตรวจสอบ config.js)");
    const email = ($("authEmail")?.value || "").trim();
    const password = $("authPassword")?.value || "";
    if (!email || !password) {
      if ($("authMessage")) $("authMessage").textContent = "กรุณากรอกอีเมลและรหัสผ่าน";
      return;
    }
    $("authSubmit").disabled = true;
    try {
      if (S.authMode === "signup") {
        const uname = ($("authUsername")?.value || "").trim() || email.split("@")[0];
        const { data, error } = await S.sb.auth.signUp({ email, password, options: { data: { username: uname } } });
        if (error) throw error;
        if (!data.session) {
          if ($("authMessage")) $("authMessage").textContent = "สมัครสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ";
          return;
        }
        S.session = data.session;
      } else {
        const { data, error } = await S.sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        S.session = data.session;
      }
      $("authModal").classList.add("hidden");
      $("authEmail").value = ""; $("authPassword").value = "";
      onAuthReady();
      toast(`ยินดีต้อนรับ ${username()}`);
    } catch (err) {
      if ($("authMessage")) $("authMessage").textContent = err.message || "เกิดข้อผิดพลาด";
    } finally {
      $("authSubmit").disabled = false;
    }
  };
}

const doLogout = async () => {
  if (S.sb) await S.sb.auth.signOut();
  S.session = null; S.room = ""; S.savedRooms = []; S.all = [];
  if (S.ch) { S.sb.removeChannel(S.ch); S.ch = null; }
  cluster.clearLayers(); S.markers.clear();
  if ($("pinCount")) $("pinCount").textContent = "0";
  renderSavedRooms();
  refreshUserUI();
  toast("ออกจากระบบแล้ว");
};
if ($("logoutBtn")) $("logoutBtn").onclick = doLogout;
if ($("mLogoutBtn")) $("mLogoutBtn").onclick = () => { closeMobileMenu(); doLogout(); };

function openProfile() {
  if ($("profileEmail")) $("profileEmail").textContent = S.session?.user?.email || "";
  if ($("profileUsername")) $("profileUsername").value = username();
  if ($("profileModal")) $("profileModal").classList.remove("hidden");
}
if ($("profileClose")) $("profileClose").onclick = () => $("profileModal").classList.add("hidden");
if ($("profileSave")) {
  $("profileSave").onclick = async () => {
    const uname = ($("profileUsername")?.value || "").trim();
    if (!uname) return toast("กรุณาใส่ชื่อผู้ใช้");
    try {
      const { data, error } = await S.sb.auth.updateUser({ data: { username: uname } });
      if (error) throw error;
      S.session.user = data.user;
      refreshUserUI();
      $("profileModal").classList.add("hidden");
      toast("บันทึกชื่อผู้ใช้แล้ว");
    } catch (err) {
      toast(err.message || "บันทึกไม่สำเร็จ");
    }
  };
}

function refreshUserUI() {
  const label = S.session ? (S.room ? `${username()} (ห้อง: ${S.room})` : username()) : "ยังไม่ได้เข้าสู่ระบบ";
  if ($("userLabel")) $("userLabel").textContent = label;
  if ($("mUserInfo")) $("mUserInfo").textContent = `👤 ${S.session ? username() : "ผู้ใช้"} · ห้อง: ${S.room || "-"}`;
  if ($("room")) $("room").value = S.room || $("room").value;
  if ($("mRoom")) $("mRoom").value = S.room || $("mRoom").value;
}

/* ── PIN MODAL ── */
function populateColorSwatches() {
  const wrap = $("colorSwatches");
  if (!wrap) return;
  const customInput = $("colorCustom");
  wrap.querySelectorAll(".swatch").forEach(b => b.remove());
  COLORS.forEach(c => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "swatch"; b.style.background = c; b.dataset.color = c;
    b.onclick = () => selectColor(c);
    wrap.insertBefore(b, customInput);
  });
  if (customInput) customInput.oninput = () => selectColor(customInput.value);
}
function selectColor(c) {
  $("color").value = c;
  $("colorSwatches").querySelectorAll(".swatch").forEach(b => b.classList.toggle("active", b.dataset.color === c));
}
populateColorSwatches();

document.querySelectorAll(".iconBtn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".iconBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    $("icon").value = btn.dataset.icon;
    $("imgUploadWrap").classList.toggle("hidden", btn.dataset.icon !== "photo");
  };
});

if ($("imgUpload")) {
  $("imgUpload").onchange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    const reader = new FileReader();
    reader.onload = ev => {
      img.onload = () => {
        const size = 64;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        const scale = Math.max(size / img.width, size / img.height);
        const w = img.width * scale, h = img.height * scale;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        $("iconImg").value = canvas.toDataURL("image/jpeg", 0.85);
        toast("อัปโหลดรูปแล้ว");
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  };
}

function openModal(p = null, latlng = null) {
  S.editing = p; S.pending = latlng || { lat: p.lat, lng: p.lng };
  if ($("modalTitle")) $("modalTitle").textContent = p ? "แก้ไขจุด" : "เพิ่มจุด";
  if ($("title")) $("title").value = p?.title || "";
  if ($("address")) $("address").value = p?.address || "";
  if ($("note")) $("note").value = p?.note || "";
  selectColor(p?.color || COLORS[0]);
  const icon = p?.icon || "pin";
  document.querySelectorAll(".iconBtn").forEach(b => b.classList.toggle("active", b.dataset.icon === icon));
  $("icon").value = icon;
  $("iconImg").value = p?.icon_img || "";
  $("imgUploadWrap").classList.toggle("hidden", icon !== "photo");
  if ($("delete")) $("delete").classList.toggle("hidden", !p);
  const ll = S.pending;
  if ($("coord")) $("coord").textContent = `พิกัด: ${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`;
  if ($("modal")) $("modal").classList.remove("hidden");
}
function closeModal() { if ($("modal")) $("modal").classList.add("hidden"); }
if ($("close")) $("close").onclick = closeModal;
if ($("cancel")) $("cancel").onclick = closeModal;

if ($("save")) {
  $("save").onclick = async () => {
    if (!S.session) return openAuth("เข้าสู่ระบบก่อนปักจุด");
    if (!S.room) return toast("กรุณาเข้าห้องก่อน");
    const title = ($("title")?.value || "").trim();
    if (!title) return toast("กรุณาใส่ชื่อจุด");
    const payload = {
      room: S.room,
      title,
      address: ($("address")?.value || "").trim(),
      note: ($("note")?.value || "").trim(),
      color: $("color").value,
      icon: $("icon").value,
      icon_img: $("iconImg").value || "",
      lat: S.pending.lat,
      lng: S.pending.lng,
      created_by: username(),
      created_by_user_id: S.session.user.id
    };
    $("save").disabled = true;
    try {
      if (S.editing) {
        const { error } = await S.sb.from("pins").update(payload).eq("id", S.editing.id);
        if (error) throw error;
      } else {
        const { error } = await S.sb.from("pins").insert(payload);
        if (error) throw error;
      }
      closeModal();
      toast("บันทึกจุดแล้ว");
      await loadPins();
    } catch (err) {
      toast(err.message || "บันทึกไม่สำเร็จ");
    } finally {
      $("save").disabled = false;
    }
  };
}

if ($("delete")) {
  $("delete").onclick = async () => {
    if (!S.editing) return;
    if (!confirm("ลบจุดนี้ใช่หรือไม่?")) return;
    try {
      const { error } = await S.sb.from("pins").delete().eq("id", S.editing.id);
      if (error) throw error;
      closeModal();
      toast("ลบจุดแล้ว");
      await loadPins();
    } catch (err) {
      toast(err.message || "ลบไม่สำเร็จ");
    }
  };
}

// Add Pin Action
const triggerAddPin = () => {
  if (!S.session) return openAuth("เข้าสู่ระบบก่อนปักจุด");
  if (!S.room) return toast("กรุณาพิมพ์ชื่อห้องและกดเข้าห้องก่อน");
  S.adding = !S.adding;
  if ($("mode")) $("mode").classList.toggle("hidden", !S.adding);
  if ($("modeText")) $("modeText").textContent = "📍 คลิกตำแหน่งบนแผนที่เพื่อปักจุด";
  toast(S.adding ? "แตะบนแผนที่เพื่อปักจุด" : "ยกเลิกปักจุด");
};

if ($("add")) $("add").onclick = triggerAddPin;
if ($("mAddBtn")) $("mAddBtn").onclick = triggerAddPin;

if ($("cancelMode")) {
  $("cancelMode").onclick = () => {
    S.adding = false; s11AddMode = false;
    if ($("mode")) $("mode").classList.add("hidden");
  };
}

map.on("click", e => {
  if (S.adding) {
    S.adding = false;
    if ($("mode")) $("mode").classList.add("hidden");
    openModal(null, e.latlng);
  } else if (s11AddMode) {
    s11AddMode = false;
    if ($("mode")) $("mode").classList.add("hidden");
    openS11Modal(null, e.latlng);
  }
});

// Locate GPS
const doLocate = () => map.locate({ setView: true, maxZoom: 17, enableHighAccuracy: true });
if ($("locate")) $("locate").onclick = doLocate;
if ($("locateBtn")) $("locateBtn").onclick = doLocate;
if ($("mLocateBtn")) $("mLocateBtn").onclick = doLocate;

map.on("locationfound", e => {
  if (S._locMarker) map.removeLayer(S._locMarker);
  S._locMarker = L.circleMarker(e.latlng, { radius: 8, color: "#3b82f6", fillColor: "#3b82f6", fillOpacity: 0.9 }).addTo(map).bindPopup("ตำแหน่งของคุณ").openPopup();
});

// Sidebar Toggle
if ($("sidebarToggle")) {
  $("sidebarToggle").onclick = () => {
    $("sidebar").classList.toggle("collapsed");
    $("sidebarToggle").textContent = $("sidebar").classList.contains("collapsed") ? "▶" : "◀";
  };
}

// Mobile menu drawer
const closeMobileMenu = () => $("mobileMenu")?.classList.add("hidden");

if ($("mMenuBtn")) {
  $("mMenuBtn").addEventListener("click", () => {
    $("mobileMenu")?.classList.toggle("hidden");
  });
}
if ($("mobileMenuClose")) {
  $("mobileMenuClose").addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();
    closeMobileMenu();
  });
}
if ($("mobileMenu")) {
  $("mobileMenu").addEventListener("click", e => {
    if (e.target === $("mobileMenu")) closeMobileMenu();
  });
}

/* ── TABLE PANEL ── */
function renderTable() {
  const body = $("tableBody");
  if (!body) return;
  if (!S.all.length) {
    body.innerHTML = `<div class="tableEmpty">ยังไม่มีจุดในห้องนี้</div>`;
    return;
  }
  body.innerHTML = `<table class="pinTable"><thead><tr><th>ชื่อจุด</th><th>ที่อยู่</th><th>ปักโดย</th></tr></thead><tbody>
    ${S.all.map(p => `<tr data-id="${p.id}"><td>${esc(p.title)}</td><td>${esc(p.address || "")}</td><td>${esc(p.created_by || "")}</td></tr>`).join("")}
  </tbody></table>`;
  body.querySelectorAll("tr[data-id]").forEach(row => {
    row.onclick = () => {
      const p = S.all.find(x => String(x.id) === row.dataset.id);
      if (!p) return;
      map.setView([p.lat, p.lng], 17);
      const m = S.markers.get(p.id);
      if (m) m.openPopup();
      $("tablePanel").classList.add("hidden");
    };
  });
}
const doTableToggle = () => {
  if (!S.room) return toast("กรุณาเข้าห้องก่อน");
  renderTable();
  $("tablePanel").classList.toggle("hidden");
};
if ($("tableToggle")) $("tableToggle").onclick = doTableToggle;
if ($("mTableToggle")) $("mTableToggle").onclick = () => { closeMobileMenu(); doTableToggle(); };
if ($("mQuickTable")) $("mQuickTable").onclick = doTableToggle;
if ($("tableClose")) $("tableClose").onclick = () => $("tablePanel").classList.add("hidden");

/* ── EXPORT EXCEL ── */
const doExportXlsx = () => {
  if (!S.all.length) return toast("ไม่มีจุดให้ export");
  if (typeof XLSX === "undefined") return toast("โหลดไลบรารี Excel ไม่สำเร็จ");
  const rows = S.all.map(p => ({
    ชื่อจุด: p.title, ที่อยู่: p.address || "", รายละเอียด: p.note || "",
    ละติจูด: p.lat, ลองจิจูด: p.lng, ปักโดย: p.created_by || "",
    วันที่: p.created_at ? new Date(p.created_at).toLocaleString("th-TH") : ""
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pins");
  XLSX.writeFile(wb, `pinmap-${S.room || "export"}.xlsx`);
  toast("ดาวน์โหลด Excel แล้ว");
};
if ($("exportXlsx")) $("exportXlsx").onclick = doExportXlsx;
if ($("mExportXlsx")) $("mExportXlsx").onclick = () => { closeMobileMenu(); doExportXlsx(); };

/* ── SHARE ── */
const doShare = async () => {
  if (!S.room) return toast("กรุณาเข้าห้องก่อน");
  const url = `${location.origin}${location.pathname}?room=${encodeURIComponent(S.room)}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "PinMap", text: `เข้าร่วมห้อง ${S.room}`, url });
    } else {
      await navigator.clipboard.writeText(url);
      toast("คัดลอกลิงก์ห้องแล้ว");
    }
  } catch { /* user cancelled share */ }
};
if ($("share")) $("share").onclick = doShare;
if ($("mShare")) $("mShare").onclick = () => { closeMobileMenu(); doShare(); };

/* ── SAVED ROOMS ── */
async function loadSavedRooms() {
  if (!S.sb || !S.session) { S.savedRooms = []; renderSavedRooms(); return; }
  const { data, error } = await S.sb.from("saved_rooms").select("*").order("created_at", { ascending: false });
  if (!error) S.savedRooms = data || [];
  renderSavedRooms();
}
function renderSavedRooms() {
  ["savedRooms", "mSavedRooms"].forEach(id => {
    const wrap = $(id);
    if (!wrap) return;
    if (!S.savedRooms.length) { wrap.innerHTML = `<div class="muted" style="font-size:12px">ยังไม่มีห้องที่บันทึกไว้</div>`; return; }
    wrap.innerHTML = S.savedRooms.map(r => `<button type="button" class="item savedRoomBtn" data-room="${esc(r.room)}">☆ ${esc(r.label || r.room)}</button>`).join("");
    wrap.querySelectorAll(".savedRoomBtn").forEach(b => {
      b.onclick = () => { closeMobileMenu(); enterSavedRoom(b.dataset.room); };
    });
  });
}
async function enterSavedRoom(room) {
  if (!S.session) return openAuth("เข้าสู่ระบบก่อน");
  try {
    const { data, error } = await S.sb.rpc("room_enter_saved", { p_room: room });
    if (error) throw error;
    if (!data) return toast("ไม่พบสิทธิ์เข้าห้องนี้");
    await enterRoom(room);
  } catch (err) {
    toast(err.message || "เข้าห้องไม่สำเร็จ");
  }
}
const doSaveRoom = async () => {
  if (!S.session) return openAuth("เข้าสู่ระบบก่อน");
  if (!S.room) return toast("กรุณาเข้าห้องก่อน");
  try {
    const { error } = await S.sb.from("saved_rooms").upsert({ user_id: S.session.user.id, room: S.room, label: S.room }, { onConflict: "user_id,room" });
    if (error) throw error;
    toast("บันทึกห้องแล้ว");
    await loadSavedRooms();
  } catch (err) {
    toast(err.message || "บันทึกไม่สำเร็จ");
  }
};
if ($("saveRoom")) $("saveRoom").onclick = doSaveRoom;
if ($("mSaveRoom")) $("mSaveRoom").onclick = () => { closeMobileMenu(); doSaveRoom(); };

/* ── ROOM JOIN + PINS LOAD + REALTIME ── */
async function loadPins() {
  if (!S.sb || !S.room) return;
  const { data, error } = await S.sb.from("pins").select("*").eq("room", S.room).order("created_at", { ascending: true });
  if (error) { toast(error.message); return; }
  S.all = data || [];
  rebuild();
}

function updateOnlineCount() {
  const el = $("onlineCount");
  if (!el || !S.ch) return;

  const state = S.ch.presenceState();
  const users = new Set();

  Object.values(state || {}).forEach(metas => {
    (Array.isArray(metas) ? metas : []).forEach(meta => {
      const id = meta?.user_id || meta?.userId || meta?.presence_ref;
      if (id) users.add(String(id));
    });
  });

  el.textContent = String(users.size);
  const mobileEl = $("mOnlineCount");
  if (mobileEl) mobileEl.textContent = String(users.size);
}

function subscribeRealtime() {
  if (S.ch) { S.sb.removeChannel(S.ch); S.ch = null; }

  const presenceKey = S.session?.user?.id || `guest-${Math.random().toString(36).slice(2)}`;

  S.ch = S.sb.channel(`pins-${S.room}`, {
    config: {
      presence: { key: presenceKey }
    }
  })
    .on("postgres_changes", { event: "*", schema: "public", table: "pins", filter: `room=eq.${S.room}` }, () => { loadPins(); })
    .on("presence", { event: "sync" }, () => {
      updateOnlineCount();
    })
    .on("presence", { event: "join" }, () => {
      updateOnlineCount();
    })
    .on("presence", { event: "leave" }, () => {
      updateOnlineCount();
    })
    .subscribe(async status => {
      const onlineDot = $("onlineDot");
      if (onlineDot) onlineDot.style.background = status === "SUBSCRIBED" ? "#22c55e" : "#999";

      if (status === "SUBSCRIBED") {
        const { error } = await S.ch.track({
          user_id: S.session?.user?.id || presenceKey,
          room: S.room,
          online_at: new Date().toISOString()
        });
        if (error) console.warn("Presence track error:", error);
        updateOnlineCount();
      } else {
        const el = $("onlineCount");
        if (el) el.textContent = "0";
        const mobileEl = $("mOnlineCount");
        if (mobileEl) mobileEl.textContent = "0";
      }
    });
}

async function enterRoom(room) {
  S.room = room;
  refreshUserUI();
  toast(`เข้าสู่ห้อง: ${room}`);
  await loadPins();
  subscribeRealtime();
  closeMobileMenu();
}

async function doJoin(roomInputId, passInputId, btnId) {
  if (!S.session) return openAuth("เข้าสู่ระบบก่อนเข้าห้อง");
  const rm = ($(roomInputId)?.value || "").trim();
  const pass = $(passInputId)?.value || "";
  if (!rm) return toast("กรุณาใส่ชื่อห้อง");
  if ($(btnId)) $(btnId).disabled = true;
  try {
    if (pass) {
      const { data, error } = await S.sb.rpc("room_join", { p_room: rm, p_passcode: pass });
      if (error) throw error;
      if (!data) { toast("รหัสห้องไม่ถูกต้อง"); return; }
    } else {
      const { data, error } = await S.sb.rpc("room_enter_saved", { p_room: rm });
      if (error) throw error;
      if (!data) { toast("ต้องใส่รหัสห้องสำหรับการเข้าห้องครั้งแรก"); return; }
    }
    await enterRoom(rm);
    if ($(passInputId)) $(passInputId).value = "";
  } catch (err) {
    toast(err.message || "เข้าห้องไม่สำเร็จ");
  } finally {
    if ($(btnId)) $(btnId).disabled = false;
  }
}
if ($("join")) $("join").onclick = () => doJoin("room", "passcode", "join");
if ($("mJoin")) $("mJoin").onclick = () => doJoin("mRoom", "mPasscode", "mJoin");

/* ── INIT ── */
function onAuthReady() {
  refreshUserUI();
  loadSavedRooms();
}

async function init() {
  if (dbConfigured() && window.supabase) {
    try {
      S.sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
      const { data } = await S.sb.auth.getSession();
      S.session = data.session;
      S.sb.auth.onAuthStateChange((event, session) => {
        S.session = session;
        onAuthReady();
        if (event === "PASSWORD_RECOVERY") {
          setTimeout(() => openResetModal(true), 0);
        }
      });
    } catch (e) {
      console.warn("Supabase Config Issue:", e);
      toast("เชื่อมต่อ Supabase ไม่สำเร็จ ตรวจสอบ config.js");
    }
  } else {
    toast("ยังไม่ได้ตั้งค่า Supabase ใน config.js");
  }
  refreshUserUI();
  const recoveryHash = /(?:^|&)type=recovery(?:&|$)/.test(window.location.hash.replace(/^#/, ""));
  if (recoveryHash && S.session) {
    onAuthReady();
    setTimeout(() => openResetModal(true), 0);
  } else if (!S.session) openAuth("กรุณาเข้าสู่ระบบเพื่อเริ่มใช้งาน");
  else onAuthReady();

  const params = new URLSearchParams(location.search);
  const roomParam = params.get("room");
  if (roomParam) {
    if ($("room")) $("room").value = roomParam;
    if ($("mRoom")) $("mRoom").value = roomParam;
  }
}
init();
