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

// Base map selection: Google Hybrid is the default; Google Satellite is an optional switch.
const googleHybridLayer = L.tileLayer(
  "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  { maxZoom: 19, attribution: "Google Hybrid" }
).addTo(map);

const googleSatelliteLayer = L.tileLayer(
  "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
  { maxZoom: 19, attribution: "Google Satellite" }
);

let activeBaseMap = "googleHybrid";

function setBaseMap(name) {
  if (name === "googleSatellite") {
    if (map.hasLayer(googleHybridLayer)) map.removeLayer(googleHybridLayer);
    if (!map.hasLayer(googleSatelliteLayer)) googleSatelliteLayer.addTo(map);
    activeBaseMap = "googleSatellite";
  } else {
    if (map.hasLayer(googleSatelliteLayer)) map.removeLayer(googleSatelliteLayer);
    if (!map.hasLayer(googleHybridLayer)) googleHybridLayer.addTo(map);
    activeBaseMap = "googleHybrid";
  }
  updateBaseMapPreview();
}

// Google Maps-style basemap switcher: tap the square preview to switch maps.
const baseMapControl = L.control({ position: "bottomright" });
baseMapControl.onAdd = () => {
  const wrap = L.DomUtil.create("div", "pinmap-basemap-control");
  wrap.innerHTML = `
    <button type="button" id="baseMapPreview" class="baseMapPreview" aria-label="เปลี่ยนแผนที่พื้นฐาน" title="แตะเพื่อเปลี่ยนแผนที่">
      <span class="baseMapThumb" aria-hidden="true"></span>
    </button>
  `;
  L.DomEvent.disableClickPropagation(wrap);
  L.DomEvent.disableScrollPropagation(wrap);
  wrap.querySelector("#baseMapPreview").addEventListener("click", () => {
    setBaseMap(activeBaseMap === "googleHybrid" ? "googleSatellite" : "googleHybrid");
  });
  return wrap;
};
baseMapControl.addTo(map);

function updateBaseMapPreview() {
  const thumb = $("baseMapPreview")?.querySelector(".baseMapThumb");
  if (!thumb) return;
  thumb.classList.toggle("esri", false);
  thumb.title = activeBaseMap === "googleHybrid" ? "Google Hybrid" : "Google Satellite";
}
updateBaseMapPreview();

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

/* ── ADMINISTRATIVE BOUNDARIES ── */
let tambonBoundaryLayer = null;
let provinceBoundaryLayer = null;
let tambonBoundaryLabelLayer = null;
let provinceBoundaryLabelLayer = null;
let tambonBoundaryLoading = false;
let provinceBoundaryLoading = false;
let tambonBoundaryOn = false;
let provinceBoundaryOn = false;

const boundaryStyle = {
  color: "#a855f7",
  weight: 1.1,
  opacity: 0.95,
  fill: false,
  fillOpacity: 0
};
const provinceBoundaryStyle = {
  color: "#dc2626",
  weight: 2.2,
  opacity: 0.95,
  fill: false,
  fillOpacity: 0
};

function boundaryFeatureCenter(feature) {
  const coords = feature?.geometry?.coordinates;
  if (!coords) return null;
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
  const walk = arr => {
    if (!Array.isArray(arr)) return;
    if (typeof arr[0] === "number" && typeof arr[1] === "number") {
      const lng = arr[0], lat = arr[1];
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
      }
      return;
    }
    for (const item of arr) walk(item);
  };
  walk(coords);
  if (!Number.isFinite(minLat)) return null;
  return L.latLng((minLat + maxLat) / 2, (minLng + maxLng) / 2);
}

function refreshBoundaryLabels(type) {
  const isTambon = type === "tambon";
  const boundaryLayer = isTambon ? tambonBoundaryLayer : provinceBoundaryLayer;
  const data = isTambon
    ? (window.PINMAP_TAMBON_BOUNDARIES || null)
    : (window.PINMAP_PROVINCE_BOUNDARIES || null);
  const labels = isTambon
    ? (window.PINMAP_TAMBON_LABELS || [])
    : (window.PINMAP_PROVINCE_LABELS || []);
  const zoomMin = isTambon ? 11 : 7;
  const oldLabels = isTambon ? tambonBoundaryLabelLayer : provinceBoundaryLabelLayer;

  if (oldLabels) map.removeLayer(oldLabels);
  if (!boundaryLayer || !data || !Array.isArray(data.features) || map.getZoom() < zoomMin) return;

  const group = L.layerGroup();
  const mapBounds = map.getBounds().pad(0.08);
  const maxLabels = isTambon ? 1200 : 100;
  let count = 0;

  for (let i = 0; i < data.features.length && count < maxLabels; i++) {
    const feature = data.features[i];
    const center = boundaryFeatureCenter(feature);
    if (!center || !mapBounds.contains(center)) continue;
    const name = labels?.[i] || feature?.properties?.T_NAME_T || feature?.properties?.PROV_NAMT || feature?.properties?.name;
    if (!name) continue;
    L.marker(center, {
      icon: L.divIcon({
        className: "pinmap-boundary-label-wrap",
        html: `<span class="pinmap-boundary-label">${String(name).replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]))}</span>`,
        iconSize: null,
        iconAnchor: [0, 0]
      }),
      interactive: false,
      keyboard: false,
      zIndexOffset: 1000
    }).addTo(group);
    count++;
  }

  group.addTo(map);
  if (isTambon) tambonBoundaryLabelLayer = group;
  else provinceBoundaryLabelLayer = group;
}

async function loadBoundaryLayer(type) {
  const isTambon = type === "tambon";
  const state = isTambon ? {
    loading: () => tambonBoundaryLoading,
    setLoading: v => { tambonBoundaryLoading = v; },
    get: () => tambonBoundaryLayer,
    set: v => { tambonBoundaryLayer = v; },
    data: () => (window.PINMAP_TAMBON_BOUNDARIES || null),
    style: boundaryStyle,
    label: "ขอบเขตตำบล"
  } : {
    loading: () => provinceBoundaryLoading,
    setLoading: v => { provinceBoundaryLoading = v; },
    get: () => provinceBoundaryLayer,
    set: v => { provinceBoundaryLayer = v; },
    data: () => (window.PINMAP_PROVINCE_BOUNDARIES || null),
    style: provinceBoundaryStyle,
    label: "ขอบเขตจังหวัด"
  };

  if (state.get()) return state.get();
  if (state.loading()) return null;

  state.setLoading(true);
  try {
    const data = state.data();
    if (!data) throw new Error("boundary data unavailable");
    const layer = L.geoJSON(data, {
      style: state.style,
      interactive: false
    });
    state.set(layer);
    return layer;
  } catch (err) {
    console.error(`โหลด${state.label}ไม่สำเร็จ`, err);
    toast(`ไม่สามารถโหลด${state.label}ได้`);
    return null;
  } finally {
    state.setLoading(false);
  }
}

async function toggleBoundary(type) {
  const isTambon = type === "tambon";
  const wasOn = isTambon ? tambonBoundaryOn : provinceBoundaryOn;
  if (isTambon) tambonBoundaryOn = !wasOn;
  else provinceBoundaryOn = !wasOn;

  const on = isTambon ? tambonBoundaryOn : provinceBoundaryOn;
  const layer = on ? await loadBoundaryLayer(type) : (isTambon ? tambonBoundaryLayer : provinceBoundaryLayer);

  if (on && layer) {
    layer.addTo(map);
    refreshBoundaryLabels(type);
  }
  if (!on && layer && map.hasLayer(layer)) {
    map.removeLayer(layer);
    const labels = isTambon ? tambonBoundaryLabelLayer : provinceBoundaryLabelLayer;
    if (labels) map.removeLayer(labels);
  }

  if (isTambon && !layer && on) tambonBoundaryOn = false;
  if (!isTambon && !layer && on) provinceBoundaryOn = false;

  if ($("tambonToggle")) $("tambonToggle").classList.toggle("active", tambonBoundaryOn);
  if ($("provinceToggle")) $("provinceToggle").classList.toggle("active", provinceBoundaryOn);
  if ($("mTambonToggle")) $("mTambonToggle").classList.toggle("active", tambonBoundaryOn);
  if ($("mProvinceToggle")) $("mProvinceToggle").classList.toggle("active", provinceBoundaryOn);
}

map.on("zoomend moveend", () => {
  if (tambonBoundaryOn) refreshBoundaryLabels("tambon");
  if (provinceBoundaryOn) refreshBoundaryLabels("province");
});

function toggleBoundaryPanel() {
  $("boundaryPanel")?.classList.toggle("hidden");
  $("mBoundaryPanel")?.classList.toggle("hidden");
}
if ($("boundaryToggle")) $("boundaryToggle").onclick = toggleBoundaryPanel;
if ($("mBoundaryToggle")) $("mBoundaryToggle").onclick = toggleBoundaryPanel;
if ($("tambonToggle")) $("tambonToggle").onclick = () => toggleBoundary("tambon");
if ($("provinceToggle")) $("provinceToggle").onclick = () => toggleBoundary("province");
if ($("mTambonToggle")) $("mTambonToggle").onclick = () => toggleBoundary("tambon");
if ($("mProvinceToggle")) $("mProvinceToggle").onclick = () => toggleBoundary("province");

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
  yellow: "#eab308",
  "light-purple": "#a78bfa"
};

function s11SafeColor(color) {
  if (color === "default" || !color) return S11_COLORS.green;
  if (S11_COLORS[color]) return S11_COLORS[color];
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : S11_COLORS.green;
}

function s11MakeIcon(color = "green") {
  const border = s11SafeColor(color);
  const logoName = S11_COLORS[color] ? color : "green";
  const html = `<span class="s11-logo-marker" style="--s11-border:${border}">
    <img src="logo-7eleven-${logoName}.png" alt="7-Eleven" draggable="false">
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
  if ($("mS11Count")) $("mS11Count").textContent = list.length ? list.length.toLocaleString("th-TH") : "";
  if ($("s11Toggle")) $("s11Toggle").classList.toggle("active", S11.on);
  if ($("mS11Toggle")) $("mS11Toggle").classList.toggle("active", S11.on);
}

const toggleS11 = () => {
  S11.on = !S11.on;
  localStorage.setItem(S11_ON_KEY, S11.on ? "1" : "0");
  s11Update();
  toast(S11.on ? "แสดง 7-Eleven" : "ซ่อน 7-Eleven");
};
if ($("s11Toggle")) $("s11Toggle").onclick = toggleS11;
if ($("mS11Toggle")) $("mS11Toggle").onclick = toggleS11;

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
    ["green", "#008450", "เขียว"],
    ["light-purple", "#a78bfa", "ม่วงอ่อน"]
  ];
  wrap.innerHTML = colors.map(([name, hex, label]) =>
    `<button type="button" class="swatch s11ColorSwatch" data-color="${name}" style="--s11-border:${hex}" title="${label}" aria-label="${label}">
       <img src="logo-7eleven-${name}.png" alt="">
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
if ($("s11Add")) $("s11Add").onclick = () => { triggerS11Add(); closeCompetitorPanels(); };
if ($("mS11Add")) $("mS11Add").onclick = () => { triggerS11Add(); closeCompetitorPanels(); };


/* ── CJ MORE LAYER ── */
const cjCluster = L.markerClusterGroup({
  chunkedLoading: true, maxClusterRadius: 60, disableClusteringAtZoom: 17,
  iconCreateFunction: c => L.divIcon({ html: `<div>${c.getChildCount()}</div>`, className: "marker-cluster marker-cluster-cjmore", iconSize: [38, 38] })
});
const CJ_ON_KEY = "pinmap-cjmore-on";
const CJ_CUSTOM_KEY = "pinmap-cjmore-custom";
const CJ_EDITS_KEY = "pinmap-cjmore-edits";
const CJ = {
  all: [],
  custom: loadJSON(CJ_CUSTOM_KEY, []),
  edits: new Map(Object.entries(loadJSON(CJ_EDITS_KEY, {}))),
  on: localStorage.getItem(CJ_ON_KEY) === "1"
};
function cjKey(rec, index = 0) {
  const raw = rec?._localId ?? rec?.code;
  if (raw !== undefined && raw !== null && String(raw).trim() !== "") return String(raw);
  const lat = Number(rec?.lat), lng = Number(rec?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return `coord:${lat.toFixed(7)},${lng.toFixed(7)}`;
  return `idx:${index}`;
}
function cjPersist() {
  localStorage.setItem(CJ_CUSTOM_KEY, JSON.stringify(CJ.custom));
  localStorage.setItem(CJ_EDITS_KEY, JSON.stringify(Object.fromEntries(CJ.edits)));
}
function cjMakeIcon() {
  return L.divIcon({
    className: "cjmore-logo-icon",
    html: `<span class="cjmore-logo-marker"><img src="logo-cj-more.jpg" alt="CJ MORE" draggable="false"></span>`,
    iconSize: [50, 50], iconAnchor: [25, 25], popupAnchor: [0, -22]
  });
}
function cjDisplayName(rec) {
  const n = String(rec?.name || rec?.n || "CJ MORE").trim();
  const code = String(rec?.code || "").trim();
  return code ? `${n} (${code})` : n;
}
function cjPopupHtml(rec, opts = {}) {
  const gmapUrl = `https://www.google.com/maps/dir/?api=1&destination=${rec.lat},${rec.lng}`;
  const editBtn = opts.editable ? `<button type="button" class="pin-nav-link cjEditBtn" data-key="${esc(rec._cjKey ?? rec._localId ?? rec.code ?? "")}" style="background:#111">✎ แก้ไข</button>` : "";
  const tel = rec.tel ? `<div>โทร: ${esc(rec.tel)}</div>` : "";
  return `<div class="pin-title">🏪 ${esc(cjDisplayName(rec))}</div>
    ${rec.address ? `<div>${esc(rec.address)}</div>` : ""}
    ${tel}
    ${rec.description ? `<div class="pin-note">${esc(rec.description)}</div>` : ""}
    <div class="pin-meta"><a href="${gmapUrl}" target="_blank" rel="noopener" class="pin-nav-link">🧭 นำทาง (Google Maps)</a> ${editBtn}</div>`;
}
function cjBuildAll() {
  const base = (window.CJMORE_DATA || []).map((rec, index) => {
    const key = cjKey(rec, index);
    const edit = CJ.edits.get(String(key)) || {};
    const merged = { ...rec, ...edit, _cjKey: key };
    const m = L.marker([merged.lat, merged.lng], { icon: cjMakeIcon() });
    m.bindPopup(cjPopupHtml(merged, { editable: true }), { closeButton: true, autoClose: true, closeOnClick: false });
    m.on("popupopen", ev => {
      const btn = ev.popup.getElement()?.querySelector(".cjEditBtn");
      if (btn) btn.onclick = e => { e.preventDefault(); e.stopPropagation(); openCJModal(merged, null, false, key); };
    });
    return { rec: merged, m, key, isCustom: false };
  });
  const custom = CJ.custom.map(rec => {
    const key = rec._localId;
    rec._cjKey = key;
    const m = L.marker([rec.lat, rec.lng], { icon: cjMakeIcon() });
    m.bindPopup(cjPopupHtml(rec, { editable: true }), { closeButton: true, autoClose: true, closeOnClick: false });
    m.on("popupopen", ev => {
      const btn = ev.popup.getElement()?.querySelector(".cjEditBtn");
      if (btn) btn.onclick = e => { e.preventDefault(); e.stopPropagation(); openCJModal(rec, null, true); };
    });
    return { rec, m, key, isCustom: true };
  });
  CJ.all = base.concat(custom);
}
function cjUpdate() {
  if (!CJ.all.length) cjBuildAll();
  const q = (($("search") ? $("search").value : "") || ($("mSearchInput") ? $("mSearchInput").value : "")).toLowerCase().trim();
  const list = q ? CJ.all.filter(x => (cjDisplayName(x.rec) + " " + (x.rec.address || "") + " " + (x.rec.description || "")).toLowerCase().includes(q)) : (CJ.on ? CJ.all : []);
  cjCluster.clearLayers();
  if (list.length) cjCluster.addLayers(list.map(x => x.m));
  if (list.length && !map.hasLayer(cjCluster)) cjCluster.addTo(map);
  if (!list.length && map.hasLayer(cjCluster)) map.removeLayer(cjCluster);
  if ($("cjCount")) $("cjCount").textContent = list.length ? list.length.toLocaleString("th-TH") : "";
  if ($("mCJCount")) $("mCJCount").textContent = list.length ? list.length.toLocaleString("th-TH") : "";
  if ($("cjToggle")) $("cjToggle").classList.toggle("active", CJ.on);
  if ($("mCJToggle")) $("mCJToggle").classList.toggle("active", CJ.on);
}
function toggleCJ() {
  CJ.on = !CJ.on;
  localStorage.setItem(CJ_ON_KEY, CJ.on ? "1" : "0");
  cjUpdate();
  toast(CJ.on ? "แสดง CJ MORE" : "ซ่อน CJ MORE");
}
function toggleCompetitorPanel() {
  const desktop = $("competitorPanel");
  const mobile = $("mCompetitorPanel");
  desktop?.classList.toggle("hidden");
  mobile?.classList.toggle("hidden");
}
function closeCompetitorPanels() {
  $("competitorPanel")?.classList.add("hidden");
  $("mCompetitorPanel")?.classList.add("hidden");
}
if ($("competitorToggle")) $("competitorToggle").onclick = toggleCompetitorPanel;
if ($("mCompetitorBtn")) $("mCompetitorBtn").onclick = toggleCompetitorPanel;
if ($("cjToggle")) $("cjToggle").onclick = toggleCJ;
if ($("mCJToggle")) $("mCJToggle").onclick = toggleCJ;

function openCJModal(rec = null, latlng = null, isCustomEdit = false, baseEditId = null) {
  S.editingCJ = { rec, latlng, isCustomEdit, baseEditId };
  if ($("cjModalTitle")) $("cjModalTitle").textContent = rec ? "แก้ไขจุด CJ MORE" : "เพิ่มจุด CJ MORE";
  if ($("cjName")) $("cjName").value = rec?.name || "";
  if ($("cjCode")) $("cjCode").value = rec?.code || "";
  if ($("cjDescription")) $("cjDescription").value = rec?.description || "";
  if ($("cjAddress")) $("cjAddress").value = rec?.address || "";
  const ll = latlng || (rec ? { lat: rec.lat, lng: rec.lng } : map.getCenter());
  if ($("cjCoord")) $("cjCoord").textContent = `พิกัด: ${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`;
  if ($("cjDelete")) $("cjDelete").classList.toggle("hidden", !isCustomEdit);
  $("cjModal")?.classList.remove("hidden");
}
function closeCJModal() { $("cjModal")?.classList.add("hidden"); }
if ($("cjClose")) $("cjClose").onclick = closeCJModal;
if ($("cjCancel")) $("cjCancel").onclick = closeCJModal;
if ($("cjSave")) $("cjSave").onclick = () => {
  const name = ($("cjName")?.value || "").trim();
  const code = ($("cjCode")?.value || "").trim();
  const description = ($("cjDescription")?.value || "").trim();
  const address = ($("cjAddress")?.value || "").trim();
  if (!name) return toast("กรุณาใส่ชื่อ CJ MORE");
  const ctx = S.editingCJ || {};
  if (ctx.rec && ctx.isCustomEdit) {
    const rec = CJ.custom.find(r => r._localId === ctx.rec._localId);
    if (rec) { rec.name = name; rec.code = code; rec.description = description; rec.address = address; }
  } else if (ctx.rec && ctx.baseEditId != null) {
    CJ.edits.set(String(ctx.baseEditId), { description, address });
  } else {
    const ll = ctx.latlng || map.getCenter();
    const localId = "cj_" + Date.now();
    CJ.custom.push({ _localId: localId, _cjKey: localId, name, code, description, address, lat: ll.lat, lng: ll.lng });
  }
  cjPersist(); CJ.all = []; cjUpdate(); closeCJModal(); toast("บันทึกจุด CJ MORE แล้ว");
};
if ($("cjDelete")) $("cjDelete").onclick = () => {
  const rec = S.editingCJ?.rec;
  if (!rec || !S.editingCJ?.isCustomEdit) return;
  CJ.custom = CJ.custom.filter(r => r._localId !== rec._localId);
  cjPersist(); CJ.all = []; cjUpdate(); closeCJModal(); toast("ลบจุด CJ MORE แล้ว");
};
let cjAddMode = false;
function triggerCJAdd() {
  cjAddMode = !cjAddMode;
  if ($("mode")) $("mode").classList.toggle("hidden", !cjAddMode);
  if ($("modeText")) $("modeText").textContent = "🏪 คลิกตำแหน่งบนแผนที่เพื่อเพิ่มจุด CJ MORE";
  toast(cjAddMode ? "แตะบนแผนที่เพื่อเพิ่มจุด CJ MORE" : "ยกเลิก");
  closeCompetitorPanels();
}
if ($("cjAdd")) $("cjAdd").onclick = triggerCJAdd;
if ($("mCJAdd")) $("mCJAdd").onclick = triggerCJAdd;
cjUpdate();
document.addEventListener("click", e => {
  const btn = e.target.closest?.(".cjEditBtn");
  if (!btn) return;
  e.preventDefault(); e.stopPropagation();
  const item = CJ.all.find(x => String(x.key) === String(btn.dataset.key));
  if (!item) return toast("ไม่พบข้อมูลจุด CJ MORE นี้");
  if (item.isCustom) openCJModal(item.rec, null, true);
  else openCJModal(item.rec, null, false, item.key);
}, true);

/* ── PINS MANAGEMENT & GOOGLE MAPS DIRECT NAV ── */
const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];
const ICONS = { pin: "📍", star: "⭐", heart: "❤️", flag: "🚩", home: "🏠", food: "🍜", shop: "🏪", hotel: "🏨", photo: "📷" };
const PIN_LOGOS = {
  makro: "logo-makro.jpg",
  tops: "logo-tops.png",
  thukdee: "logo-thukdee.png",
  seven11: "logo-7eleven.png",
  bigcmini: "logo-bigc-mini.webp",
  cjmore: "logo-cj-more.jpg",
  cjx: "logo-cjx.png",
  lotusgo: "logo-lotusgo.png",
  lawson108: "logo-lawson108.png",
  van: "van.webp",
  m1: "m1.png",
  x: "x.jpg"
};

function pinIcon(color, icon, iconImg) {
  const c = /^#[0-9a-fA-F]{6}$/.test(color) ? color : COLORS[0];
  if (icon === "photo" && iconImg) {
    return L.divIcon({ className: "", html: `<div style="width:36px;height:36px;border-radius:50%;border:4px solid ${c};background:#fff;box-shadow:0 2px 6px #0006;overflow:hidden;box-sizing:border-box"><img src="${iconImg}" style="width:100%;height:100%;display:block;object-fit:cover"></div>`, iconSize: [36, 36], iconAnchor: [18, 32] });
  }
  if (PIN_LOGOS[icon]) {
    const html = `<div style="width:40px;height:40px;border-radius:10px;border:3px solid ${c};background:#fff;box-shadow:0 2px 6px #0006;display:flex;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden"><img src="${PIN_LOGOS[icon]}" alt="" draggable="false" style="width:34px;height:34px;display:block;object-fit:contain"></div>`;
    return L.divIcon({ className: "", html, iconSize: [40, 40], iconAnchor: [20, 35] });
  }
  const html = `<div style="width:36px;height:36px;border-radius:50%;border:4px solid ${c};background:#fff;box-shadow:0 2px 6px #0006;display:flex;align-items:center;justify-content:center;box-sizing:border-box"><span style="font-size:21px;line-height:1">${ICONS[icon] || "📍"}</span></div>`;
  return L.divIcon({ className: "", html, iconSize: [36, 36], iconAnchor: [18, 32] });
}

function marker(p) {
  const m = L.marker([p.lat, p.lng], { icon: pinIcon(p.color, p.icon, p.icon_img) });
  const gmapUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  const canEdit = !!S.session;
  m.bindPopup(`<div class="pin-title">${esc(p.title)}</div>
    <div>${esc(p.address || "")}</div>
    <div class="pin-note">${esc(p.note || "")}</div>
    <div class="pin-meta">ปักโดย ${esc(p.created_by || "ผู้ใช้")}</div>
    <a href="${gmapUrl}" target="_blank" rel="noopener" class="pin-nav-link">🧭 นำทาง (Google Maps)</a>
    ${canEdit ? `<button type="button" class="pin-nav-link pinEditBtn" data-id="${p.id}" style="background:#111">✎ แก้ไขจุด</button>` : ""}`);
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

function parseCoordinateQuery(value) {
  let raw = String(value || "").trim();
  if (!raw) return null;

  // รองรับพิกัดทั้งแบบมี/ไม่มีวงเล็บ เช่น
  // 13.7131613, 100.4223602
  // (13.7131613, 100.4223602)
  // 13.7131613 100.4223602
  // ( 13.7131613, 100.4223602 )
  raw = raw.replace(/^\s*\(\s*/, "").replace(/\s*\)\s*$/, "").trim();
  const m = raw.match(/^([+-]?\d+(?:\.\d+)?)\s*(?:,|\s+)\s*([+-]?\d+(?:\.\d+)?)$/);
  if (!m) return null;

  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return L.latLng(lat, lng);
}

let coordinateSearchMarker = null;

function searchCoordinate() {
  const value = $("search")?.value || $("mSearchInput")?.value || "";
  const ll = parseCoordinateQuery(value);
  if (!ll) return false;

  if (coordinateSearchMarker) map.removeLayer(coordinateSearchMarker);
  coordinateSearchMarker = L.marker(ll, { zIndexOffset: 3000 }).addTo(map);
  coordinateSearchMarker.bindTooltip("คลิกมุดนี้เพื่อปักจุด", { direction: "top", offset: [0, -30] });
  coordinateSearchMarker.on("click", () => openModal(null, ll));
  map.flyTo(ll, Math.max(map.getZoom(), 17), { duration: 0.8 });
  toast(`ไปยังพิกัด ${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`);
  return true;
}

const handleSearch = () => {
  if (searchCoordinate()) return;
  rebuild(); s11Update(); cjUpdate();
};

function clearSearch() {
  if ($("search")) $("search").value = "";
  if ($("mSearchInput")) $("mSearchInput").value = "";
  if (coordinateSearchMarker) {
    map.removeLayer(coordinateSearchMarker);
    coordinateSearchMarker = null;
  }
  rebuild();
  s11Update();
  cjUpdate();
}

function addSearchClearButton(input, parent, extraClass = "") {
  if (!input || !parent || parent.querySelector(".pinmap-search-clear")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `pinmap-search-clear ${extraClass}`.trim();
  btn.textContent = "Clear";
  btn.title = "ล้างการค้นหา";
  btn.setAttribute("aria-label", "ล้างการค้นหา");
  btn.style.cssText = "border:0;background:transparent;padding:4px 7px;cursor:pointer;font-weight:600;line-height:1;";
  btn.onclick = clearSearch;
  parent.appendChild(btn);
}

if ($("search")) {
  $("search").oninput = handleSearch;
  $("search").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); searchCoordinate(); } };
  addSearchClearButton($("search"), $("search").parentElement);
}
if ($("mSearchInput")) {
  $("mSearchInput").oninput = handleSearch;
  $("mSearchInput").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); searchCoordinate(); } };
  addSearchClearButton($("mSearchInput"), $("mSearchInput").parentElement, "mobile");
}
if ($("searchBtn")) $("searchBtn").onclick = () => {
  if (!searchCoordinate()) handleSearch();
};

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
  S.editing = p;
  S.pending = latlng || (p ? { lat: p.lat, lng: p.lng } : null);
  if (!S.pending) return;
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
  const isOwner = !!(S.session && p && p.created_by_user_id === S.session.user.id);
  if ($("delete")) $("delete").classList.toggle("hidden", !isOwner);
  if ($("movePin")) $("movePin").classList.toggle("hidden", !p);
  const ll = S.pending;
  if ($("coord")) $("coord").textContent = `พิกัด: ${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)}`;
  if ($("modal")) $("modal").classList.remove("hidden");
}
function closeModal() { if ($("modal")) $("modal").classList.add("hidden"); }
if ($("close")) $("close").onclick = closeModal;
if ($("cancel")) $("cancel").onclick = closeModal;

if ($("movePin")) {
  $("movePin").onclick = () => {
    if (!S.editing) return;
    S.moving = true;
    closeModal();
    toast("แตะตำแหน่งใหม่บนแผนที่ แล้วกดบันทึก");
  };
}

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
      if (coordinateSearchMarker) {
        map.removeLayer(coordinateSearchMarker);
        coordinateSearchMarker = null;
      }
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
    if (!S.session || S.editing.created_by_user_id !== S.session.user.id) return toast("ลบได้เฉพาะจุดที่คุณเป็นคนปัก");
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
    S.adding = false; s11AddMode = false; cjAddMode = false;
    if ($("mode")) $("mode").classList.add("hidden");
  };
}

map.on("click", e => {
  if (S.moving && S.editing) {
    S.moving = false;
    if ($("mode")) $("mode").classList.add("hidden");
    openModal(S.editing, e.latlng);
    toast("เลือกตำแหน่งใหม่แล้ว กดบันทึกเพื่อยืนยัน");
  } else if (S.adding) {
    S.adding = false;
    if ($("mode")) $("mode").classList.add("hidden");
    openModal(null, e.latlng);
  } else if (s11AddMode) {
    s11AddMode = false;
    if ($("mode")) $("mode").classList.add("hidden");
    openS11Modal(null, e.latlng);
  } else if (cjAddMode) {
    cjAddMode = false;
    if ($("mode")) $("mode").classList.add("hidden");
    openCJModal(null, e.latlng);
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

function getOnlineUsers() {
  const users = new Map();
  if (!S.ch) return users;

  const state = S.ch.presenceState();
  Object.values(state || {}).forEach(metas => {
    (Array.isArray(metas) ? metas : []).forEach(meta => {
      const id = meta?.user_id || meta?.userId || meta?.presence_ref;
      if (!id) return;
      const key = String(id);
      if (!users.has(key)) {
        users.set(key, {
          id: key,
          name: meta?.username || meta?.display_name || meta?.name || (key === S.session?.user?.id ? username() : "ผู้ใช้")
        });
      }
    });
  });
  return users;
}

function updateOnlineCount() {
  const count = getOnlineUsers().size;
  const el = $("onlineCount");
  if (el) el.textContent = String(count);
  const mobileEl = $("mOnlineCount");
  if (mobileEl) mobileEl.textContent = String(count);
}

function openOnlineUsers() {
  if (!$("onlineModal")) return;
  const list = $("onlineUsersList");
  const users = [...getOnlineUsers().values()];
  if (list) {
    list.innerHTML = users.length
      ? users.map(u => `<div class="onlineUser"><i class="onlineUserDot"></i><span>${esc(u.name)}</span></div>`).join("")
      : `<div class="muted">ยังไม่พบผู้ใช้ออนไลน์ในห้องนี้</div>`;
  }
  $("onlineModal").classList.remove("hidden");
}

function closeOnlineUsers() {
  if ($("onlineModal")) $("onlineModal").classList.add("hidden");
}

if ($("onlineClose")) $("onlineClose").onclick = closeOnlineUsers;
if ($("onlineModal")) $("onlineModal").addEventListener("click", e => {
  if (e.target === $("onlineModal")) closeOnlineUsers();
});
const onlineButton = document.querySelector(".online");
if (onlineButton) onlineButton.onclick = openOnlineUsers;
const mobileOnlineButton = document.querySelector(".m-online");
if (mobileOnlineButton) mobileOnlineButton.onclick = e => {
  e.stopPropagation();
  openOnlineUsers();
};

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
          username: username(),
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

/* ── REQUESTED ADDITIONS: PRIMARY/SECONDARY ROADS + KML + 3 CUSTOM LOGOS ── */
(function setupRequestedAdditions(){
  const ensureStyle = () => {
    if ($("pinmapRequestedStyle")) return;
    const st = document.createElement("style");
    st.id = "pinmapRequestedStyle";
    st.textContent = `
      .pinmap-road-item.active, .pinmap-kml-item.active { background:#111 !important; color:#fff !important; }
      .pinmap-kml-panel { margin:4px 0 8px; display:flex; flex-direction:column; gap:4px; }
      .pinmap-kml-row { display:flex; gap:4px; align-items:center; }
      .pinmap-kml-row button { flex:1; min-width:0; }
      .pinmap-kml-remove { flex:0 0 34px !important; padding:8px 4px !important; }
      .pinmap-road-note, .pinmap-kml-note { font-size:11px; color:#777; padding:2px 4px 4px; }
      .logoIconBtn img { width:30px; height:30px; object-fit:contain; display:block; }
    `;
    document.head.appendChild(st);
  };
  ensureStyle();

  // Add the 3 user-provided logos without changing the existing icon choices.
  const iconRow = document.querySelector(".iconRow");
  if (iconRow && !iconRow.querySelector('[data-icon="van"]')) {
    [
      ["van", "Van", "van.webp"],
      ["m1", "M1", "m1.png"],
      ["x", "X", "x.jpg"]
    ].forEach(([key,title,src]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "iconBtn logoIconBtn";
      b.dataset.icon = key;
      b.title = title;
      b.innerHTML = `<img src="${src}" alt="${title}" draggable="false">`;
      iconRow.appendChild(b);
    });
  }

  // Roads: load only when requested, and render only roads inside the current view.
  let roadLayer = null;
  let roadLoading = false;
  let roadLoaded = false;
  let roadRefreshTimer = null;
  const ROAD_MIN_ZOOM = 10;
  const roadRenderer = L.canvas({ padding: 0.5 });
  const roadStyle = f => ({
    color: f?.properties?.fclass === "primary" ? "#e11d48" : "#f59e0b",
    weight: f?.properties?.fclass === "primary" ? 3 : 2,
    opacity: 0.88,
    interactive: false
  });
  function refreshRoadView(){
    if (!roadLoaded || !window.PINMAP_ROADS) return;
    if (roadLayer) { map.removeLayer(roadLayer); roadLayer = null; }
    if (!roadOn || map.getZoom() < ROAD_MIN_ZOOM) return;
    const fc = window.PINMAP_ROADS;
    const bboxes = fc.bboxes || [];
    const bounds = map.getBounds();
    const features = [];
    for (let i=0; i<fc.features.length; i++) {
      const b=bboxes[i];
      if (!b || b[2] < bounds.getWest() || b[0] > bounds.getEast() || b[3] < bounds.getSouth() || b[1] > bounds.getNorth()) continue;
      const f=fc.features[i];
      if (f?.properties?.fclass === "primary" || f?.properties?.fclass === "secondary") features.push(f);
    }
    roadLayer = L.geoJSON({type:"FeatureCollection",features}, {style:roadStyle,renderer:roadRenderer,smoothFactor:1.2,interactive:false}).addTo(map);
  }
  function scheduleRoadRefresh(){
    if (!roadOn || !roadLoaded) return;
    clearTimeout(roadRefreshTimer);
    roadRefreshTimer=setTimeout(refreshRoadView,180);
  }
  function loadRoadData(){
    if (roadLoaded || roadLoading) return;
    roadLoading = true;
    toast("กำลังโหลดข้อมูลถนน…");
    const sc = document.createElement("script");
    sc.src = "roads-data.js";
    sc.onload = () => {
      roadLoaded = true; roadLoading = false;
      refreshRoadView();
      toast(map.getZoom() >= ROAD_MIN_ZOOM ? "เปิดถนน Primary / Secondary แล้ว" : `ซูมเข้าอีกเล็กน้อยเพื่อแสดงถนน`);
      roadBtn?.classList.add("active"); mRoadBtn?.classList.add("active");
    };
    sc.onerror = () => { roadLoading = false; toast("ไม่พบไฟล์ roads-data.js"); };
    document.head.appendChild(sc);
  }
  let roadOn = false;
  function toggleRoads(){
    roadOn = !roadOn;
    roadBtn?.classList.toggle("active",roadOn); mRoadBtn?.classList.toggle("active",roadOn);
    if (!roadOn) {
      clearTimeout(roadRefreshTimer);
      if (roadLayer) { map.removeLayer(roadLayer); roadLayer=null; }
      toast("ปิดถนน");
      return;
    }
    if (!roadLoaded) loadRoadData();
    else { refreshRoadView(); toast(map.getZoom() >= ROAD_MIN_ZOOM ? "เปิดถนน Primary / Secondary" : "ซูมเข้าอีกเล็กน้อยเพื่อแสดงถนน"); }
  }
  map.on("moveend zoomend", scheduleRoadRefresh);

  // KML: no artificial file-size limit. Files are processed locally in the browser.
  const kmlLayers = new Map();
  let kmlSeq = 0;
  const kmlInput = document.createElement("input");
  kmlInput.type = "file";
  kmlInput.accept = ".kml,application/vnd.google-earth.kml+xml,text/xml,application/xml";
  kmlInput.multiple = true;
  kmlInput.style.display = "none";
  document.body.appendChild(kmlInput);

  function kmlCoords(node){
    const text = (node?.textContent || "").trim();
    return text.split(/\s+/).map(x => {
      const p=x.split(",");
      return p.length >= 2 ? [Number(p[1]), Number(p[0])] : null;
    }).filter(p => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }
  function parseKmlPlacemark(pm, group){
    const name = (pm.querySelector("name")?.textContent || "KML").trim();
    const description = (pm.querySelector("description")?.textContent || "").trim();
    const popup = `<b>${esc(name)}</b>${description ? `<br>${esc(description).slice(0,4000)}` : ""}`;
    const addGeom = geom => {
      if (!geom) return;
      const tag = geom.localName;
      if (tag === "Point") {
        const c = kmlCoords(geom.querySelector("coordinates"))[0];
        if (c) L.marker(c).bindPopup(popup).addTo(group);
      } else if (tag === "LineString") {
        const c = kmlCoords(geom.querySelector("coordinates"));
        if (c.length >= 2) L.polyline(c, { color:"#2563eb", weight:3, opacity:.9 }).bindPopup(popup).addTo(group);
      } else if (tag === "Polygon") {
        const rings = [...geom.querySelectorAll(":scope > outerBoundaryIs > LinearRing, :scope > innerBoundaryIs > LinearRing")];
        const outer = rings[0] ? kmlCoords(rings[0].querySelector("coordinates")) : [];
        const holes = rings.slice(1).map(r => kmlCoords(r.querySelector("coordinates"))).filter(r => r.length >= 3);
        if (outer.length >= 3) L.polygon([outer, ...holes], { color:"#2563eb", weight:2, fillOpacity:.16 }).bindPopup(popup).addTo(group);
      } else if (tag === "MultiGeometry") {
        [...geom.children].forEach(addGeom);
      }
    };
    [...pm.children].filter(el => ["Point","LineString","Polygon","MultiGeometry"].includes(el.localName)).forEach(addGeom);
  }
  async function addKmlFiles(files){
    for (const file of files) {
      try {
        const text = await file.text();
        const xml = new DOMParser().parseFromString(text, "application/xml");
        if (xml.querySelector("parsererror")) throw new Error("KML parse error");
        const group = L.featureGroup();
        xml.querySelectorAll("Placemark").forEach(pm => parseKmlPlacemark(pm, group));
        if (!group.getLayers().length) throw new Error("ไม่พบ Placemark ที่รองรับ");
        group.addTo(map);
        const id = `kml_${++kmlSeq}`;
        kmlLayers.set(id, { id, name:file.name, layer:group });
        renderKmlPanel();
        toast(`เพิ่ม KML: ${file.name}`);
      } catch(err) {
        console.error(err); toast(`อ่าน KML ไม่สำเร็จ: ${file.name}`);
      }
    }
    kmlInput.value = "";
  }
  kmlInput.addEventListener("change", () => addKmlFiles([...kmlInput.files]));
  function addKml(){ kmlInput.click(); }

  const sidebarBody = $("sidebarBody");
  const mobileMenuBody = document.querySelector(".mobileMenuBody");
  function makeButton(id, text, cls="item"){
    const b=document.createElement("button"); b.id=id; b.type="button"; b.className=`${cls} pinmap-${id}`; b.textContent=text; return b;
  }
  let roadBtn=null, kmlBtn=null, mRoadBtn=null, mKmlBtn=null;
  if (sidebarBody) {
    const anchor = $("dolToggle") || $("locate");
    roadBtn = makeButton("roadToggle", "🛣️ ถนน Primary / Secondary");
    kmlBtn = makeButton("kmlAdd", "＋ Add KML File");
    roadBtn.classList.add("pinmap-road-item"); kmlBtn.classList.add("pinmap-kml-item");
    anchor?.parentNode.insertBefore(roadBtn, anchor.nextSibling);
    roadBtn.parentNode.insertBefore(kmlBtn, roadBtn.nextSibling);
    roadBtn.onclick=toggleRoads; kmlBtn.onclick=addKml;
  }
  if (mobileMenuBody) {
    const anchor = $("mDolBtn") || $("mBoundaryToggle");
    mRoadBtn = makeButton("mRoadToggle", "🛣️ ถนน Primary / Secondary");
    mKmlBtn = makeButton("mKmlAdd", "＋ Add KML File");
    mRoadBtn.classList.add("pinmap-road-item"); mKmlBtn.classList.add("pinmap-kml-item");
    anchor?.parentNode.insertBefore(mRoadBtn, anchor.nextSibling);
    mRoadBtn.parentNode.insertBefore(mKmlBtn, mRoadBtn.nextSibling);
    mRoadBtn.onclick=toggleRoads; mKmlBtn.onclick=addKml;
  }
  function renderKmlPanel(){
    let panel=$("pinmapKmlPanel");
    if(!panel){
      panel=document.createElement("div"); panel.id="pinmapKmlPanel"; panel.className="pinmap-kml-panel";
      const target=kmlBtn?.parentNode || sidebarBody;
      if(target && kmlBtn) target.insertBefore(panel,kmlBtn.nextSibling); else sidebarBody?.appendChild(panel);
    }
    panel.innerHTML="";
    kmlLayers.forEach(item=>{
      const row=document.createElement("div"); row.className="pinmap-kml-row";
      const toggle=document.createElement("button"); toggle.type="button"; toggle.className="item"; toggle.textContent=`KML: ${item.name}`;
      toggle.onclick=()=>{ if(map.hasLayer(item.layer)){map.removeLayer(item.layer);toggle.classList.remove("active");}else{item.layer.addTo(map);toggle.classList.add("active");} };
      const remove=document.createElement("button"); remove.type="button"; remove.className="item pinmap-kml-remove"; remove.textContent="×"; remove.title="ลบ KML จากแผนที่";
      remove.onclick=()=>{map.removeLayer(item.layer);kmlLayers.delete(item.id);renderKmlPanel();};
      row.append(toggle,remove); panel.appendChild(row);
    });
  }
})();


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
