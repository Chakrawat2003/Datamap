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


/* =========================================================
   COPY MAP COORDINATES : DESKTOP RIGHT-CLICK + MOBILE LONG-PRESS
   ========================================================= */
let coordinateCopyPopup = null;

function showCoordinateCopy(latlng) {
  const lat = Number(latlng.lat).toFixed(6);
  const lng = Number(latlng.lng).toFixed(6);
  const text = `${lat}, ${lng}`;

  if (coordinateCopyPopup) {
    try { map.closePopup(coordinateCopyPopup); } catch (e) {}
  }

  const popupHtml = `
    <div style="min-width:190px;text-align:center">
      <div style="font-weight:700;margin-bottom:6px">พิกัด</div>
      <div style="font-size:13px;margin-bottom:9px;user-select:text">${lat}, ${lng}</div>
      <button type="button" id="copyMapCoordinateBtn"
        style="border:0;border-radius:8px;background:#111;color:#fff;padding:8px 18px;cursor:pointer;font-weight:700">
        📋 Copy
      </button>
      <div style="font-size:10px;color:#aaa;margin-top:7px">แตะ 2 ครั้งบนแผนที่เพื่อ copy พิกัด (มือถือ)<br>คลิกขวาบนแผนที่ (คอมพิวเตอร์)</div>
    </div>
  `;

  coordinateCopyPopup = L.popup({ closeButton: true, autoClose: true })
    .setLatLng(latlng)
    .setContent(popupHtml)
    .openOn(map);

  setTimeout(() => {
    const btn = $("copyMapCoordinateBtn");
    if (!btn) return;
    btn.onclick = async e => {
      e.preventDefault();
      e.stopPropagation();
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        toast(`คัดลอกพิกัดแล้ว: ${text}`);
      } catch (err) {
        console.error("Copy coordinate error:", err);
        toast("คัดลอกพิกัดไม่สำเร็จ");
      }
    };
  }, 0);
}

// Desktop: right-click on the map.
map.on("contextmenu", e => {
  showCoordinateCopy(e.latlng);
});

// Mobile: double-tap on the map to show Copy coordinate popup.
const mapContainer = map.getContainer();
let _dtLastTap = 0;
let _dtTimer = null;
let _dtPos = null;
mapContainer.addEventListener("touchend", e => {
  if (!e.changedTouches || e.changedTouches.length !== 1) return;
  const t = e.changedTouches[0];
  const now = Date.now();
  const dt = now - _dtLastTap;
  if (dt < 350 && dt > 40 && _dtPos) {
    // double-tap confirmed
    clearTimeout(_dtTimer);
    const dx = t.clientX - _dtPos.x, dy = t.clientY - _dtPos.y;
    if (Math.hypot(dx, dy) < 30) {
      const rect = mapContainer.getBoundingClientRect();
      const point = L.point(t.clientX - rect.left, t.clientY - rect.top);
      showCoordinateCopy(map.containerPointToLatLng(point));
      _dtLastTap = 0; _dtPos = null;
      return;
    }
  }
  _dtLastTap = now;
  _dtPos = { x: t.clientX, y: t.clientY };
  clearTimeout(_dtTimer);
  _dtTimer = setTimeout(() => { _dtLastTap = 0; _dtPos = null; }, 400);
}, { passive: true });

// Base map selection: Google Hybrid is the default; OSM (buildings + street names) is the other option.
const googleHybridLayer = L.tileLayer(
  "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  { maxZoom: 19, attribution: "Google Hybrid" }
).addTo(map);

const osmLayer = L.tileLayer(
  "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  { maxZoom: 19, subdomains: "abc", attribution: "© OpenStreetMap contributors" }
);

let activeBaseMap = "googleHybrid";

function setBaseMap(name) {
  if (name === "osm") {
    if (map.hasLayer(googleHybridLayer)) map.removeLayer(googleHybridLayer);
    if (!map.hasLayer(osmLayer)) osmLayer.addTo(map);
    activeBaseMap = "osm";
  } else {
    if (map.hasLayer(osmLayer)) map.removeLayer(osmLayer);
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
    setBaseMap(activeBaseMap === "googleHybrid" ? "osm" : "googleHybrid");
  });
  return wrap;
};
baseMapControl.addTo(map);

function updateBaseMapPreview() {
  const thumb = $("baseMapPreview")?.querySelector(".baseMapThumb");
  if (!thumb) return;
  thumb.classList.toggle("osm", activeBaseMap === "osm");
  thumb.title = activeBaseMap === "googleHybrid" ? "google hybrid" : "OSM";
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

const cluster = L.layerGroup().addTo(map);

// Render only markers inside/near the current viewport. All data remains loaded;
// off-screen markers are simply not attached to the map until they become visible.
const PINMAP_VIEWPORT_PADDING = 0;
function pinmapVisibleBounds() {
  return map.getBounds().pad(PINMAP_VIEWPORT_PADDING);
}
function pinmapInViewport(lat, lng, bounds = pinmapVisibleBounds()) {
  return Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && bounds.contains([Number(lat), Number(lng)]);
}


/* ── 7-ELEVEN LAYER ── */
const s11Cluster = L.layerGroup();

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


(function ensureSmallCompetitorMarkers(){
  if (document.getElementById("pinmapSmallCompetitorMarkers")) return;
  const st = document.createElement("style");
  st.id = "pinmapSmallCompetitorMarkers";
  st.textContent = `.cjmore-logo-marker{width:25px !important;height:25px !important;display:flex !important;align-items:center !important;justify-content:center !important;overflow:hidden !important;box-sizing:border-box !important;} .cjmore-logo-marker img{width:21px !important;height:21px !important;display:block !important;object-fit:contain !important;} .s11-logo-marker{width:26px !important;height:26px !important;display:flex !important;align-items:center !important;justify-content:center !important;overflow:hidden !important;box-sizing:border-box !important;border-radius:50% !important;border:2.5px solid var(--s11-border,#008450) !important;background:#fff !important;} .s11-logo-marker img{width:100% !important;height:100% !important;object-fit:cover !important;display:block !important;}`;
  document.head.appendChild(st);
})();

function s11MakeIcon(color = "green") {
  const border = s11SafeColor(color);
  const html = `<span class="s11-logo-marker" style="--s11-border:${border}">
    <img src="7-11-logo.png" alt="7-Eleven" draggable="false">
  </span>`;
  return L.divIcon({
    className: "s11-logo-icon",
    html,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -22]
  });
}

/* =========================================================
   7-ELEVEN : SUPABASE VERSION
   ========================================================= */

function s11BuildAll() {
  const base = (window.SEVEN11_DATA || []).map((rec, index) => {
    const key = s11Key(rec, index);
    const merged = { ...rec, _s11Key: key };
    return {
      rec: merged,
      m: null,
      id: merged.id,
      key,
      isCustom: !!merged.is_custom
    };
  });
  S11.all = base;
}

function s11EnsureMarker(item) {
  if (item.m) return item.m;
  const merged = item.rec;
  const m = L.marker([merged.y, merged.x], { icon: s11MakeIcon(merged.color || "green") });
  m.bindPopup(s11PopupHtml(merged, { editable: true }), {
    closeButton: true,
    autoClose: true,
    closeOnClick: false
  });
  m.on("popupopen", ev => {
    const btn = ev.popup.getElement()?.querySelector(".s11EditBtn");
    if (btn) {
      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        openS11Modal(merged, null, !!merged.is_custom, item.key);
      };
    }
  });
  item.m = m;
  return m;
}


function s11Update() {

  if (!window.SEVEN11_DATA) return;

  s11BuildAll();

  const q =
    (
      ($("search") ? $("search").value : "") ||
      ($("mSearchInput") ? $("mSearchInput").value : "")
    )
    .toLowerCase()
    .trim();

  const list =
    q
      ? S11.all.filter(x =>
          (
            String(x.rec.n || "") +
            " " +
            String(x.rec.a || "")
          )
          .toLowerCase()
          .includes(q)
        )
      : (S11.on ? S11.all : []);

  // Marker rendering is handled centrally by pinmapApplyPointCap().

  if ($("s11Count")) {
    $("s11Count").textContent =
      list.length
        ? list.length.toLocaleString("th-TH")
        : "";
  }

  if ($("mS11Count")) {
    $("mS11Count").textContent =
      list.length
        ? list.length.toLocaleString("th-TH")
        : "";
  }

  if ($("s11Toggle")) {
    $("s11Toggle").classList.toggle(
      "active",
      S11.on
    );
  }

  if ($("mS11Toggle")) {
    $("mS11Toggle").classList.toggle(
      "active",
      S11.on
    );
  }

  pinmapApplyPointCap();
}


/* ---------- COMPETITOR PANEL / 7-ELEVEN TOGGLE ---------- */
const toggleS11 = () => {
  S11.on = !S11.on;
  localStorage.setItem(S11_ON_KEY, S11.on ? "1" : "0");
  s11Update();
  toast(S11.on ? "แสดง 7-Eleven" : "ซ่อน 7-Eleven");
};
if ($("s11Toggle")) $("s11Toggle").onclick = toggleS11;
if ($("mS11Toggle")) $("mS11Toggle").onclick = toggleS11;

// Popup ปุ่มแก้ไขของ 7-Eleven ใช้ event delegation เพื่อให้ทำงานกับ DOM ที่ Leaflet สร้างใหม่
document.addEventListener("click", e => {
  const btn = e.target.closest?.(".s11EditBtn");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();

  const key = btn.dataset.key || "";
  const item = S11.all.find(x => String(x.key ?? x.id) === String(key));
  if (!item) return toast("ไม่พบข้อมูลจุด 7-Eleven นี้");

  if (item.isCustom) {
    openS11Modal(item.rec, null, true);
  } else {
    openS11Modal(item.rec, null, false, item.key);
  }
}, true);

/* ---------- SAVE 7-ELEVEN ---------- */

if ($("s11Save")) {

  $("s11Save").onclick = async () => {

    const n =
      ($("s11Title")?.value || "").trim();

    const a =
      ($("s11Address")?.value || "").trim();

    const note =
      ($("s11Note")?.value || "").trim();

    const color =
      $("s11Color")?.value || "green";

    if (!n) {
      return toast("กรุณาใส่ชื่อสาขา");
    }

    if (!S.sb) {
      return toast("ยังไม่ได้เชื่อมต่อ Supabase");
    }

    const ctx = S.editingS11 || {};

    const ll =
      ctx.latlng ||
      (
        ctx.rec
          ? {
              lat: ctx.rec.y,
              lng: ctx.rec.x
            }
          : map.getCenter()
      );

    try {

      /* ===== EDIT EXISTING ===== */

      if (ctx.rec && ctx.baseEditId != null) {

        const payload = {
          name_th: n,
          address_th: a,
          latitude: ll.lat,
          longitude: ll.lng,
          note: note,
          color: color
        };

        let result =
          await S.sb
            .from("7-11")
            .update(payload)
            .eq(
              "id",
              String(ctx.baseEditId)
            );

        /*
         * ถ้า table ยังไม่มี note/color
         * ให้ retry โดยใช้เฉพาะ column หลัก
         */
        if (
          result.error &&
          /column .*note|column .*color/i.test(
            result.error.message || ""
          )
        ) {

          result =
            await S.sb
              .from("7-11")
              .update({
                name_th: n,
                address_th: a,
                latitude: ll.lat,
                longitude: ll.lng
              })
              .eq(
                "id",
                String(ctx.baseEditId)
              );
        }

        if (result.error) {
          throw result.error;
        }

      }

      /* ===== ADD NEW ===== */

      else {

        const id =
          "custom_" +
          Date.now();

        const payload = {
          id: id,
          name_th: n,
          address_th: a,
          latitude: ll.lat,
          longitude: ll.lng,
          note: note,
          color: color,
          is_custom: true
        };

        let result =
          await S.sb
            .from("7-11")
            .insert(payload);

        /*
         * fallback ถ้า note/color ยังไม่มี
         */
        if (
          result.error &&
          /column .*note|column .*color/i.test(
            result.error.message || ""
          )
        ) {

          result =
            await S.sb
              .from("7-11")
              .insert({
                id: id,
                name_th: n,
                address_th: a,
                latitude: ll.lat,
                longitude: ll.lng,
                is_custom: true
              });
        }

        if (result.error) {
          throw result.error;
        }
      }

      /* อัปเดตแผนที่ทันที ไม่รอโหลดทั้งตาราง */
      fastRefreshS11({
        id: ctx.baseEditId != null ? ctx.baseEditId : ("custom_" + Date.now()),
        n,
        a,
        note,
        color,
        y: ll.lat,
        x: ll.lng,
        is_custom: ctx.rec ? !!ctx.rec.is_custom : true
      });

      closeS11Modal();
      toast("บันทึก 7-Eleven แล้ว");

      /* โหลดข้อมูลจริงจาก Supabase แบบ background */
      scheduleCompetitorReload(700);

    } catch (err) {

      console.error(
        "7-Eleven save error:",
        err
      );

      toast(
        "บันทึก 7-Eleven ไม่สำเร็จ"
      );
    }
  };
}


/* ---------- DELETE 7-ELEVEN ---------- */

if ($("s11Delete")) {

  $("s11Delete").onclick = async () => {

    const ctx = S.editingS11 || {};

    if (!ctx.rec) return;

    if (!S.sb) {
      return toast(
        "ยังไม่ได้เชื่อมต่อ Supabase"
      );
    }

    const id =
      ctx.baseEditId ??
      ctx.rec.id;

    if (
      id === undefined ||
      id === null
    ) {
      return toast(
        "ไม่พบ ID ของจุดนี้"
      );
    }

    try {

      const { error } =
        await S.sb
          .from("7-11")
          .delete()
          .eq("id", String(id));

      if (error) {
        throw error;
      }

      /* ลบจากแผนที่ทันที */
      fastDeleteS11(id);

      closeS11Modal();
      toast("ลบจุด 7-Eleven แล้ว");

      /* sync กลับจาก Supabase แบบ background */
      scheduleCompetitorReload(700);

    } catch (err) {

      console.error(
        "7-Eleven delete error:",
        err
      );

      toast(
        "ลบ 7-Eleven ไม่สำเร็จ"
      );
    }
  };
}
/* ── S11 ADD/EDIT MODAL ── */
function s11PopulateColors() {
  const wrap = $("s11Colors");
  if (!wrap) return;
  const colors = [
    ["red",          "#ef4444", "แดง"],
    ["blue",         "#2563eb", "ฟ้า"],
    ["yellow",       "#eab308", "เหลือง"],
    ["green",        "#008450", "เขียว"],
    ["light-purple", "#a78bfa", "ม่วงอ่อน"]
  ];
  wrap.innerHTML = colors.map(([name, hex, label]) =>
    `<button type="button" class="s11ColorSwatch swatch" data-color="${name}" title="${label}" aria-label="${label}">
       <span class="s11SwatchCircle" style="background:${hex}"></span>
       <span class="s11SwatchLabel">${label}</span>
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
  $("s11Colors")?.querySelectorAll(".s11ColorSwatch").forEach(b => b.classList.toggle("active", b.dataset.color === value));
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

  /* สร้างปุ่มย้ายตำแหน่งให้เอง หาก HTML เดิมยังไม่มี */
  const deleteBtn = $("s11Delete");
  if (deleteBtn && !$("s11MovePin")) {
    const moveBtn = document.createElement("button");
    moveBtn.type = "button";
    moveBtn.id = "s11MovePin";
    moveBtn.className = deleteBtn.className;
    moveBtn.textContent = "📍 ย้ายตำแหน่ง";
    deleteBtn.parentNode?.insertBefore(moveBtn, deleteBtn);
  }
  if ($("s11MovePin")) {
    $("s11MovePin").classList.toggle("hidden", !rec);
    $("s11MovePin").onclick = () => startCompetitorMove("s11", rec);
  }

  if ($("s11Modal")) $("s11Modal").classList.remove("hidden");
}
function closeS11Modal() { if ($("s11Modal")) $("s11Modal").classList.add("hidden"); }
if ($("s11Close")) $("s11Close").onclick = closeS11Modal;
if ($("s11Cancel")) $("s11Cancel").onclick = closeS11Modal;

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
const cjCluster = L.layerGroup();
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
    html: `<span class="cjmore-logo-marker"><img src="logo-cj-more.jpg" alt="CJ MORE" draggable="false" style="width:21px;height:21px;display:block;object-fit:contain"></span>`,
    iconSize: [25, 25], iconAnchor: [12.5, 12.5], popupAnchor: [0, -22]
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
/* =========================================================
   CJ MORE : SUPABASE VERSION
   ========================================================= */

function cjBuildAll() {
  const base = (window.CJMORE_DATA || []).map((rec, index) => {
    const key = cjKey(rec, index);
    const merged = { ...rec, _cjKey: key };
    return {
      rec: merged,
      m: null,
      key,
      isCustom: !!merged.is_custom
    };
  });
  CJ.all = base;
}

function cjEnsureMarker(item) {
  if (item.m) return item.m;
  const merged = item.rec;
  const m = L.marker([merged.lat, merged.lng], { icon: cjMakeIcon() });
  m.bindPopup(cjPopupHtml(merged, { editable: true }), {
    closeButton: true,
    autoClose: true,
    closeOnClick: false
  });
  m.on("popupopen", ev => {
    const btn = ev.popup.getElement()?.querySelector(".cjEditBtn");
    if (btn) {
      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        openCJModal(merged, null, !!merged.is_custom, item.key);
      };
    }
  });
  item.m = m;
  return m;
}


function cjUpdate() {

  if (!window.CJMORE_DATA) return;

  cjBuildAll();

  const q =
    (
      ($("search")
        ? $("search").value
        : "") ||
      ($("mSearchInput")
        ? $("mSearchInput").value
        : "")
    )
    .toLowerCase()
    .trim();

  const list =
    q
      ? CJ.all.filter(x =>
          (
            cjDisplayName(x.rec) +
            " " +
            (x.rec.address || "") +
            " " +
            (x.rec.description || "")
          )
          .toLowerCase()
          .includes(q)
        )
      : (
          CJ.on
            ? CJ.all
            : []
        );

  // Marker rendering is handled centrally by pinmapApplyPointCap().

  if ($("cjCount")) {

    $("cjCount").textContent =
      list.length
        ? list.length.toLocaleString("th-TH")
        : "";
  }

  if ($("mCJCount")) {

    $("mCJCount").textContent =
      list.length
        ? list.length.toLocaleString("th-TH")
        : "";
  }

  if ($("cjToggle")) {

    $("cjToggle")
      .classList
      .toggle(
        "active",
        CJ.on
      );
  }

  if ($("mCJToggle")) {

    $("mCJToggle")
      .classList
      .toggle(
        "active",
        CJ.on
      );
  }

  pinmapApplyPointCap();
}


/* ---------- COMPETITOR PANEL / CJ MORE TOGGLE ---------- */
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

/* ---------- SAVE CJ MORE ---------- */

if ($("cjSave")) {

  $("cjSave").onclick =
    async () => {

      const name =
        ($("cjName")?.value || "")
          .trim();

      const code =
        ($("cjCode")?.value || "")
          .trim();

      const description =
        ($("cjDescription")?.value || "")
          .trim();

      const address =
        ($("cjAddress")?.value || "")
          .trim();

      if (!name) {

        return toast(
          "กรุณาใส่ชื่อ CJ MORE"
        );
      }

      if (!S.sb) {

        return toast(
          "ยังไม่ได้เชื่อมต่อ Supabase"
        );
      }

      const ctx =
        S.editingCJ || {};

      const ll =
        ctx.latlng ||
        (
          ctx.rec
            ? {
                lat: ctx.rec.lat,
                lng: ctx.rec.lng
              }
            : map.getCenter()
        );

      try {

        /* ===== EDIT ===== */

        if (
          ctx.rec &&
          ctx.baseEditId != null
        ) {

          const { error } =
            await S.sb
              .from("CJMore")
              .update({
                name: name,
                code: code,
                description: description,
                address: address,
                lat: ll.lat,
                long: ll.lng
              })
              .eq(
                "id",
                ctx.baseEditId
              );

          if (error) {
            throw error;
          }
        }

        /* ===== ADD ===== */

        else {

          const { data: insertedCJ, error } =
            await S.sb
              .from("CJMore")
              .insert({
                code: code,
                name: name,
                description: description,
                address: address,
                lat: ll.lat,
                long: ll.lng,
                is_custom: true
              })
              .select()
              .single();

          if (error) {
            throw error;
          }

          /* เก็บ id ที่ Supabase สร้างให้ เพื่อให้แก้/ลบต่อได้ทันที */
          var cjInsertedRow = insertedCJ;
        }

        /* อัปเดตแผนที่ทันที ไม่รอโหลดทั้งตาราง */
        const fastCJId =
          ctx.baseEditId != null
            ? ctx.baseEditId
            : (typeof cjInsertedRow !== "undefined" && cjInsertedRow
                ? cjInsertedRow.id
                : ("local_" + Date.now()));

        fastRefreshCJ({
          id: fastCJId,
          code,
          name,
          description,
          address,
          lat: ll.lat,
          lng: ll.lng,
          is_custom: ctx.rec ? !!ctx.rec.is_custom : true
        });

        closeCJModal();
        toast("บันทึก CJ MORE แล้ว");

        /* โหลดข้อมูลจริงจาก Supabase แบบ background */
        scheduleCompetitorReload(700);

      } catch (err) {

        console.error(
          "CJ MORE save error:",
          err
        );

        toast(
          "บันทึก CJ MORE ไม่สำเร็จ"
        );
      }
    };
}


/* ---------- DELETE CJ MORE ---------- */

if ($("cjDelete")) {

  $("cjDelete").onclick =
    async () => {

      const ctx =
        S.editingCJ || {};

      if (!ctx.rec) return;

      if (!ctx.isCustomEdit) {

        return toast(
          "จุดข้อมูลหลัก CJ MORE ลบจากปุ่มนี้ไม่ได้"
        );
      }

      if (!S.sb) {

        return toast(
          "ยังไม่ได้เชื่อมต่อ Supabase"
        );
      }

      try {

        const { error } =
          await S.sb
            .from("CJMore")
            .delete()
            .eq(
              "id",
              ctx.rec.id
            );

        if (error) {
          throw error;
        }

        /* ลบจากแผนที่ทันที */
        fastDeleteCJ(ctx.rec.id);

        closeCJModal();
        toast("ลบจุด CJ MORE แล้ว");

        /* sync กลับจาก Supabase แบบ background */
        scheduleCompetitorReload(700);

      } catch (err) {

        console.error(
          "CJ MORE delete error:",
          err
        );

        toast(
          "ลบ CJ MORE ไม่สำเร็จ"
        );
      }
    };
}
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

  /* สร้างปุ่มย้ายตำแหน่งให้เอง หาก HTML เดิมยังไม่มี */
  const deleteBtn = $("cjDelete");
  if (deleteBtn && !$("cjMovePin")) {
    const moveBtn = document.createElement("button");
    moveBtn.type = "button";
    moveBtn.id = "cjMovePin";
    moveBtn.className = deleteBtn.className;
    moveBtn.textContent = "📍 ย้ายตำแหน่ง";
    deleteBtn.parentNode?.insertBefore(moveBtn, deleteBtn);
  }
  if ($("cjMovePin")) {
    $("cjMovePin").classList.toggle("hidden", !rec);
    $("cjMovePin").onclick = () => startCompetitorMove("cj", rec);
  }

  $("cjModal")?.classList.remove("hidden");
}
function closeCJModal() { $("cjModal")?.classList.add("hidden"); }
if ($("cjClose")) $("cjClose").onclick = closeCJModal;
if ($("cjCancel")) $("cjCancel").onclick = closeCJModal;
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
    return L.divIcon({ className: "", html: `<div style="width:25px;height:25px;border-radius:50%;border:2px solid ${c};background:#fff;box-shadow:0 2px 6px #0006;overflow:hidden;box-sizing:border-box"><img src="${iconImg}" style="width:100%;height:100%;display:block;object-fit:contain"></div>`, iconSize: [25, 25], iconAnchor: [12.5, 22] });
  }
  if (PIN_LOGOS[icon]) {
    const html = `<div style="width:25px;height:25px;border-radius:6px;border:2px solid ${c};background:#fff;box-shadow:0 2px 6px #0006;display:flex;align-items:center;justify-content:center;box-sizing:border-box;overflow:hidden"><img src="${PIN_LOGOS[icon]}" alt="" draggable="false" style="width:21px;height:21px;display:block;object-fit:contain"></div>`;
    return L.divIcon({ className: "", html, iconSize: [25, 25], iconAnchor: [12.5, 22] });
  }
  const html = `<div style="width:25px;height:25px;border-radius:50%;border:2px solid ${c};background:#fff;box-shadow:0 2px 6px #0006;display:flex;align-items:center;justify-content:center;box-sizing:border-box"><span style="font-size:14px;line-height:1">${ICONS[icon] || "📍"}</span></div>`;
  return L.divIcon({ className: "", html, iconSize: [25, 25], iconAnchor: [12.5, 22] });
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
  return m;
}

map.getContainer().addEventListener("click", e => {
  const btn = e.target.closest(".pinEditBtn");
  if (!btn) return;
  const p = S.all.find(x => String(x.id) === btn.dataset.id);
  if (p) openModal(p);
});

function rebuild() {
  cluster.clearLayers(); S.markers.clear();
  if ($("pinCount")) $("pinCount").textContent = S.all.length.toLocaleString("th-TH");
  pinmapApplyPointCap();
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
    b.type = "button"; b.className = "swatch"; b.dataset.color = c;
    b.innerHTML = `<span class="swatchPin" style="background:${c};border-color:${c}"></span>`;
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
      let savedPin = null;
      if (S.editing) {
        const { data, error } = await S.sb
          .from("pins")
          .update(payload)
          .eq("id", S.editing.id)
          .select(PIN_SELECT)
          .single();
        if (error) throw error;
        savedPin = data;
      } else {
        const { data, error } = await S.sb
          .from("pins")
          .insert(payload)
          .select(PIN_SELECT)
          .single();
        if (error) throw error;
        savedPin = data;
      }
      if (savedPin) pinmapUpsertLocal(savedPin);
      closeModal();
      if (coordinateSearchMarker) {
        map.removeLayer(coordinateSearchMarker);
        coordinateSearchMarker = null;
      }
      toast("บันทึกจุดแล้ว");
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
      const deletedId = S.editing.id;
      const { error } = await S.sb.from("pins").delete().eq("id", deletedId);
      if (error) throw error;
      pinmapDeleteLocal(deletedId);
      closeModal();
      toast("ลบจุดแล้ว");
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

/* =========================================================
   COMPETITOR MOVE MODE
   ========================================================= */

let competitorMoveMode = null;


function startCompetitorMove(
  type,
  rec
) {

  if (!rec) return;

  competitorMoveMode = {
    type,
    rec
  };

  closeS11Modal();
  closeCJModal();

  if ($("mode")) {
    $("mode").classList.remove(
      "hidden"
    );
  }

  if ($("modeText")) {

    $("modeText").textContent =
      type === "s11"
        ? "📍 คลิกตำแหน่งใหม่ของ 7-Eleven"
        : "📍 คลิกตำแหน่งใหม่ของ CJ MORE";
  }

  toast(
    "คลิกตำแหน่งใหม่บนแผนที่"
  );
}
map.on("click", async e => {

  /* =====================================================
     MOVE 7-ELEVEN / CJ MORE
     ===================================================== */

  if (competitorMoveMode) {

    const {
      type,
      rec
    } = competitorMoveMode;

    competitorMoveMode = null;

    if ($("mode")) {
      $("mode").classList.add(
        "hidden"
      );
    }

    try {

      if (!S.sb) {
        throw new Error(
          "Supabase not connected"
        );
      }

      if (!rec) {
        throw new Error(
          "Record not found"
        );
      }


      /* =========================
         7-ELEVEN
         ========================= */

      if (type === "s11") {

        const { error } =
          await S.sb
            .from("7-11")
            .update({
              latitude:
                e.latlng.lat,

              longitude:
                e.latlng.lng
            })
            .eq(
              "id",
              String(rec.id)
            );

        if (error) {
          throw error;
        }

        /* ขยับบนแผนที่ทันที */
        rec.y = e.latlng.lat;
        rec.x = e.latlng.lng;
        fastRefreshS11(rec);
        toast("ย้ายจุด 7-Eleven แล้ว");
        scheduleCompetitorReload(700);
      }


      /* =========================
         CJ MORE
         ========================= */

      else if (type === "cj") {

        const { error } =
          await S.sb
            .from("CJMore")
            .update({
              lat:
                e.latlng.lat,

              long:
                e.latlng.lng
            })
            .eq(
              "id",
              rec.id
            );

        if (error) {
          throw error;
        }

        /* ขยับบนแผนที่ทันที */
        rec.lat = e.latlng.lat;
        rec.lng = e.latlng.lng;
        fastRefreshCJ(rec);
        toast("ย้ายจุด CJ MORE แล้ว");
        scheduleCompetitorReload(700);
      }

    } catch (err) {

      console.error(
        "Competitor move error:",
        err
      );

      toast(
        "ย้ายตำแหน่งไม่สำเร็จ"
      );
    }

    return;
  }


  /* =====================================================
     โค้ด map.on("click") เดิมของคุณ
     ===================================================== */

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
  const { data, error } = await S.sb.from("saved_rooms").select("id,user_id,room,label,created_at").order("created_at", { ascending: false });
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
const PIN_SELECT = "id,room,lat,lng,title,address,note,created_by,created_by_user_id,color,icon,icon_img,created_at";

function pinmapCacheKey(room) {
  return `pinmap-pins:${String(room || "")}`;
}

function pinmapReadCache(room) {
  if (!room) return null;
  try {
    const raw = localStorage.getItem(pinmapCacheKey(room));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.pins) ? parsed : null;
  } catch {
    return null;
  }
}

function pinmapWriteCache(room, pins) {
  if (!room) return;
  try {
    localStorage.setItem(pinmapCacheKey(room), JSON.stringify({
      version: 1,
      synced_at: Date.now(),
      pins: Array.isArray(pins) ? pins : []
    }));
  } catch (err) {
    console.warn("[Pin cache] write failed:", err);
  }
}

function pinmapSetLocalPins(pins) {
  S.all = Array.isArray(pins) ? pins : [];
  rebuild();
}

function pinmapUpsertLocal(pin) {
  if (!pin?.id) return;
  const idx = S.all.findIndex(x => String(x.id) === String(pin.id));
  if (idx >= 0) S.all[idx] = { ...S.all[idx], ...pin };
  else S.all.push(pin);
  S.all.sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));
  pinmapWriteCache(S.room, S.all);
  rebuild();
}

function pinmapDeleteLocal(id) {
  S.all = S.all.filter(x => String(x.id) !== String(id));
  pinmapWriteCache(S.room, S.all);
  rebuild();
}

async function pinmapSyncPinsDelta() {
  if (!S.sb || !S.room) return;

  const cached = pinmapReadCache(S.room);

  // First open for this room: one full load, then cache it.
  if (!cached) {
    const { data, error } = await S.sb
      .from("pins")
      .select(PIN_SELECT)
      .eq("room", S.room)
      .order("created_at", { ascending: true });

    if (error) { toast(error.message); return; }
    pinmapSetLocalPins(data || []);
    pinmapWriteCache(S.room, S.all);
    return;
  }

  // Cache-first: the map is already usable. Check only lightweight metadata.
  const { data: remoteMeta, error: metaError } = await S.sb
    .from("pins")
    .select("id,created_at")
    .eq("room", S.room);

  if (metaError) {
    console.warn("[Pin sync] metadata check failed:", metaError);
    return;
  }

  const localById = new Map(S.all.map(p => [String(p.id), p]));
  const remoteById = new Map((remoteMeta || []).map(p => [String(p.id), p]));
  const idsToFetch = [];

  for (const [id, remote] of remoteById) {
    const local = localById.get(id);
    if (!local || String(local.created_at || "") !== String(remote.created_at || "")) {
      idsToFetch.push(id);
    }
  }

  const idsToDelete = [];
  for (const id of localById.keys()) {
    if (!remoteById.has(id)) idsToDelete.push(id);
  }

  if (idsToDelete.length) {
    S.all = S.all.filter(p => !idsToDelete.includes(String(p.id)));
  }

  if (idsToFetch.length) {
    const { data, error } = await S.sb
      .from("pins")
      .select(PIN_SELECT)
      .in("id", idsToFetch);

    if (error) {
      console.warn("[Pin sync] delta fetch failed:", error);
      return;
    }
    const fetched = data || [];
    const byId = new Map(S.all.map(p => [String(p.id), p]));
    fetched.forEach(p => byId.set(String(p.id), p));
    S.all = Array.from(byId.values()).sort((a, b) =>
      String(a.created_at || "").localeCompare(String(b.created_at || ""))
    );
  }

  pinmapWriteCache(S.room, S.all);
  rebuild();
}

async function loadPins() {
  if (!S.sb || !S.room) return;

  const cached = pinmapReadCache(S.room);
  if (cached) {
    pinmapSetLocalPins(cached.pins);
  }

  await pinmapSyncPinsDelta();
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
    .on("postgres_changes", { event: "*", schema: "public", table: "pins", filter: `room=eq.${S.room}` }, payload => {
      if (payload.eventType === "DELETE") {
        pinmapDeleteLocal(payload.old?.id);
        return;
      }
      if (payload.new) {
        pinmapUpsertLocal(payload.new);
      }
    })
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
      b.onclick = () => {
        document.querySelectorAll(".iconBtn").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        $("icon").value = key;
        $("imgUploadWrap").classList.add("hidden");
      };
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

  /* ── รวมปุ่ม KML + CSV เป็น input เดียว: "Import KML/CSV" ── */
  const importInput = document.createElement("input");
  importInput.type = "file";
  importInput.accept = ".kml,.csv,application/vnd.google-earth.kml+xml,text/xml,application/xml,text/csv";
  importInput.multiple = true;
  importInput.style.display = "none";
  document.body.appendChild(importInput);
  importInput.addEventListener("change", () => {
    const files = [...importInput.files];
    const kmlFiles = files.filter(f => /\.kml$/i.test(f.name));
    const csvFiles = files.filter(f => /\.csv$/i.test(f.name));
    if (kmlFiles.length) addKmlFiles(kmlFiles);
    if (csvFiles.length) openCsvModal(csvFiles);
    if (!kmlFiles.length && !csvFiles.length) toast("รองรับเฉพาะไฟล์ .kml และ .csv เท่านั้น");
    importInput.value = "";
  });
  function addImport(){ importInput.click(); }

  function kmlCoords(node){
    const text = (node?.textContent || "").trim();
    return text.split(/\s+/).map(x => {
      const p=x.split(",");
      return p.length >= 2 ? [Number(p[1]), Number(p[0])] : null;
    }).filter(p => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
  }

  /* แปลงสี KML (aabbggrr hex) → CSS #rrggbb */
  function kmlColorToHex(kmlColor) {
    if (!kmlColor) return null;
    const c = kmlColor.trim().replace(/^#/, "");
    if (c.length === 8) {
      // KML: aabbggrr → CSS: rrggbb
      const r = c.slice(6, 8), g = c.slice(4, 6), b = c.slice(2, 4);
      return `#${r}${g}${b}`;
    }
    if (/^[0-9a-fA-F]{6}$/.test(c)) return `#${c}`;
    return null;
  }

  /* อ่านสีจาก <Style> ใน Placemark หรือ styleUrl → Document styles */
  function kmlExtractStyle(pm, xmlDoc) {
    // ลอง inline <Style> ก่อน
    let styleEl = pm.querySelector(":scope > Style");
    // ถ้าไม่มี ลอง styleUrl → ค้นหา <Style id="..."> ใน Document
    if (!styleEl) {
      const url = pm.querySelector(":scope > styleUrl")?.textContent?.trim();
      if (url) {
        const id = url.startsWith("#") ? url.slice(1) : url;
        // StyleMap: ดู <Pair key="normal"> ก่อน
        const styleMap = xmlDoc.querySelector(`StyleMap[id="${id}"]`);
        if (styleMap) {
          const normalUrl = [...styleMap.querySelectorAll("Pair")]
            .find(p => p.querySelector("key")?.textContent?.trim() === "normal")
            ?.querySelector("styleUrl")?.textContent?.trim();
          const nid = normalUrl?.startsWith("#") ? normalUrl.slice(1) : normalUrl;
          if (nid) styleEl = xmlDoc.querySelector(`Style[id="${nid}"]`);
        }
        if (!styleEl) styleEl = xmlDoc.querySelector(`Style[id="${id}"]`);
      }
    }
    if (!styleEl) return {};

    const lineColor = kmlColorToHex(styleEl.querySelector("LineStyle > color")?.textContent);
    const lineWidth = parseFloat(styleEl.querySelector("LineStyle > width")?.textContent) || null;
    const polyColor = kmlColorToHex(styleEl.querySelector("PolyStyle > color")?.textContent);
    const polyFill  = styleEl.querySelector("PolyStyle > fill")?.textContent?.trim();
    const polyOutline = styleEl.querySelector("PolyStyle > outline")?.textContent?.trim();
    // KML alpha ของ PolyStyle color: byte แรก (aa) ของ aabbggrr
    let fillOpacity = 0.35;
    const rawPoly = styleEl.querySelector("PolyStyle > color")?.textContent?.trim().replace(/^#/,"");
    if (rawPoly && rawPoly.length === 8) {
      fillOpacity = parseInt(rawPoly.slice(0,2), 16) / 255;
    }

    return { lineColor, lineWidth, polyColor, polyFill, polyOutline, fillOpacity };
  }

  function parseKmlPlacemark(pm, group, xmlDoc){
    const name = (pm.querySelector("name")?.textContent || "KML").trim();
    const description = (pm.querySelector("description")?.textContent || "").trim();
    const popup = `<b>${esc(name)}</b>${description ? `<br>${esc(description).slice(0,4000)}` : ""}`;
    const sty = kmlExtractStyle(pm, xmlDoc);

    const addGeom = geom => {
      if (!geom) return;
      const tag = geom.localName;
      if (tag === "Point") {
        const c = kmlCoords(geom.querySelector("coordinates"))[0];
        if (c) L.marker(c).bindPopup(popup).addTo(group);
      } else if (tag === "LineString") {
        const c = kmlCoords(geom.querySelector("coordinates"));
        if (c.length >= 2) L.polyline(c, {
          color: sty.lineColor || "#2563eb",
          weight: sty.lineWidth || 3,
          opacity: .9
        }).bindPopup(popup).addTo(group);
      } else if (tag === "Polygon") {
        const rings = [...geom.querySelectorAll(":scope > outerBoundaryIs > LinearRing, :scope > innerBoundaryIs > LinearRing")];
        const outer = rings[0] ? kmlCoords(rings[0].querySelector("coordinates")) : [];
        const holes = rings.slice(1).map(r => kmlCoords(r.querySelector("coordinates"))).filter(r => r.length >= 3);
        const strokeColor = sty.lineColor || sty.polyColor || "#2563eb";
        const fillColor   = sty.polyColor || sty.lineColor || "#2563eb";
        const noFill      = sty.polyFill === "0";
        const noStroke    = sty.polyOutline === "0";
        if (outer.length >= 3) L.polygon([outer, ...holes], {
          color:       noStroke ? "transparent" : strokeColor,
          weight:      sty.lineWidth || 2,
          fillColor:   fillColor,
          fillOpacity: noFill ? 0 : sty.fillOpacity,
          opacity:     .9
        }).bindPopup(popup).addTo(group);
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
        xml.querySelectorAll("Placemark").forEach(pm => parseKmlPlacemark(pm, group, xml));
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

  /* ── CSV IMPORT (เรียกผ่านปุ่ม "📥 Import KML/CSV" รวมกับ KML — ดู importInput ด้านบน) ── */
  const csvLayers = new Map();
  let csvSeq = 0;

  /* modal สำหรับตั้ง encoding / คอลัมน์ lat-lng / สี ก่อน plot */
  const CSV_ENCODINGS = [
    ["utf-8", "UTF-8 (มาตรฐานทั่วไป)"],
    ["windows-874", "Thai — Windows-874 / TIS-620"],
    ["windows-1252", "Windows-1252 (ยุโรปตะวันตก)"],
    ["iso-8859-1", "ISO-8859-1 (Latin-1)"],
    ["utf-16le", "UTF-16 LE"],
    ["utf-16be", "UTF-16 BE"],
    ["gbk", "GBK (จีนตัวย่อ)"],
    ["big5", "Big5 (จีนตัวเต็ม)"],
    ["shift-jis", "Shift-JIS (ญี่ปุ่น)"],
    ["euc-kr", "EUC-KR (เกาหลี)"]
  ];
  const csvModalHtml = `
  <div id="csvColorModal" class="overlay hidden">
    <div class="card" style="max-width:380px;gap:14px">
      <div class="cardhead"><h2 style="font-size:16px">ตั้งค่านำเข้า CSV</h2><button type="button" id="csvModalClose" style="background:#eee;border-radius:8px;width:32px;height:32px;font-size:18px">×</button></div>
      <div id="csvModalFileName" style="font-size:12px;color:#777"></div>

      <label style="font-size:12px;font-weight:700;color:#555;display:flex;flex-direction:column;gap:6px">รูปแบบตัวอักษร (encoding)
        <select id="csvEncoding" style="border:1px solid #ddd;border-radius:9px;padding:9px;font:inherit">
          ${CSV_ENCODINGS.map(([v,l]) => `<option value="${v}">${l}</option>`).join("")}
        </select>
        <small style="color:#999">ถ้าเห็นตัวอักษรเพี้ยน/เป็น ??? ในช่องคอลัมน์ด้านล่าง ลองเปลี่ยน encoding ตรงนี้</small>
      </label>

      <label style="font-size:12px;font-weight:700;color:#555;display:flex;flex-direction:column;gap:6px">คอลัมน์ละติจูด (Lat)
        <select id="csvLatCol" style="border:1px solid #ddd;border-radius:9px;padding:9px;font:inherit"></select>
      </label>
      <label style="font-size:12px;font-weight:700;color:#555;display:flex;flex-direction:column;gap:6px">คอลัมน์ลองจิจูด (Lng)
        <select id="csvLngCol" style="border:1px solid #ddd;border-radius:9px;padding:9px;font:inherit"></select>
      </label>
      <div id="csvColWarn" style="font-size:11px;color:#c22;display:none">⚠️ เลือกคอลัมน์ lat/lng ไม่ได้ ไฟล์นี้อาจไม่มีหัวตารางพิกัด</div>

      <label style="font-size:12px;font-weight:700;color:#555;display:flex;flex-direction:column;gap:6px">สีหมุด / เส้น
        <div style="display:flex;align-items:center;gap:10px">
          <input type="color" id="csvStrokeColor" value="#2563eb" style="width:40px;height:40px;border:none;border-radius:8px;cursor:pointer;padding:2px">
          <span style="font-size:12px;color:#888">สีขอบ / สีเส้น</span>
        </div>
      </label>
      <label style="font-size:12px;font-weight:700;color:#555;display:flex;flex-direction:column;gap:6px">สีพื้น (fill)
        <div style="display:flex;align-items:center;gap:10px">
          <input type="color" id="csvFillColor" value="#2563eb" style="width:40px;height:40px;border:none;border-radius:8px;cursor:pointer;padding:2px">
          <span style="font-size:12px;color:#888">สีพื้นใน polygon</span>
        </div>
      </label>
      <label style="font-size:12px;font-weight:700;color:#555;display:flex;flex-direction:column;gap:6px">ความโปร่งแสงพื้น (fill opacity)
        <div style="display:flex;align-items:center;gap:8px">
          <input type="range" id="csvFillOpacity" min="0" max="1" step="0.05" value="0.35" style="flex:1">
          <span id="csvFillOpacityVal" style="width:32px;font-size:12px;text-align:right">35%</span>
        </div>
      </label>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button type="button" id="csvModalCancel" style="background:#eee;border-radius:8px;padding:9px 16px;font-weight:700">ยกเลิก</button>
        <button type="button" id="csvModalOk" class="primary" style="border-radius:8px;padding:9px 18px;font-weight:700">เพิ่มลงแผนที่</button>
      </div>
    </div>
  </div>`;
  document.body.insertAdjacentHTML("beforeend", csvModalHtml);

  $("csvFillOpacity").addEventListener("input", () => {
    $("csvFillOpacityVal").textContent = Math.round($("csvFillOpacity").value * 100) + "%";
  });

  /* อ่านไฟล์ด้วย encoding ที่เลือก (รองรับ UTF-8 / Thai (windows-874,TIS-620) / ฯลฯ) */
  async function decodeFileText(file, encoding) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder(encoding || "utf-8").decode(buf); }
    catch (e) { return new TextDecoder("utf-8").decode(buf); } // เผื่อ browser ไม่รู้จัก encoding นั้น
  }

  const LAT_GUESS = ["lat","latitude","y","ละติจูด","lat_y"];
  const LNG_GUESS = ["lng","lon","longitude","long","x","ลองจิจูด","lng_x","lon_x"];

  function csvHeaders(text) {
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return [];
    const sep = lines[0].includes("\t") ? "\t" : ",";
    return lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g,"").toLowerCase());
  }

  /* parse CSV text → array of objects */
  function parseCsv(text) {
    const lines = text.trim().split(/\r?\n/);
    if (!lines.length) return [];
    const sep = lines[0].includes("\t") ? "\t" : ",";
    const headers = csvHeaders(text);
    return lines.slice(1).filter(l => l.trim()).map(line => {
      const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g,""));
      const obj = {};
      headers.forEach((h, i) => obj[h] = vals[i] ?? "");
      return obj;
    });
  }

  function csvLatLng(row, latCol, lngCol) {
    const latK = latCol || LAT_GUESS.find(k => row[k] !== undefined && row[k] !== "");
    const lngK = lngCol || LNG_GUESS.find(k => row[k] !== undefined && row[k] !== "");
    if (!latK || !lngK || row[latK] === undefined || row[lngK] === undefined) return null;
    const lat = parseFloat(row[latK]), lng = parseFloat(row[lngK]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  }

  let _csvPendingFiles = [];
  function fillColumnSelect(sel, headers, guessList) {
    sel.innerHTML = headers.map(h => `<option value="${esc(h)}">${esc(h)}</option>`).join("");
    const guess = guessList.find(g => headers.includes(g));
    if (guess) sel.value = guess;
  }
  async function refreshCsvPreview() {
    if (!_csvPendingFiles.length) return;
    const encoding = $("csvEncoding").value;
    const text = await decodeFileText(_csvPendingFiles[0], encoding);
    const headers = csvHeaders(text);
    $("csvColWarn").style.display = headers.length ? "none" : "block";
    fillColumnSelect($("csvLatCol"), headers, LAT_GUESS);
    fillColumnSelect($("csvLngCol"), headers, LNG_GUESS);
  }
  $("csvEncoding").addEventListener("change", refreshCsvPreview);

  function openCsvModal(files) {
    _csvPendingFiles = files;
    $("csvModalFileName").textContent = files.map(f => f.name).join(", ");
    $("csvEncoding").value = "utf-8";
    $("csvColorModal").classList.remove("hidden");
    refreshCsvPreview();
  }
  $("csvModalClose").onclick = $("csvModalCancel").onclick = () => {
    $("csvColorModal").classList.add("hidden"); _csvPendingFiles = [];
  };
  $("csvModalOk").onclick = () => {
    const stroke = $("csvStrokeColor").value;
    const fill   = $("csvFillColor").value;
    const opacity = parseFloat($("csvFillOpacity").value);
    const encoding = $("csvEncoding").value;
    const latCol = $("csvLatCol").value;
    const lngCol = $("csvLngCol").value;
    if (!latCol || !lngCol) { toast("กรุณาเลือกคอลัมน์ Lat และ Lng ก่อน"); return; }
    $("csvColorModal").classList.add("hidden");
    addCsvFiles(_csvPendingFiles, { stroke, fill, opacity, encoding, latCol, lngCol });
    _csvPendingFiles = [];
  };

  async function addCsvFiles(files, sty) {
    for (const file of files) {
      try {
        const text = await decodeFileText(file, sty.encoding);
        const rows = parseCsv(text);
        if (!rows.length) throw new Error("ไม่พบข้อมูลใน CSV");
        const group = L.featureGroup();
        let count = 0;
        for (const row of rows) {
          const ll = csvLatLng(row, sty.latCol, sty.lngCol);
          if (!ll) continue;
          /* popup: แสดงทุก field ยกเว้นคอลัมน์ lat/lng ที่เลือกไว้ */
          const popupRows = Object.entries(row)
            .filter(([k]) => k !== sty.latCol && k !== sty.lngCol && row[k])
            .map(([k,v]) => `<tr><td style="color:#888;padding-right:8px;white-space:nowrap">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");
          const popup = `<table style="font-size:12px;border-collapse:collapse">${popupRows || "<tr><td>—</td></tr>"}</table>`;
          L.circleMarker(ll, {
            radius: 7,
            color: sty.stroke, weight: 2,
            fillColor: sty.fill, fillOpacity: sty.opacity
          }).bindPopup(popup).addTo(group);
          count++;
        }
        if (!count) throw new Error("ไม่พบแถวที่มีพิกัดถูกต้องในคอลัมน์ที่เลือก — ลองเปลี่ยน encoding หรือเลือกคอลัมน์ lat/lng ใหม่");
        group.addTo(map);
        const id = `csv_${++csvSeq}`;
        csvLayers.set(id, { id, name: file.name, layer: group });
        renderKmlPanel();
        toast(`เพิ่ม CSV: ${file.name} (${count} จุด)`);
      } catch(err) {
        console.error(err); toast(`อ่าน CSV ไม่สำเร็จ: ${file.name} — ${err.message}`);
      }
    }
  }


  const sidebarBody = $("sidebarBody");
  const mobileMenuBody = document.querySelector(".mobileMenuBody");
  function makeButton(id, text, cls="item"){
    const b=document.createElement("button"); b.id=id; b.type="button"; b.className=`${cls} pinmap-${id}`; b.textContent=text; return b;
  }
  let roadBtn=null, importBtn=null, mRoadBtn=null, mImportBtn=null;
  if (sidebarBody) {
    const anchor = $("dolToggle") || $("locate");
    roadBtn = makeButton("roadToggle", "🛣️ ถนน Primary / Secondary");
    importBtn = makeButton("importAdd", "📥 Import KML/CSV");
    roadBtn.classList.add("pinmap-road-item");
    importBtn.classList.add("pinmap-kml-item");
    anchor?.parentNode.insertBefore(roadBtn, anchor.nextSibling);
    roadBtn.parentNode.insertBefore(importBtn, roadBtn.nextSibling);
    roadBtn.onclick=toggleRoads; importBtn.onclick=addImport;
  }
  if (mobileMenuBody) {
    const anchor = $("mDolBtn") || $("mBoundaryToggle");
    mRoadBtn = makeButton("mRoadToggle", "🛣️ ถนน Primary / Secondary");
    mImportBtn = makeButton("mImportAdd", "📥 Import KML/CSV");
    mRoadBtn.classList.add("pinmap-road-item");
    mImportBtn.classList.add("pinmap-kml-item");
    anchor?.parentNode.insertBefore(mRoadBtn, anchor.nextSibling);
    mRoadBtn.parentNode.insertBefore(mImportBtn, mRoadBtn.nextSibling);
    mRoadBtn.onclick=toggleRoads; mImportBtn.onclick=addImport;
  }
  function renderKmlPanel(){
    let panel=$("pinmapKmlPanel");
    if(!panel){
      panel=document.createElement("div"); panel.id="pinmapKmlPanel"; panel.className="pinmap-kml-panel";
      const target=importBtn?.parentNode || sidebarBody;
      if(target && importBtn) target.insertBefore(panel, importBtn.nextSibling); else sidebarBody?.appendChild(panel);
    }
    panel.innerHTML="";
    const allLayers = [
      ...[...kmlLayers.values()].map(x=>({...x, prefix:"KML"})),
      ...[...csvLayers.values()].map(x=>({...x, prefix:"CSV"}))
    ];
    allLayers.forEach(item=>{
      const row=document.createElement("div"); row.className="pinmap-kml-row";
      const toggle=document.createElement("button"); toggle.type="button"; toggle.className="item";
      toggle.textContent=`${item.prefix}: ${item.name}`;
      toggle.classList.toggle("active", map.hasLayer(item.layer));
      toggle.onclick=()=>{
        if(map.hasLayer(item.layer)){map.removeLayer(item.layer);toggle.classList.remove("active");}
        else{item.layer.addTo(map);toggle.classList.add("active");}
      };
      const remove=document.createElement("button"); remove.type="button"; remove.className="item pinmap-kml-remove"; remove.textContent="×"; remove.title="ลบออกจากแผนที่";
      remove.onclick=()=>{
        map.removeLayer(item.layer);
        if(item.prefix==="KML") kmlLayers.delete(item.id); else csvLayers.delete(item.id);
        renderKmlPanel();
      };
      row.append(toggle,remove); panel.appendChild(row);
    });
  }
})();


/* =========================================================
   LOAD 7-ELEVEN + CJ MORE FROM SUPABASE
   ========================================================= */

async function supabaseGetAll(tableName) {

  if (!S.sb) return [];

  const all = [];

  const pageSize = 1000;

  for (
    let from = 0;
    ;
    from += pageSize
  ) {

    const {
      data,
      error
    } =
      await S.sb
        .from(tableName)
        .select("*")
        .range(
          from,
          from + pageSize - 1
        );

    if (error) {
      throw error;
    }

    if (data?.length) {
      all.push(...data);
    }

    if (
      !data ||
      data.length < pageSize
    ) {
      break;
    }
  }

  return all;
}


async function loadCompetitorDataFromSupabase() {
  if (!S.sb) return;

  try {
    /* Static master data stays in browser files.
       Supabase is queried only for user-added custom points. */

    const sevenBase = Array.isArray(window.SEVEN11_DATA) ? window.SEVEN11_DATA : [];
    const { data: sevenCustomRows, error: sevenError } = await S.sb
      .from("7-11")
      .select("id,name_th,name_en,address_th,address_en,latitude,longitude,telephone,website,note,color,is_custom")
      .eq("is_custom", true);

    if (sevenError) throw sevenError;

    const sevenMap = new Map();
    sevenBase.forEach((row, index) => {
      const id = String(row.id ?? `static_${index}`);
      sevenMap.set(id, {
        ...row,
        id: row.id ?? id,
        n: row.n || row.name_th || row.name_en || "7-Eleven",
        a: row.a || row.address_th || row.address_en || "",
        note: row.note || "",
        color: row.color || "green",
        y: Number(row.y ?? row.lat ?? row.latitude),
        x: Number(row.x ?? row.lng ?? row.longitude),
        telephone: row.telephone || "",
        website: row.website || "",
        is_custom: false
      });
    });

    (sevenCustomRows || []).forEach(row => {
      const rec = {
        id: row.id,
        n: row.name_th || row.name_en || "7-Eleven",
        a: row.address_th || row.address_en || "",
        note: row.note || "",
        color: row.color || "green",
        y: Number(row.latitude),
        x: Number(row.longitude),
        telephone: row.telephone || "",
        website: row.website || "",
        is_custom: true
      };
      if (Number.isFinite(rec.y) && Number.isFinite(rec.x)) sevenMap.set(String(rec.id), rec);
    });

    window.SEVEN11_DATA = Array.from(sevenMap.values()).filter(row =>
      Number.isFinite(Number(row.y)) && Number.isFinite(Number(row.x))
    );

    const cjBase = Array.isArray(window.CJMORE_DATA) ? window.CJMORE_DATA : [];
    const { data: cjCustomRows, error: cjError } = await S.sb
      .from("CJMore")
      .select("id,code,name,address,tel,description,lat,long,is_custom")
      .eq("is_custom", true);

    if (cjError) throw cjError;

    const cjMap = new Map();
    cjBase.forEach((row, index) => {
      const id = String(row.id ?? row.code ?? `static_${index}`);
      cjMap.set(id, {
        ...row,
        id: row.id ?? id,
        code: row.code || "",
        name: row.name || "CJ MORE",
        address: row.address || "",
        tel: row.tel || "",
        description: row.description || "",
        lat: Number(row.lat),
        lng: Number(row.lng ?? row.long),
        is_custom: false
      });
    });

    (cjCustomRows || []).forEach(row => {
      const rec = {
        id: row.id,
        code: row.code || "",
        name: row.name || "CJ MORE",
        address: row.address || "",
        tel: row.tel || "",
        description: row.description || "",
        lat: Number(row.lat),
        lng: Number(row.long),
        is_custom: true
      };
      if (Number.isFinite(rec.lat) && Number.isFinite(rec.lng)) cjMap.set(String(rec.id), rec);
    });

    window.CJMORE_DATA = Array.from(cjMap.values()).filter(row =>
      Number.isFinite(Number(row.lat)) && Number.isFinite(Number(row.lng))
    );

    S11.all = [];
    CJ.all = [];
    s11Update();
    cjUpdate();
  } catch (err) {
    console.error("Competitor Supabase load error:", err);
    toast("โหลดข้อมูลจุดเพิ่มเติมไม่สำเร็จ");
  }
}
/* =========================================================
   COMPETITOR FAST UI REFRESH
   - Update the visible map immediately after CRUD.
   - Supabase reload happens in the background.
   - Realtime events are debounced to avoid duplicate full reloads.
   ========================================================= */

// Competitor master data is static. Do not reload entire tables after CRUD/realtime.
function scheduleCompetitorReload() {
  return;
}

function fastRefreshS11(rec) {
  if (!rec) return;
  const id = String(rec.id ?? "");

  const next = {
    id: rec.id,
    n: rec.n ?? rec.name_th ?? rec.name ?? "7-Eleven",
    a: rec.a ?? rec.address_th ?? rec.address ?? "",
    note: rec.note ?? "",
    color: rec.color ?? "green",
    y: Number(rec.y ?? rec.latitude),
    x: Number(rec.x ?? rec.longitude),
    telephone: rec.telephone ?? "",
    website: rec.website ?? "",
    is_custom: rec.is_custom === true
  };

  const idx = (window.SEVEN11_DATA || []).findIndex(x => String(x.id ?? "") === id);
  if (idx >= 0) {
    window.SEVEN11_DATA[idx] = next;
  } else {
    window.SEVEN11_DATA = [...(window.SEVEN11_DATA || []), next];
  }

  s11Update();
}

function fastDeleteS11(id) {
  const key = String(id ?? "");
  window.SEVEN11_DATA = (window.SEVEN11_DATA || [])
    .filter(x => String(x.id ?? "") !== key);
  s11Update();
}

function fastRefreshCJ(rec) {
  if (!rec) return;
  const id = String(rec.id ?? "");

  const next = {
    id: rec.id,
    code: rec.code ?? "",
    name: rec.name ?? "CJ MORE",
    address: rec.address ?? "",
    tel: rec.tel ?? "",
    description: rec.description ?? "",
    lat: Number(rec.lat),
    lng: Number(rec.lng ?? rec.long),
    is_custom: rec.is_custom === true
  };

  const idx = (window.CJMORE_DATA || []).findIndex(x => String(x.id ?? "") === id);
  if (idx >= 0) {
    window.CJMORE_DATA[idx] = next;
  } else {
    window.CJMORE_DATA = [...(window.CJMORE_DATA || []), next];
  }

  cjUpdate();
}

function fastDeleteCJ(id) {
  const key = String(id ?? "");
  window.CJMORE_DATA = (window.CJMORE_DATA || [])
    .filter(x => String(x.id ?? "") !== key);
  cjUpdate();
}

/* =========================================================
   REALTIME : 7-ELEVEN + CJ MORE
   ========================================================= */

let competitorRealtimeChannel = null;

function startCompetitorRealtime() {
  if (!S.sb) return;

  if (competitorRealtimeChannel) {
    try { S.sb.removeChannel(competitorRealtimeChannel); } catch (e) {}
    competitorRealtimeChannel = null;
  }

  competitorRealtimeChannel = S.sb
    .channel("pinmap-competitor-realtime")
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "7-11"
    }, payload => {
      if (payload.eventType === "DELETE") {
        fastDeleteS11(payload.old?.id);
        return;
      }
      const row = payload.new;
      if (!row || row.is_custom !== true) return;
      fastRefreshS11({
        id: row.id,
        n: row.name_th || row.name_en || "7-Eleven",
        a: row.address_th || row.address_en || "",
        note: row.note || "",
        color: row.color || "green",
        y: Number(row.latitude),
        x: Number(row.longitude),
        telephone: row.telephone || "",
        website: row.website || "",
        is_custom: true
      });
    })
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "CJMore"
    }, payload => {
      if (payload.eventType === "DELETE") {
        fastDeleteCJ(payload.old?.id);
        return;
      }
      const row = payload.new;
      if (!row || row.is_custom !== true) return;
      fastRefreshCJ({
        id: row.id,
        code: row.code || "",
        name: row.name || "CJ MORE",
        address: row.address || "",
        tel: row.tel || "",
        description: row.description || "",
        lat: Number(row.lat),
        lng: Number(row.long),
        is_custom: true
      });
    })
    .subscribe(status => {
      console.log("[Realtime] Competitor:", status);
    });
}

/* ── INIT ── */
function onAuthReady() {
  refreshUserUI();
  loadSavedRooms();
}


// Render at most 300 points on screen, with priority: user pins -> 7-Eleven -> CJ MORE.
// When a layer has more candidates than the remaining slots, prefer points nearest the screen center.
const PINMAP_MAX_VISIBLE_POINTS = 300;
function pinmapSearchText() {
  return (($("search") ? $("search").value : "") || ($("mSearchInput") ? $("mSearchInput").value : "")).toLowerCase().trim();
}
function pinmapDistanceToCenter(lat, lng, center) {
  const dy = Number(lat) - center.lat;
  const dx = (Number(lng) - center.lng) * Math.cos(center.lat * Math.PI / 180);
  return dx * dx + dy * dy;
}
function pinmapApplyPointCap() {
  const bounds = pinmapVisibleBounds();
  const center = map.getCenter();
  const q = pinmapSearchText();
  const max = PINMAP_MAX_VISIBLE_POINTS;

  const pinList = S.all.filter(p =>
    pinmapInViewport(p.lat, p.lng, bounds) &&
    (!q || (p.title + " " + (p.address || "") + " " + (p.note || "")).toLowerCase().includes(q))
  );
  const s11List = S11.all.filter(x =>
    S11.on && pinmapInViewport(x.rec.y, x.rec.x, bounds) &&
    (!q || (String(x.rec.n || "") + " " + String(x.rec.a || "")).toLowerCase().includes(q))
  );
  const cjList = CJ.all.filter(x =>
    CJ.on && pinmapInViewport(x.rec.lat, x.rec.lng, bounds) &&
    (!q || (cjDisplayName(x.rec) + " " + (x.rec.address || "") + " " + (x.rec.description || "")).toLowerCase().includes(q))
  );

  const byCenter = (a, b) => a._pinmapDistance - b._pinmapDistance;
  pinList.forEach(p => p._pinmapDistance = pinmapDistanceToCenter(p.lat, p.lng, center));
  s11List.forEach(x => x._pinmapDistance = pinmapDistanceToCenter(x.rec.y, x.rec.x, center));
  cjList.forEach(x => x._pinmapDistance = pinmapDistanceToCenter(x.rec.lat, x.rec.lng, center));
  pinList.sort(byCenter);
  s11List.sort(byCenter);
  cjList.sort(byCenter);

  const selectedPins = pinList.slice(0, max);
  let remaining = Math.max(0, max - selectedPins.length);
  const selectedS11 = s11List.slice(0, remaining);
  remaining -= selectedS11.length;
  const selectedCJ = cjList.slice(0, remaining);

  const selectedPinIds = new Set(selectedPins.map(p => String(p.id)));
  const selectedS11Set = new Set(selectedS11);
  const selectedCJSet = new Set(selectedCJ);

  // Remove everything not selected, but keep marker objects cached for reuse.
  cluster.eachLayer(layer => {
    const id = [...S.markers.entries()].find(([, m]) => m === layer)?.[0];
    if (id === undefined || !selectedPinIds.has(String(id))) cluster.removeLayer(layer);
  });
  s11Cluster.eachLayer(layer => {
    const owner = S11.all.find(x => x.m === layer);
    if (!owner || !selectedS11Set.has(owner)) s11Cluster.removeLayer(layer);
  });
  cjCluster.eachLayer(layer => {
    const owner = CJ.all.find(x => x.m === layer);
    if (!owner || !selectedCJSet.has(owner)) cjCluster.removeLayer(layer);
  });

  selectedPins.forEach(p => {
    const m = S.markers.get(p.id) || marker(p);
    if (!cluster.hasLayer(m)) cluster.addLayer(m);
  });
  selectedS11.forEach(x => {
    if (!s11Cluster.hasLayer(s11EnsureMarker(x))) s11Cluster.addLayer(s11EnsureMarker(x));
  });
  selectedCJ.forEach(x => {
    if (!cjCluster.hasLayer(cjEnsureMarker(x))) cjCluster.addLayer(cjEnsureMarker(x));
  });

  if (selectedS11.length && !map.hasLayer(s11Cluster)) s11Cluster.addTo(map);
  if (!selectedS11.length && map.hasLayer(s11Cluster)) map.removeLayer(s11Cluster);
  if (selectedCJ.length && !map.hasLayer(cjCluster)) cjCluster.addTo(map);
  if (!selectedCJ.length && map.hasLayer(cjCluster)) map.removeLayer(cjCluster);
}

let pinmapViewportTimer = null;
function pinmapRefreshViewport() {
  clearTimeout(pinmapViewportTimer);
  pinmapViewportTimer = setTimeout(pinmapApplyPointCap, 80);
}
map.on("moveend zoomend", pinmapRefreshViewport);

async function init() {
  if (dbConfigured() && window.supabase) {
    try {
      S.sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        }
      });
      // Restore the saved login session FIRST so the UI can unlock immediately.
      const { data } = await S.sb.auth.getSession();
      S.session = data.session;
      S.sb.auth.onAuthStateChange((event, session) => {
        S.session = session;
        onAuthReady();
        if (event === "PASSWORD_RECOVERY") {
          setTimeout(() => openResetModal(true), 0);
        }
      });

      // Load competitor data in the background; do not block login/UI startup.
      void loadCompetitorDataFromSupabase();
      startCompetitorRealtime();
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
