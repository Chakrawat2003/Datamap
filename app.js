
(function(){
  const st=document.createElement("style");
  st.id="pinmapCompactModalAndDashboardLayerFix";
  st.textContent=`
/* Pin modal compact/responsive fix */
#modal{
  padding:12px !important;
  align-items:center !important;
  justify-content:center !important;
  overflow:auto !important;
}
#modal .card{
  width:min(460px, calc(100vw - 24px)) !important;
  max-width:460px !important;
  max-height:calc(100dvh - 24px) !important;
  overflow-y:auto !important;
  overscroll-behavior:contain;
  padding:15px !important;
  border-radius:16px !important;
}
#modal .cardhead{
  margin-bottom:8px !important;
}
#modal .card input,
#modal .card select,
#modal .card textarea{
  font-size:13px !important;
}
#modal .card textarea{
  min-height:58px !important;
  max-height:90px !important;
}
#modal .iconRow{
  margin-top:3px !important;
  gap:5px !important;
}
#modal .iconRow .logoIconBtn{
  width:58px !important;
  min-width:58px !important;
  height:70px !important;
  padding:5px 3px 4px !important;
}
#modal .pinLogoVisual{
  width:36px !important;
  height:36px !important;
  flex-basis:36px !important;
}
#modal .pinLogoVisual img{
  width:33px !important;
  height:33px !important;
  max-width:33px !important;
  max-height:33px !important;
}
#modal .pinLogoLabel{
  font-size:9.5px !important;
}
/* selected logo must be obvious while choosing */
#modal .iconRow .logoIconBtn.active{
  background:#dbeafe !important;
  border-color:#2563eb !important;
  box-shadow:0 0 0 2px rgba(37,99,235,.18) !important;
  color:#1d4ed8 !important;
}
#modal .iconRow .logoIconBtn.active .pinLogoLabel{
  color:#1d4ed8 !important;
}
@media(max-width:767px){
  #modal{padding:7px !important;}
  #modal .card{
    width:calc(100vw - 14px) !important;
    max-width:none !important;
    max-height:calc(100dvh - 14px) !important;
    padding:12px !important;
    border-radius:14px !important;
  }
  #modal .iconRow .logoIconBtn{
    width:54px !important;
    min-width:54px !important;
    height:66px !important;
  }
  #modal .pinLogoVisual{
    width:33px !important;
    height:33px !important;
    flex-basis:33px !important;
  }
  #modal .pinLogoVisual img{
    width:30px !important;
    height:30px !important;
    max-width:30px !important;
    max-height:30px !important;
  }
  #modal .pinLogoLabel{font-size:9px !important;}
}
`;
  document.head.appendChild(st);
})();


(function(){
  const st=document.createElement("style");
  st.textContent=`
    #pinModal .modalBox, #pinModal .modal-content, #pinModal .dialog{
      overflow:visible;
    }
    #pinModal .iconRow{
      margin-top:4px;
    }
  `;
  document.head.appendChild(st);
})();


/* OpenFreeMap dependencies for the alternate basemap.
   Loaded synchronously here so the existing index.html does not need editing. */
if (!window.maplibregl || !L.maplibreGL) {
  document.write('<link href="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.css" rel="stylesheet">');
  document.write('<script src="https://unpkg.com/maplibre-gl@5/dist/maplibre-gl.js"><\/script>');
  document.write('<script src="https://unpkg.com/@maplibre/maplibre-gl-leaflet/leaflet-maplibre-gl.js"><\/script>');
}


(function pinmapCompactDesktopUI(){
  const st = document.createElement("style");
  st.id = "pinmapCompactDesktopUI";
  st.textContent = `
@media (min-width: 769px) {
  .topbar, .top-bar, header, .app-header {
    min-height: 50px !important;
  }
  .topbar button, .top-bar button, header button, .app-header button,
  .topbar input, .top-bar input, header input, .app-header input,
  #pinmapMembersBtn, #pinmapNotifyBtn,
  #leaveTeamBtn {
    min-height: 34px !important;
    height: 34px !important;
    padding: 5px 9px !important;
    font-size: 12px !important;
    line-height: 1.05 !important;
    border-radius: 8px !important;
    white-space: nowrap !important;
  }
  #pinmapMembersBtn, #pinmapNotifyBtn, #leaveTeamBtn {
    min-width: 0 !important;
    width: auto !important;
  }
  #pinmapMembersBtn span, #pinmapNotifyBtn span {
    display: inline !important;
    white-space: nowrap !important;
  }
  .brand, .app-title, .logo-title {
    font-size: 18px !important;
  }
  .sidebar, #sidebar, .left-panel, .menu-panel {
    font-size: 13px !important;
  }
  .sidebar button, #sidebar button, .left-panel button, .menu-panel button,
  .sidebar .menu-item, #sidebar .menu-item, .left-panel .menu-item, .menu-panel .menu-item {
    min-height: 42px !important;
    padding-top: 7px !important;
    padding-bottom: 7px !important;
    font-size: 13px !important;
  }
}
`;
  document.head.appendChild(st);
})();

const C = window.APP_CONFIG || {};
const $ = id => document.getElementById(id);
const dbConfigured = () => C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !C.SUPABASE_URL.includes("YOUR_");

const S = {
  sb: null, ch: null, notifyCh: null, session: null, room: "", passcode: "",
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

// HARD FIX: keep Chrome/Password Manager from treating map search as a login field.
function pinmapDisableSearchAutofill() {
  // Associate search inputs with their own dummy form, not with the room/login controls.
  let dummyForm = document.getElementById("pinmapSearchOnlyForm");
  if (!dummyForm) {
    dummyForm = document.createElement("form");
    dummyForm.id = "pinmapSearchOnlyForm";
    dummyForm.setAttribute("autocomplete", "off");
    dummyForm.setAttribute("aria-hidden", "true");
    dummyForm.style.display = "none";
    document.body.appendChild(dummyForm);
  }

  ["search", "mSearchInput"].forEach(id => {
    const el = $(id);
    if (!el) return;

    el.setAttribute("type", "search");
    el.setAttribute("form", "pinmapSearchOnlyForm");

    // one-time-code is intentionally used here because Chromium's password manager
    // may ignore autocomplete=off for fields it thinks are usernames.
    el.setAttribute("autocomplete", "one-time-code");
    el.setAttribute("inputmode", "search");
    el.setAttribute("autocorrect", "off");
    el.setAttribute("autocapitalize", "none");
    el.setAttribute("spellcheck", "false");

    // Unique non-credential field names.
    el.setAttribute("name", `pinmap-map-search-${id}-${Math.random().toString(36).slice(2)}`);

    // Ignore hints for common password managers/extensions.
    el.setAttribute("data-lpignore", "true");
    el.setAttribute("data-1p-ignore", "true");
    el.setAttribute("data-bwignore", "true");
    el.setAttribute("data-form-type", "other");

    // Readonly-until-user-action prevents Chrome from offering saved credentials
    // during page initialization/autofill scanning.
    el.readOnly = true;

    const unlock = () => {
      el.readOnly = false;
    };

    el.addEventListener("pointerdown", unlock, { once: true });
    el.addEventListener("touchstart", unlock, { once: true, passive: true });
    el.addEventListener("keydown", unlock, { once: true });

    // If keyboard focus arrives without pointer interaction, unlock immediately.
    el.addEventListener("focus", () => {
      el.readOnly = false;
    }, { once: true });
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", pinmapDisableSearchAutofill, { once: true });
} else {
  pinmapDisableSearchAutofill();
}

// --- MAP INITIALIZATION ---

// Prevent hairline seams only on the satellite basemap during high-level
// overzoom. DOL tiles are intentionally excluded so parcel rendering remains
// completely untouched.
(function pinmapFixSatelliteTileSeams(){
  const st = document.createElement("style");
  st.id = "pinmapSatelliteTileSeamFix";
  st.textContent = `
    .pinmap-satellite-tile {
      width: 257px !important;
      height: 257px !important;
      margin: 0 !important;
      border: 0 !important;
      outline: 0 !important;
      box-shadow: none !important;
      backface-visibility: hidden;
      image-rendering: auto;
    }
  `;
  document.head.appendChild(st);

  // During zoom animation Leaflet may temporarily place tiles on fractional
  // pixels. Rounding the satellite tile element itself prevents hairline gaps.
})();

const map = L.map("map", { preferCanvas: true, zoomControl: false, minZoom: 0, maxZoom: 23, zoomSnap: 0.25, zoomDelta: 0.5 }).setView([13.7563, 100.5018], 6);
L.control.zoom({ position: "bottomright" }).addTo(map);

// Explicit display stack (top -> bottom):
// points / markers > roads > DOL > administrative boundaries > basemap.
// This changes only visual stacking; it does not change data or Supabase reads.
map.createPane("pinmapBoundaryPane");
map.getPane("pinmapBoundaryPane").style.zIndex = "430";
map.getPane("pinmapBoundaryPane").style.pointerEvents = "none";

map.createPane("pinmapDolPane");
map.getPane("pinmapDolPane").style.zIndex = 450;
map.getPane("pinmapDolPane").style.mixBlendMode = "multiply";

map.getPane("pinmapDolPane").style.zIndex = "440";
map.getPane("pinmapDolPane").style.pointerEvents = "none";

if (map.getPane("markerPane")) map.getPane("markerPane").style.zIndex = "1100";
if (map.getPane("tooltipPane")) map.getPane("tooltipPane").style.zIndex = "1200";
if (map.getPane("popupPane")) map.getPane("popupPane").style.zIndex = "1300";

// Global visibility switch for Pins + 7-Eleven + CJ MORE.
// Individual layer states are preserved, so turning the eye back on restores them.
let PINMAP_ALL_POINTS_VISIBLE = true;

// Dashboard map-only filter for user Pins.
// Competitor layers are intentionally NOT filtered.
let PINMAP_DASHBOARD_ICON_FILTER = "";
function pinmapSetDashboardIconMapFilter(icon){
  PINMAP_DASHBOARD_ICON_FILTER = String(icon || "").trim().toLowerCase();
  if (typeof pinmapApplyPointCap === "function") pinmapApplyPointCap();
}

(function setupPinmapAllPointsEye(){
  const host = map.getContainer();
  const style = document.createElement("style");
  style.id = "pinmapAllPointsEyeStyle";
  style.textContent = `
    .pinmap-eye-btn{
      position:absolute;z-index:1500;width:42px;height:42px;border:0;border-radius:50%;
      background:rgba(255,255,255,.97);color:#111;box-shadow:0 1px 6px rgba(0,0,0,.28);
      display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;
      user-select:none;-webkit-user-select:none;
    }
    .pinmap-eye-btn svg{width:22px;height:22px;display:block;}
    .pinmap-eye-btn.off{background:#111;color:#fff;}
    @media (max-width:767px){.pinmap-eye-btn{width:40px;height:40px;}}
  `;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "pinmapAllPointsEyeBtn";
  btn.className = "pinmap-eye-btn";
  btn.title = "แสดง / ซ่อนจุดทั้งหมด";
  btn.setAttribute("aria-label", "แสดง / ซ่อน Pins, 7-Eleven และ CJ MORE");
  host.appendChild(btn);
  L.DomEvent.disableClickPropagation(btn);
  L.DomEvent.disableScrollPropagation(btn);

  const eyeOpen = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 5c5.5 0 9.6 5.4 9.8 5.7a2 2 0 0 1 0 2.6C21.6 13.6 17.5 19 12 19S2.4 13.6 2.2 13.3a2 2 0 0 1 0-2.6C2.4 10.4 6.5 5 12 5Zm0 2c-4 0-7.4 3.8-8.1 5 .7 1.2 4.1 5 8.1 5s7.4-3.8 8.1-5c-.7-1.2-4.1-5-8.1-5Zm0 2.2A2.8 2.8 0 1 1 12 14.8 2.8 2.8 0 0 1 12 9.2Z"/></svg>`;
  const eyeClosed = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m3.3 2 18.7 18.7-1.3 1.3-3.1-3.1A11.8 11.8 0 0 1 12 20C6.5 20 2.4 14.6 2.2 14.3a2 2 0 0 1 0-2.6A18.1 18.1 0 0 1 5.4 8L2 4.6 3.3 2Zm3.6 7.5A15.9 15.9 0 0 0 3.9 13c.7 1.2 4.1 5 8.1 5 1.5 0 2.9-.5 4.1-1.1l-1.8-1.8A3.8 3.8 0 0 1 8.9 9.7L6.9 7.7v1.8ZM12 6c5.5 0 9.6 5.4 9.8 5.7a2 2 0 0 1 0 2.6 17 17 0 0 1-2.2 2.6l-1.4-1.4A15 15 0 0 0 20.1 13c-.7-1.2-4.1-5-8.1-5-.7 0-1.4.1-2 .3L8.4 6.7A11.8 11.8 0 0 1 12 6Z"/></svg>`;

  function syncEye(){
    btn.innerHTML = PINMAP_ALL_POINTS_VISIBLE ? eyeOpen : eyeClosed;
    btn.classList.toggle("off", !PINMAP_ALL_POINTS_VISIBLE);
  }

  function isMobile(){ return window.matchMedia("(max-width:767px)").matches; }

  function positionEye(){
    const mapRect = host.getBoundingClientRect();
    if (isMobile()) {
      const search = document.getElementById("mSearchFloat") || document.getElementById("mSearchInput");
      const r = search?.getBoundingClientRect?.();
      let top = 36, right = 12;
      if (r && r.width > 0 && r.height > 0) {
        top = r.top - mapRect.top + (r.height - btn.offsetHeight) / 2;
        const desiredLeft = r.right - mapRect.left + 8;
        const maxLeft = mapRect.width - btn.offsetWidth - 10;
        if (desiredLeft <= maxLeft) {
          btn.style.left = `${Math.round(desiredLeft)}px`;
          btn.style.right = "auto";
        } else {
          btn.style.left = "auto";
          btn.style.right = `${Math.round(right)}px`;
        }
      } else {
        btn.style.left = "auto";
        btn.style.right = `${Math.round(right)}px`;
      }
      btn.style.top = `${Math.round(top)}px`;
      btn.style.bottom = "auto";
    } else {
      // Desktop: stack the eye directly ABOVE the ruler on the right.
      const ruler = document.getElementById("pinmapRulerBtn");
      const r = ruler?.getBoundingClientRect?.();
      if (r && r.width > 0 && r.height > 0) {
        btn.style.left = "auto";
        btn.style.right = `${Math.round(mapRect.right - r.right)}px`;
        btn.style.top = `${Math.round(r.top - mapRect.top - btn.offsetHeight - 8)}px`;
        btn.style.bottom = "auto";
      } else {
        btn.style.left = "auto";
        btn.style.right = "12px";
        btn.style.top = "auto";
        btn.style.bottom = "142px";
      }
    }
  }

  btn.addEventListener("click", () => {
    PINMAP_ALL_POINTS_VISIBLE = !PINMAP_ALL_POINTS_VISIBLE;
    syncEye();
    pinmapApplyPointCap();
    toast(PINMAP_ALL_POINTS_VISIBLE ? "แสดงจุดทั้งหมด" : "ซ่อน Pins / 7-Eleven / CJ MORE");
  });

  syncEye();
  setTimeout(positionEye, 0);
  setTimeout(positionEye, 250);
  window.addEventListener("resize", positionEye);
  window.addEventListener("orientationchange", () => setTimeout(positionEye, 120));
  new MutationObserver(() => requestAnimationFrame(positionEye)).observe(host, {childList:true,subtree:false});
})();


/* =========================================================
   COPY MAP COORDINATES : DESKTOP RIGHT-CLICK + MOBILE DOUBLE-TAP
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


// Mobile: double-tap directly on a marker to open its coordinate Copy popup.
// This is local UI logic only; it does not query Supabase or add Egress.
function pinmapEnableMarkerDoubleTap(marker) {
  if (!marker || marker.__pinmapDoubleTapCopyBound) return;
  marker.__pinmapDoubleTapCopyBound = true;

  let lastTap = 0;
  let lastPos = null;

  marker.on("add", () => {
    const el = marker.getElement?.();
    if (!el || el.__pinmapDoubleTapCopyBound) return;
    el.__pinmapDoubleTapCopyBound = true;

    el.addEventListener("touchend", e => {
      if (!e.changedTouches || e.changedTouches.length !== 1) return;
      const t = e.changedTouches[0];
      const now = Date.now();
      const dt = now - lastTap;

      if (dt > 40 && dt < 420 && lastPos) {
        const dx = t.clientX - lastPos.x;
        const dy = t.clientY - lastPos.y;

        if (Math.hypot(dx, dy) < 32) {
          e.preventDefault();
          e.stopPropagation();
          showCoordinateCopy(marker.getLatLng());
          lastTap = 0;
          lastPos = null;
          return;
        }
      }

      lastTap = now;
      lastPos = { x: t.clientX, y: t.clientY };
    }, { passive: false });
  });
}

// Desktop: right-click on the map.
// Mobile browsers can synthesize "contextmenu" from a long-press, so ignore
// contextmenu events that occur shortly after a touch. Mobile copy uses double-tap only.
let pinmapLastTouchAt = 0;
map.getContainer().addEventListener("touchstart", () => {
  pinmapLastTouchAt = Date.now();
}, { passive: true });

map.on("contextmenu", e => {
  const recentTouch = Date.now() - pinmapLastTouchAt < 1500;
  if (recentTouch) {
    e.originalEvent?.preventDefault?.();
    return;
  }
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


// Apply marker double-tap coordinate copy to every marker created by the app.
const _pinmapOriginalLeafletMarker = L.marker;
L.marker = function(...args) {
  const marker = _pinmapOriginalLeafletMarker.apply(this, args);
  pinmapEnableMarkerDoubleTap(marker);
  return marker;
};

// Base map selection: Google Hybrid is the default; OSM (buildings + street names) is the other option.
const googleHybridLayer = L.tileLayer(
  "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
  {
    maxZoom: 23,
    maxNativeZoom: 21,
    className: "pinmap-satellite-tile",
    keepBuffer: 4,
    updateWhenIdle: false,
    attribution: "Google Hybrid"
  }
).addTo(map);

// Alternate street basemap: OpenFreeMap Liberty (vector tiles).
// Leaflet remains the main map engine; MapLibre GL Leaflet renders this layer.
const osmLayer = L.maplibreGL({
  style: "https://tiles.openfreemap.org/styles/liberty"
});

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
  thumb.title = activeBaseMap === "googleHybrid" ? "Google Hybrid" : "OpenFreeMap";
}
updateBaseMapPreview();
/* =========================================================
   RULER / DISTANCE MEASUREMENT
   - Mobile: top-left, vertically aligned with mobile search
   - Desktop: right side, immediately above the basemap switcher
   - End points can be dragged after placement
   - Distance displays at most 2 decimal places
   ========================================================= */
(function setupPinmapRulerOnly() {
  let measuring = false;
  let rulerPoints = [];
  let rulerMarkers = [];
  let rulerLine = null;
  let rulerLabels = [];
  let rulerTotalLabel = null;

  const host = map.getContainer();

  const style = document.createElement("style");
  style.id = "pinmapRulerOnlyStyle";
  style.textContent = `
    .pinmap-ruler-btn{
      position:absolute; z-index:1001;
      width:42px; height:42px; border:0; border-radius:12px;
      background:rgba(255,255,255,.97); color:#111;
      box-shadow:0 1px 6px rgba(0,0,0,.28);
      display:flex; align-items:center; justify-content:center;
      font-size:21px; cursor:pointer; padding:0;
      user-select:none; -webkit-user-select:none;
    }
    .pinmap-ruler-btn.active{background:#111;color:#fff;}
    .pinmap-ruler-handle{
      width:15px;height:15px;border-radius:50%;
      background:#fff;border:3px solid #111;
      box-sizing:border-box;
      box-shadow:0 1px 4px rgba(0,0,0,.35);
    }
    .pinmap-ruler-label{
      background:rgba(17,17,17,.92);color:#fff;
      border:0;border-radius:7px;padding:3px 6px;
      font-size:11px;font-weight:700;white-space:nowrap;
      box-shadow:0 1px 4px rgba(0,0,0,.22);
    }
    .pinmap-ruler-label:before{display:none;}
    @media (max-width: 767px){
      .pinmap-ruler-btn{width:40px;height:40px;border-radius:11px;font-size:20px;}
    }
  `;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "pinmapRulerBtn";
  btn.className = "pinmap-ruler-btn";
  btn.title = "ไม้บรรทัดวัดระยะ";
  btn.setAttribute("aria-label", "ไม้บรรทัดวัดระยะ");
  btn.textContent = "📏";
  host.appendChild(btn);
  L.DomEvent.disableClickPropagation(btn);
  L.DomEvent.disableScrollPropagation(btn);

  function isMobile() {
    return window.matchMedia("(max-width: 767px)").matches;
  }

  function positionButton() {
    const mapRect = host.getBoundingClientRect();

    if (isMobile()) {
      // Mobile: same responsive behavior as the eye, but on the LEFT of search.
      const search = document.getElementById("mSearchFloat") || document.getElementById("mSearchInput");
      const searchRect = search?.getBoundingClientRect?.();
      let top = 36;
      let left = 12;
      if (searchRect && searchRect.width > 0 && searchRect.height > 0) {
        top = searchRect.top - mapRect.top + (searchRect.height - btn.offsetHeight) / 2;
        const desiredLeft = searchRect.left - mapRect.left - btn.offsetWidth - 8;
        left = Math.max(8, desiredLeft);
      }
      btn.style.left = `${Math.round(left)}px`;
      btn.style.right = "auto";
      btn.style.top = `${Math.round(top)}px`;
      btn.style.bottom = "auto";
    } else {
      // Desktop: sit directly above the basemap switcher on the right.
      const base = document.getElementById("baseMapPreview");
      const baseRect = base?.getBoundingClientRect?.();
      let right = 12, bottom = 92;
      if (baseRect && baseRect.width > 0 && baseRect.height > 0) {
        right = Math.max(8, mapRect.right - baseRect.right);
        bottom = Math.max(8, mapRect.bottom - baseRect.top + 8);
      }
      btn.style.left = "auto";
      btn.style.top = "auto";
      btn.style.right = `${Math.round(right)}px`;
      btn.style.bottom = `${Math.round(bottom)}px`;
    }
  }

  function fmtDistance(meters) {
    const n = Number(meters) || 0;
    if (n >= 1000) {
      return `${Number((n / 1000).toFixed(2))} km`;
    }
    return `${Number(n.toFixed(2))} m`;
  }

  function clearLabels() {
    rulerLabels.forEach(x => { try { map.removeLayer(x); } catch (_) {} });
    rulerLabels = [];
    if (rulerTotalLabel) {
      try { map.removeLayer(rulerTotalLabel); } catch (_) {}
      rulerTotalLabel = null;
    }
  }

  function redraw() {
    if (rulerLine) {
      try { map.removeLayer(rulerLine); } catch (_) {}
      rulerLine = null;
    }
    clearLabels();

    if (rulerPoints.length >= 2) {
      rulerLine = L.polyline(rulerPoints, {
        color: "#111", weight: 3, opacity: .9,
        dashArray: "7 5", interactive: false
      }).addTo(map);

      let total = 0;
      for (let i = 1; i < rulerPoints.length; i++) {
        const a = rulerPoints[i - 1];
        const b = rulerPoints[i];
        const d = map.distance(a, b);
        total += d;

        const mid = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
        const label = L.tooltip({
          permanent: true,
          direction: "center",
          className: "pinmap-ruler-label",
          interactive: false,
          opacity: 1
        }).setLatLng(mid).setContent(fmtDistance(d)).addTo(map);
        rulerLabels.push(label);
      }

      const last = rulerPoints[rulerPoints.length - 1];
      rulerTotalLabel = L.tooltip({
        permanent: true,
        direction: "top",
        offset: [0, -12],
        className: "pinmap-ruler-label",
        interactive: false,
        opacity: 1
      }).setLatLng(last).setContent(`รวม ${fmtDistance(total)}`).addTo(map);
    }
  }

  function handleIcon() {
    return L.divIcon({
      className: "",
      html: '<div class="pinmap-ruler-handle"></div>',
      iconSize: [15, 15],
      iconAnchor: [7.5, 7.5]
    });
  }

  function addMeasurePoint(latlng) {
    const index = rulerPoints.length;
    rulerPoints.push(L.latLng(latlng));

    const marker = L.marker(latlng, {
      icon: handleIcon(),
      draggable: true,
      keyboard: false,
      autoPan: true,
      zIndexOffset: 5000
    }).addTo(map);

    marker.on("drag", e => {
      rulerPoints[index] = e.target.getLatLng();
      redraw();
    });
    marker.on("dragend", e => {
      rulerPoints[index] = e.target.getLatLng();
      redraw();
    });

    // Prevent a handle click/touch from adding another measuring point.
    marker.on("click", e => {
      if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent);
    });

    rulerMarkers.push(marker);
    redraw();
  }

  function clearMeasurement() {
    rulerMarkers.forEach(m => { try { map.removeLayer(m); } catch (_) {} });
    rulerMarkers = [];
    rulerPoints = [];
    if (rulerLine) {
      try { map.removeLayer(rulerLine); } catch (_) {}
      rulerLine = null;
    }
    clearLabels();
  }

  function setMeasuring(on) {
    measuring = !!on;
    btn.classList.toggle("active", measuring);
    btn.title = measuring ? "กดอีกครั้งเพื่อจบการวัด" : "ไม้บรรทัดวัดระยะ";
    if (measuring) toast("แตะบนแผนที่เพื่อปักจุดวัดระยะ • กดไม้บรรทัดอีกครั้งเมื่อเสร็จ");
    else if (rulerPoints.length) toast("วัดเสร็จแล้ว • ลากจุดเพื่อปรับตำแหน่งได้");
  }

  btn.addEventListener("click", e => {
    e.preventDefault();
    e.stopPropagation();

    if (measuring) {
      setMeasuring(false);
      return;
    }

    // Starting a new measurement clears the previous one.
    if (rulerPoints.length) clearMeasurement();
    setMeasuring(true);
  });

  map.on("click", e => {
    if (!measuring) return;
    addMeasurePoint(e.latlng);
  });

  // Double-click finishes, while keeping all handles draggable.
  map.on("dblclick", e => {
    if (!measuring) return;
    if (e.originalEvent) L.DomEvent.preventDefault(e.originalEvent);
    setMeasuring(false);
  });

  window.addEventListener("resize", positionButton);
  window.addEventListener("orientationchange", () => setTimeout(positionButton, 100));
  map.on("resize", positionButton);
  setTimeout(positionButton, 0);
  setTimeout(positionButton, 300);
})();


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
  maxZoom: 23,
  tileSize: 256,
  opacity: 1.0,
  pane: "pinmapDolPane",
  updateWhenIdle: false,
  updateWhenZooming: true,
  keepBuffer: 4,
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
let amphoeBoundaryLayer = null;
let provinceBoundaryLayer = null;
let tambonBoundaryLabelLayer = null;
let amphoeBoundaryLabelLayer = null;
let provinceBoundaryLabelLayer = null;
let tambonBoundaryLoading = false;
let amphoeBoundaryLoading = false;
let provinceBoundaryLoading = false;
let tambonBoundaryOn = false;
let amphoeBoundaryOn = false;
let provinceBoundaryOn = false;
let amphoeDataPromise = null;

const boundaryStyle = {
  color: "#a855f7",
  weight: 1.1,
  opacity: 0.95,
  fill: false,
  fillOpacity: 0
};
const amphoeBoundaryStyle = {
  color: "#f97316",
  weight: 1.6,
  opacity: 0.98,
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

function ensureAmphoeBoundaryData() {
  if (window.PINMAP_AMPHOE_BOUNDARIES) return Promise.resolve(window.PINMAP_AMPHOE_BOUNDARIES);
  if (amphoeDataPromise) return amphoeDataPromise;
  amphoeDataPromise = new Promise((resolve, reject) => {
    const old = document.getElementById("pinmapAmphoeDataScript");
    if (old) {
      old.addEventListener("load", () => resolve(window.PINMAP_AMPHOE_BOUNDARIES || null), { once:true });
      old.addEventListener("error", reject, { once:true });
      return;
    }
    const sc = document.createElement("script");
    sc.id = "pinmapAmphoeDataScript";
    sc.src = "amphoe-data.js";
    sc.async = true;
    sc.onload = () => window.PINMAP_AMPHOE_BOUNDARIES ? resolve(window.PINMAP_AMPHOE_BOUNDARIES) : reject(new Error("amphoe data unavailable"));
    sc.onerror = () => reject(new Error("โหลด amphoe-data.js ไม่สำเร็จ"));
    document.head.appendChild(sc);
  }).catch(err => { amphoeDataPromise = null; throw err; });
  return amphoeDataPromise;
}

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

function boundaryState(type) {
  if (type === "tambon") return {
    layer: () => tambonBoundaryLayer, setLayer: v => { tambonBoundaryLayer = v; },
    labels: () => tambonBoundaryLabelLayer, setLabels: v => { tambonBoundaryLabelLayer = v; },
    loading: () => tambonBoundaryLoading, setLoading: v => { tambonBoundaryLoading = v; },
    on: () => tambonBoundaryOn, setOn: v => { tambonBoundaryOn = v; },
    data: () => window.PINMAP_TAMBON_BOUNDARIES || null,
    labelList: () => window.PINMAP_TAMBON_LABELS || [],
    style: boundaryStyle, label: "ขอบเขตตำบล", zoomMin: 11, maxLabels: 1200,
    name: (f,i) => (window.PINMAP_TAMBON_LABELS || [])[i] || f?.properties?.T_NAME_T || f?.properties?.name,
    ids: ["tambonToggle","mTambonToggle"]
  };
  if (type === "amphoe") return {
    layer: () => amphoeBoundaryLayer, setLayer: v => { amphoeBoundaryLayer = v; },
    labels: () => amphoeBoundaryLabelLayer, setLabels: v => { amphoeBoundaryLabelLayer = v; },
    loading: () => amphoeBoundaryLoading, setLoading: v => { amphoeBoundaryLoading = v; },
    on: () => amphoeBoundaryOn, setOn: v => { amphoeBoundaryOn = v; },
    data: () => window.PINMAP_AMPHOE_BOUNDARIES || null,
    labelList: () => [],
    style: amphoeBoundaryStyle, label: "ขอบเขตอำเภอ/เขต", zoomMin: 9, maxLabels: 350,
    name: f => f?.properties?.AMP_NAME_T || f?.properties?.AMP_NAME_E || "",
    ids: ["amphoeToggle","mAmphoeToggle"]
  };
  return {
    layer: () => provinceBoundaryLayer, setLayer: v => { provinceBoundaryLayer = v; },
    labels: () => provinceBoundaryLabelLayer, setLabels: v => { provinceBoundaryLabelLayer = v; },
    loading: () => provinceBoundaryLoading, setLoading: v => { provinceBoundaryLoading = v; },
    on: () => provinceBoundaryOn, setOn: v => { provinceBoundaryOn = v; },
    data: () => window.PINMAP_PROVINCE_BOUNDARIES || null,
    labelList: () => window.PINMAP_PROVINCE_LABELS || [],
    style: provinceBoundaryStyle, label: "ขอบเขตจังหวัด", zoomMin: 7, maxLabels: 100,
    name: (f,i) => (window.PINMAP_PROVINCE_LABELS || [])[i] || f?.properties?.PROV_NAMT || f?.properties?.name,
    ids: ["provinceToggle","mProvinceToggle"]
  };
}

function refreshBoundaryLabels(type) {
  const st = boundaryState(type);
  const boundaryLayer = st.layer();
  const data = st.data();
  const oldLabels = st.labels();
  if (oldLabels) map.removeLayer(oldLabels);
  st.setLabels(null);
  if (!boundaryLayer || !data || !Array.isArray(data.features) || map.getZoom() < st.zoomMin) return;

  const group = L.layerGroup();
  const mapBounds = map.getBounds().pad(0.08);
  let count = 0;
  for (let i = 0; i < data.features.length && count < st.maxLabels; i++) {
    const feature = data.features[i];
    const center = boundaryFeatureCenter(feature);
    if (!center || !mapBounds.contains(center)) continue;
    const name = st.name(feature, i);
    if (!name) continue;
    L.marker(center, {
      icon: L.divIcon({
        className: "pinmap-boundary-label-wrap",
        html: `<span class="pinmap-boundary-label">${String(name).replace(/[&<>\"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]))}</span>`,
        iconSize: null, iconAnchor: [0,0]
      }),
      interactive: false, keyboard: false, zIndexOffset: 1000
    }).addTo(group);
    count++;
  }
  group.addTo(map);
  st.setLabels(group);
}

async function loadBoundaryLayer(type) {
  const st = boundaryState(type);
  if (st.layer()) return st.layer();
  if (st.loading()) return null;
  st.setLoading(true);
  try {
    if (type === "amphoe") await ensureAmphoeBoundaryData();
    const data = st.data();
    if (!data) throw new Error("boundary data unavailable");
    const layer = L.geoJSON(data, {
      pane: "pinmapBoundaryPane",
      style: st.style,
      interactive: false
    });
    st.setLayer(layer);
    return layer;
  } catch (err) {
    console.error(`โหลด${st.label}ไม่สำเร็จ`, err);
    toast(`ไม่สามารถโหลด${st.label}ได้`);
    return null;
  } finally {
    st.setLoading(false);
  }
}

async function toggleBoundary(type) {
  const st = boundaryState(type);
  st.setOn(!st.on());
  let on = st.on();
  const layer = on ? await loadBoundaryLayer(type) : st.layer();
  if (on && layer) {
    layer.addTo(map);
    refreshBoundaryLabels(type);
  }
  if (!on && layer && map.hasLayer(layer)) {
    map.removeLayer(layer);
    const labels = st.labels();
    if (labels) map.removeLayer(labels);
    st.setLabels(null);
  }
  if (!layer && on) { st.setOn(false); on = false; }
  for (const id of st.ids) $(id)?.classList.toggle("active", st.on());
}

map.on("zoomend moveend", () => {
  if (tambonBoundaryOn) refreshBoundaryLabels("tambon");
  if (amphoeBoundaryOn) refreshBoundaryLabels("amphoe");
  if (provinceBoundaryOn) refreshBoundaryLabels("province");
});

function toggleBoundaryPanel() {
  $("boundaryPanel")?.classList.toggle("hidden");
  $("mBoundaryPanel")?.classList.toggle("hidden");
}
if ($("boundaryToggle")) $("boundaryToggle").onclick = toggleBoundaryPanel;
if ($("mBoundaryToggle")) $("mBoundaryToggle").onclick = toggleBoundaryPanel;

// Add Amphoe/District as a third boundary choice without requiring an index.html change.
(function addAmphoeBoundaryButtons(){
  function addAfter(baseId,newId){
    const base=$(baseId);
    if(!base || $(newId)) return;
    const b=base.cloneNode(true);
    b.id=newId;
    b.innerHTML="อำเภอ/เขต";
    b.classList.remove("active");
    base.insertAdjacentElement("afterend",b);
  }
  addAfter("tambonToggle","amphoeToggle");
  addAfter("mTambonToggle","mAmphoeToggle");
})();

if ($("tambonToggle")) $("tambonToggle").onclick = () => toggleBoundary("tambon");
if ($("amphoeToggle")) $("amphoeToggle").onclick = () => toggleBoundary("amphoe");
if ($("provinceToggle")) $("provinceToggle").onclick = () => toggleBoundary("province");
if ($("mTambonToggle")) $("mTambonToggle").onclick = () => toggleBoundary("tambon");
if ($("mAmphoeToggle")) $("mAmphoeToggle").onclick = () => toggleBoundary("amphoe");
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

// Point cap must be initialized before s11Update()/cjUpdate() can call pinmapApplyPointCap().
const PINMAP_MAX_VISIBLE_POINTS = 200;


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
  const assignBtn = S.session ? `<button type="button" class="pin-nav-link pinAssignBtn" data-kind="7eleven" data-id="${esc(rec._s11Key ?? rec._localId ?? rec.id ?? '')}" data-title="${esc(rec.n || '7-Eleven')}" data-lat="${Number(rec.y)}" data-lng="${Number(rec.x)}" style="background:#2563eb">📌 มอบหมาย</button>` : "";
  return `<div class="pin-title">🏪 ${esc(rec.n)}</div>
    <div>${esc(rec.a)}</div>
    ${rec.note ? `<div class="pin-note">${esc(rec.note)}</div>` : ""}
    <div class="pin-meta"><a href="${gmapUrl}" target="_blank" rel="noopener" class="pin-nav-link">🧭 นำทาง (Google Maps)</a> ${editBtn} ${assignBtn}</div>`;
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


function s11Update(skipRender = false) {

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

  if (!skipRender) pinmapApplyPointCap();
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

    const generatedAddress = window.pinmapAdminAddressFromLatLng
      ? await window.pinmapAdminAddressFromLatLng(ll.lat, ll.lng)
      : a;
    const resolvedAddress = generatedAddress || a;

    try {

      /* ===== EDIT EXISTING ===== */

      if (ctx.rec && ctx.baseEditId != null) {

        const payload = {
          name_th: n,
          address_th: resolvedAddress,
          address: resolvedAddress,
          latitude: ll.lat,
          longitude: ll.lng,
          note: note,
          color: color,
          is_custom: true
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
                address_th: resolvedAddress,
          address: resolvedAddress,
                latitude: ll.lat,
                longitude: ll.lng,
                is_custom: true
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

        var s11InsertedId = id;

        const payload = {
          id: id,
          name_th: n,
          address_th: resolvedAddress,
          address: resolvedAddress,
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
                address_th: resolvedAddress,
          address: resolvedAddress,
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
        id: ctx.baseEditId != null
          ? ctx.baseEditId
          : (typeof s11InsertedId !== "undefined" ? s11InsertedId : ("custom_" + Date.now())),
        n,
        a: resolvedAddress,
        note,
        color,
        y: ll.lat,
        x: ll.lng,
        is_custom: ctx.rec ? !!ctx.rec.is_custom : true
      });

      closeS11Modal();
      toast("บันทึก 7-Eleven แล้ว");

      /* โหลดข้อมูลจริงจาก Supabase แบบ background */
      /* no full competitor reload: Realtime delta keeps data in sync */

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

      const isStaticBase = PINMAP_STATIC_SEVEN11.some(x => String(x.id) === String(id));

      let result;
      if (isStaticBase) {
        // Keep a tiny tombstone override so a deleted base branch does not reappear
        // from seven11-data.js on the next page load.
        result = await S.sb
          .from("7-11")
          .update({ is_custom: true, color: PINMAP_S11_TOMBSTONE_COLOR })
          .eq("id", String(id));
      } else {
        result = await S.sb
          .from("7-11")
          .delete()
          .eq("id", String(id));
      }

      if (result.error) {
        throw result.error;
      }

      /* ลบจากแผนที่ทันที */
      fastDeleteS11(id);

      closeS11Modal();
      toast("ลบจุด 7-Eleven แล้ว");

      /* sync กลับจาก Supabase แบบ background */
      /* no full competitor reload: Realtime delta keeps data in sync */

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
  const assignBtn = S.session ? `<button type="button" class="pin-nav-link pinAssignBtn" data-kind="cjmore" data-id="${esc(rec._cjKey ?? rec._localId ?? rec.code ?? '')}" data-title="${esc(cjDisplayName(rec))}" data-lat="${Number(rec.lat)}" data-lng="${Number(rec.lng)}" style="background:#2563eb">📌 มอบหมาย</button>` : "";
  const tel = rec.tel ? `<div>โทร: ${esc(rec.tel)}</div>` : "";
  return `<div class="pin-title">🏪 ${esc(cjDisplayName(rec))}</div>
    ${rec.address ? `<div>${esc(rec.address)}</div>` : ""}
    ${tel}
    ${rec.description ? `<div class="pin-note">${esc(rec.description)}</div>` : ""}
    <div class="pin-meta"><a href="${gmapUrl}" target="_blank" rel="noopener" class="pin-nav-link">🧭 นำทาง (Google Maps)</a> ${editBtn} ${assignBtn}</div>`;
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


function cjUpdate(skipRender = false) {

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

  if (!skipRender) pinmapApplyPointCap();
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


/* =========================================================
   EXTRA COMPETITORS
   Big C Mini / Lawson108 / Lotus's go fresh / Tops / ถูกดี
   ========================================================= */
const PINMAP_EXTRA_COMPETITOR_DEFS = [
  {key:"bigc", table:"bigc", label:"Big C Mini", logo:"logo-bigc-mini.webp"},
  {key:"lawson108", table:"lawson108", label:"Lawson108", logo:"logo-lawson108.png"},
  {key:"lotus", table:"lotus", label:"Lotus's go fresh", logo:"logo-lotusgo.png"},
  {key:"tops", table:"tops", label:"Tops", logo:"logo-tops.png"},
  {key:"thukdee", table:"thukdee", label:"ถูกดี", logo:"logo-thukdee.png"}
];
const PINMAP_EXTRA_COMPETITORS = new Map(
  PINMAP_EXTRA_COMPETITOR_DEFS.map(d => [d.key, {
    ...d, on: localStorage.getItem(`pinmap-${d.key}-on`) !== "0",
    rows: [], markers: new Map(), layer: L.layerGroup()
  }])
);
let pinmapExtraAddBrand=null, pinmapExtraMove=null, pinmapExtraEditing=null;

(function(){
  const st=document.createElement("style");st.id="pinmapExtraCompetitorStyle";
  st.textContent=`
  .pinmap-comp-panel{display:flex;flex-direction:column;gap:7px}
  .pinmap-comp-row{display:grid;grid-template-columns:minmax(0,1fr) 42px;gap:7px}
  .pinmap-comp-toggle,.pinmap-comp-add,.pinmap-comp-more{border:0;border-radius:10px;background:#f3f3f3;min-height:42px;font:inherit;font-weight:700;cursor:pointer}
  .pinmap-comp-toggle{display:flex;align-items:center;gap:8px;padding:7px 10px;text-align:left}
  .pinmap-comp-toggle.active{background:#111;color:#fff}
  .pinmap-comp-toggle img{width:25px;height:25px;object-fit:contain;border-radius:5px;background:#fff}
  .pinmap-comp-add{font-size:22px}.pinmap-comp-more{text-align:left;padding:8px 10px}
  .pinmap-comp-extra.hidden{display:none!important}
  .pinmap-extra-logo-marker{width:27px;height:27px;border-radius:50%;background:#fff;border:2px solid #111;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;overflow:hidden}
  .pinmap-extra-logo-marker img{width:21px;height:21px;object-fit:contain}
  #pinmapExtraCompetitorModal{position:fixed;z-index:99999;inset:0;background:rgba(0,0,0,.38);display:flex;align-items:center;justify-content:center;padding:16px}
  #pinmapExtraCompetitorModal.hidden{display:none!important}
  .pem-card{width:min(420px,95vw);background:#fff;border-radius:16px;padding:16px;box-shadow:0 18px 60px rgba(0,0,0,.28)}
  .pem-head{display:flex;align-items:center;gap:10px;margin-bottom:12px}.pem-head img{width:36px;height:36px;object-fit:contain}.pem-head b{font-size:17px;flex:1}
  .pem-x{border:0;background:#eee;border-radius:9px;width:34px;height:34px;font-size:20px}
  .pem-card label{font-size:12px;font-weight:700;display:block;margin:9px 0 4px}.pem-card input,.pem-card textarea{width:100%;box-sizing:border-box;border:1px solid #d1d5db;border-radius:9px;padding:9px;font:inherit}
  .pem-card textarea{min-height:70px;resize:vertical}.pem-address{font-size:11px;color:#555;background:#f7f7f7;border-radius:9px;padding:8px;line-height:1.45}
  .pem-actions{display:flex;gap:8px;margin-top:13px}.pem-actions button{border:0;border-radius:9px;padding:9px 13px;font-weight:800;cursor:pointer}
  .pem-save{background:#111;color:#fff;flex:1}.pem-delete{background:#fee2e2;color:#b91c1c}.pem-move{background:#e5e7eb}`;
  document.head.appendChild(st);
})();

function pinmapExtraIcon(st){
  return L.divIcon({className:"",html:`<span class="pinmap-extra-logo-marker"><img src="${st.logo}" alt="${esc(st.label)}"></span>`,iconSize:[27,27],iconAnchor:[13.5,13.5],popupAnchor:[0,-20]});
}
function pinmapExtraPopup(st,r){
  const assignBtn = S.session ? `<button type="button" class="pin-nav-link pinAssignBtn" data-kind="${esc(st.key)}" data-id="${esc(r.id)}" data-title="${esc(r.name||st.label)}" data-lat="${Number(r.lat)}" data-lng="${Number(r.lng)}" style="background:#2563eb">📌 มอบหมาย</button>` : "";
  return `<div class="pin-title"><img src="${st.logo}" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;margin-right:5px">${esc(r.name||st.label)}</div><div>${esc(r.address||"")}</div>${r.note?`<div class="pin-note">${esc(r.note)}</div>`:""}<div class="pin-meta"><button type="button" class="pin-nav-link pinmap-extra-edit" data-brand="${st.key}" data-id="${esc(r.id)}">✎ แก้ไข</button> ${assignBtn}</div>`;
}
function pinmapExtraEnsureMarker(st,r){
  const id=String(r.id);let m=st.markers.get(id);
  if(!m){m=L.marker([+r.lat,+r.lng],{icon:pinmapExtraIcon(st)});st.markers.set(id,m)}
  else m.setLatLng([+r.lat,+r.lng]);
  if(m.getPopup())m.setPopupContent(pinmapExtraPopup(st,r));else m.bindPopup(pinmapExtraPopup(st,r),{closeButton:true,autoClose:true,closeOnClick:false});
  return m;
}
function pinmapExtraRender(){
  const bounds=pinmapVisibleBounds(),q=pinmapSearchText(),center=map.getCenter();
  let remaining=Math.max(0,PINMAP_MAX_VISIBLE_POINTS-(cluster.getLayers?.().length||0)-(s11Cluster.getLayers?.().length||0)-(cjCluster.getLayers?.().length||0));
  for(const st of PINMAP_EXTRA_COMPETITORS.values()){
    st.layer.clearLayers();
    if(!PINMAP_ALL_POINTS_VISIBLE||remaining<=0){if(map.hasLayer(st.layer))map.removeLayer(st.layer);continue}
    const arr=st.rows.filter(r=>(q||st.on)&&(q||pinmapInViewport(r.lat,r.lng,bounds))&&(!q||(String(r.name||"")+" "+String(r.address||"")+" "+String(r.note||"")).toLowerCase().includes(q)));
    arr.forEach(r=>r._d=pinmapDistanceToCenter(r.lat,r.lng,center));arr.sort((a,b)=>a._d-b._d);
    const selected=arr.slice(0,remaining);selected.forEach(r=>st.layer.addLayer(pinmapExtraEnsureMarker(st,r)));remaining-=selected.length;
    if(selected.length&&!map.hasLayer(st.layer))st.layer.addTo(map);if(!selected.length&&map.hasLayer(st.layer))map.removeLayer(st.layer);
  }
}
async function pinmapLoadExtraCompetitors(){
  if(!S.sb)return;
  for(const st of PINMAP_EXTRA_COMPETITORS.values()){
    const {data,error}=await S.sb.from(st.table).select("id,name,address,note,lat,lng,created_by,created_by_user_id,created_at").order("created_at",{ascending:true});
    if(error){console.warn(`โหลด ${st.label} ไม่สำเร็จ`,error);continue}
    st.rows=(data||[]).filter(r=>Number.isFinite(+r.lat)&&Number.isFinite(+r.lng));
  }
  pinmapBuildCompetitorPanel();pinmapExtraRender();
}
function pinmapExtraToggle(key){
  const st=PINMAP_EXTRA_COMPETITORS.get(key);if(!st)return;st.on=!st.on;localStorage.setItem(`pinmap-${key}-on`,st.on?"1":"0");pinmapBuildCompetitorPanel();pinmapExtraRender();
}
function pinmapExtraStartAdd(key){
  if(!S.session)return openAuth("เข้าสู่ระบบก่อน");
  pinmapExtraAddBrand=key;pinmapExtraMove=null;
  $("mode")?.classList.remove("hidden");if($("modeText"))$("modeText").textContent=`📍 แตะตำแหน่งเพื่อเพิ่ม ${PINMAP_EXTRA_COMPETITORS.get(key)?.label||""}`;
  closeCompetitorPanels();
}
async function pinmapOpenExtraModal(key,row=null,ll=null){
  const st=PINMAP_EXTRA_COMPETITORS.get(key);if(!st)return;
  pinmapExtraEditing=row?{key,row}:null;ll=ll||(row?{lat:+row.lat,lng:+row.lng}:map.getCenter());
  const addr=window.pinmapAdminAddressFromLatLng?await window.pinmapAdminAddressFromLatLng(ll.lat,ll.lng):(row?.address||"");
  const m=$("pinmapExtraCompetitorModal");m.dataset.brand=key;m.dataset.lat=ll.lat;m.dataset.lng=ll.lng;
  $("pemLogo").src=st.logo;$("pemTitle").textContent=row?`แก้ไข ${st.label}`:`เพิ่ม ${st.label}`;$("pemName").value=row?.name||st.label;$("pemNote").value=row?.note||"";$("pemAddress").textContent=addr||"ไม่พบข้อมูลขอบเขต";
  $("pemDelete").classList.toggle("hidden",!row);$("pemMove").classList.toggle("hidden",!row);m.classList.remove("hidden");
}
(function(){
  const m=document.createElement("div");m.id="pinmapExtraCompetitorModal";m.className="hidden";m.innerHTML=`<div class="pem-card"><div class="pem-head"><img id="pemLogo"><b id="pemTitle"></b><button id="pemClose" class="pem-x" type="button">×</button></div><label>ชื่อ</label><input id="pemName"><label>Address (อัตโนมัติจากพิกัด)</label><div id="pemAddress" class="pem-address"></div><label>Note</label><textarea id="pemNote"></textarea><div class="pem-actions"><button id="pemDelete" class="pem-delete hidden" type="button">ลบ</button><button id="pemMove" class="pem-move hidden" type="button">ย้ายจุด</button><button id="pemSave" class="pem-save" type="button">บันทึก</button></div></div>`;document.body.appendChild(m);
  $("pemClose").onclick=()=>m.classList.add("hidden");m.onclick=e=>{if(e.target===m)m.classList.add("hidden")};
  $("pemSave").onclick=async()=>{const st=PINMAP_EXTRA_COMPETITORS.get(m.dataset.brand);if(!st||!S.sb)return;const lat=+m.dataset.lat,lng=+m.dataset.lng,address=window.pinmapAdminAddressFromLatLng?await window.pinmapAdminAddressFromLatLng(lat,lng):$("pemAddress").textContent;const payload={name:($("pemName").value||st.label).trim(),address,note:($("pemNote").value||"").trim(),lat,lng,created_by:username(),created_by_user_id:S.session?.user?.id||null};
    try{if(pinmapExtraEditing?.key===st.key){const {error}=await S.sb.from(st.table).update(payload).eq("id",pinmapExtraEditing.row.id);if(error)throw error}else{const {error}=await S.sb.from(st.table).insert(payload);if(error)throw error}m.classList.add("hidden");pinmapExtraEditing=null;await pinmapLoadExtraCompetitors();toast(`บันทึก ${st.label} แล้ว`)}catch(err){toast(err.message||"บันทึกไม่สำเร็จ")}};
  $("pemDelete").onclick=async()=>{const e=pinmapExtraEditing;if(!e||!confirm("ลบจุดนี้ใช่หรือไม่?"))return;const st=PINMAP_EXTRA_COMPETITORS.get(e.key),{error}=await S.sb.from(st.table).delete().eq("id",e.row.id);if(error)return toast(error.message);m.classList.add("hidden");pinmapExtraEditing=null;await pinmapLoadExtraCompetitors();toast("ลบจุดแล้ว")};
  $("pemMove").onclick=()=>{if(!pinmapExtraEditing)return;pinmapExtraMove=pinmapExtraEditing;m.classList.add("hidden");$("mode")?.classList.remove("hidden");if($("modeText"))$("modeText").textContent="📍 แตะตำแหน่งใหม่ของจุดคู่แข่ง";toast("แตะตำแหน่งใหม่บนแผนที่")};
})();
document.addEventListener("click",e=>{const b=e.target.closest?.(".pinmap-extra-edit");if(!b)return;const st=PINMAP_EXTRA_COMPETITORS.get(b.dataset.brand),r=st?.rows.find(x=>String(x.id)===String(b.dataset.id));if(r)pinmapOpenExtraModal(st.key,r)},true);
map.on("click",async e=>{if(pinmapExtraMove){const x=pinmapExtraMove;pinmapExtraMove=null;$("mode")?.classList.add("hidden");await pinmapOpenExtraModal(x.key,x.row,e.latlng);toast("เลือกตำแหน่งใหม่แล้ว กดบันทึกเพื่อยืนยัน");return}if(pinmapExtraAddBrand){const k=pinmapExtraAddBrand;pinmapExtraAddBrand=null;$("mode")?.classList.add("hidden");await pinmapOpenExtraModal(k,null,e.latlng)}});

function pinmapCompRow(toggleId,addId,label,logo,on,count=""){return `<div class="pinmap-comp-row"><button type="button" id="${toggleId}" class="pinmap-comp-toggle ${on?"active":""}">${logo?`<img src="${logo}" alt="">`:""}<span style="flex:1">${esc(label)}</span>${count?`<small>${count}</small>`:""}</button><button type="button" id="${addId}" class="pinmap-comp-add" title="เพิ่ม ${esc(label)}">＋</button></div>`}
function pinmapBuildCompetitorPanel(){
  const build=(panel,mobile=false)=>{if(!panel)return;const oldExtraOpen=!!panel.querySelector(".pinmap-comp-extra:not(.hidden)");
    panel.innerHTML=`<div class="pinmap-comp-panel">${pinmapCompRow(mobile?"mS11Toggle":"s11Toggle",mobile?"mS11Add":"s11Add","7-Eleven","7-11-logo.png",S11.on)}${pinmapCompRow(mobile?"mCJToggle":"cjToggle",mobile?"mCJAdd":"cjAdd","CJ MORE","logo-cj-more.jpg",CJ.on)}<button type="button" class="pinmap-comp-more">อื่นๆ ▾</button><div class="pinmap-comp-extra ${oldExtraOpen?"":"hidden"}">${PINMAP_EXTRA_COMPETITOR_DEFS.map(d=>{const st=PINMAP_EXTRA_COMPETITORS.get(d.key);return pinmapCompRow(`${mobile?"m":""}pc_${d.key}`,`${mobile?"m":""}pcadd_${d.key}`,d.label,d.logo,st.on,st.rows.length?String(st.rows.length):"")}).join("")}</div></div>`;
    $(mobile?"mS11Toggle":"s11Toggle").onclick=toggleS11;$(mobile?"mS11Add":"s11Add").onclick=()=>{triggerS11Add();closeCompetitorPanels()};$(mobile?"mCJToggle":"cjToggle").onclick=toggleCJ;$(mobile?"mCJAdd":"cjAdd").onclick=()=>{triggerCJAdd();closeCompetitorPanels()};panel.querySelector(".pinmap-comp-more").onclick=()=>panel.querySelector(".pinmap-comp-extra").classList.toggle("hidden");PINMAP_EXTRA_COMPETITOR_DEFS.forEach(d=>{$(`${mobile?"m":""}pc_${d.key}`).onclick=()=>pinmapExtraToggle(d.key);$(`${mobile?"m":""}pcadd_${d.key}`).onclick=()=>pinmapExtraStartAdd(d.key)})};
  build($("competitorPanel"),false);build($("mCompetitorPanel"),true);
}
setTimeout(pinmapBuildCompetitorPanel,0);


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

      const generatedAddress = window.pinmapAdminAddressFromLatLng
        ? await window.pinmapAdminAddressFromLatLng(ll.lat, ll.lng)
        : address;
      const resolvedAddress = generatedAddress || address;

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
                address: resolvedAddress,
                lat: ll.lat,
                long: ll.lng,
                is_custom: true
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
                address: resolvedAddress,
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
          address: resolvedAddress,
          lat: ll.lat,
          lng: ll.lng,
          is_custom: ctx.rec ? !!ctx.rec.is_custom : true
        });

        closeCJModal();
        toast("บันทึก CJ MORE แล้ว");

        /* โหลดข้อมูลจริงจาก Supabase แบบ background */
        /* no full competitor reload: Realtime delta keeps data in sync */

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
        /* no full competitor reload: Realtime delta keeps data in sync */

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
const PIN_STATUS_NAMES = {
  pin: "Survey",
  m1: "M1",
  cjx: "CJX",
  van: "รถตู้",
  deal: "เจรจรา",
  find: "ตามหา",
  x: "ไม่ให้เช่า",

  // Legacy names are kept only for old database rows / backwards compatibility.
  decision: "Decision",
  star: "Star",
  heart: "Heart",
  flag: "Flag",
  home: "Home",
  food: "Food",
  shop: "Shop",
  hotel: "Hotel",
  photo: "Photo",
  makro: "Makro",
  tops: "Tops",
  thukdee: "ถูกดี",
  seven11: "7-Eleven",
  "7eleven": "7-Eleven",
  "7-11": "7-Eleven",
  bigcmini: "Big C Mini",
  cjmore: "CJ MORE",
  lotusgo: "Lotus's go fresh",
  lawson108: "Lawson108"
};
function pinStatusName(icon){
  const k = String(icon || "pin").trim().toLowerCase();
  return PIN_STATUS_NAMES[k] || k || "Survey";
}

const PIN_WORKFLOW_COLORS = [
  { hex:"#111111", label:"รอขึ้น" },
  { hex:"#ef4444", label:"ไม่ผ่าน" },
  { hex:"#eab308", label:"Hold" },
  { hex:"#22c55e", label:"ผ่าน" }
];
function pinWorkflowLabel(color){
  const c = String(color || "").toLowerCase();
  const hit = PIN_WORKFLOW_COLORS.find(x => x.hex === c);
  return hit ? hit.label : "";
}
function pinDetailedStatus(icon, color){
  const k = String(icon || "pin").trim().toLowerCase();
  if(k === "m1" || k === "van"){
    const wf = pinWorkflowLabel(color);
    if(wf) return `${wf}${pinStatusName(k)}`;
  }
  return pinStatusName(k);
}

function pinAuditActionName(action){
  const a = String(action || "").toUpperCase();
  if(a === "INSERT") return "สร้างจุด";
  if(a === "UPDATE") return "แก้ไข/บันทึก";
  if(a === "DELETE") return "ลบจุด";
  return a;
}
function pinAuditValue(before, after){
  const b = before ?? "";
  const a = after ?? "";
  if(String(b) === String(a)) return String(a);
  return `${b === "" ? "—" : b} → ${a === "" ? "—" : a}`;
}
const PIN_LOGOS = {
  m1: "m1.png",
  cjx: "logo-cjx.png",
  van: "van.webp",
  deal: "deal.png",
  find: "find.png",
  x: "no-rent.jpg",

  // Legacy assets, for old rows only.
  decision: "Decision.png",
  makro: "logo-makro.jpg",
  tops: "logo-tops.png",
  thukdee: "logo-thukdee.png",
  seven11: "logo-7eleven.png",
  bigcmini: "logo-bigc-mini.webp",
  cjmore: "logo-cj-more.jpg",
  lotusgo: "logo-lotusgo.png",
  lawson108: "logo-lawson108.png"
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
  const m = L.marker([p.lat, p.lng], { icon: pinIcon(p.color, p.icon) });
  const gmapUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  const canEdit = !!S.session;
  m.bindPopup(`<div class="pin-title">${esc(p.title)}</div>
    ${p.point_no ? `<div><strong>จุดที่:</strong> ${esc(p.point_no)}</div>` : ""}
    ${p.address ? `<div><strong>ที่อยู่:</strong> ${esc(p.address)}</div>` : ""}
    ${p.area ? `<div><strong>Area:</strong> ${esc(p.area)}</div>` : ""}
    <div class="pin-note">${esc(p.note || "")}</div>
    <div class="pin-meta">ดำเนินการล่าสุดโดย ${esc(p.created_by || "ผู้ใช้")}</div>
    ${p.created_at ? `<div class="pin-meta">อัปเดตล่าสุด ${esc(new Date(p.created_at).toLocaleString("th-TH"))}</div>` : ""}
    <a href="${gmapUrl}" target="_blank" rel="noopener" class="pin-nav-link">🧭 นำทาง (Google Maps)</a>
    ${canEdit ? `<button type="button" class="pin-nav-link pinEditBtn" data-id="${p.id}" style="background:#111">✎ แก้ไขจุด</button>` : ""}
    ${S.session ? `<button type="button" class="pin-nav-link pinAssignBtn" data-kind="pin" data-id="${esc(p.id)}" data-title="${esc(p.title || 'Survey')}" data-lat="${Number(p.lat)}" data-lng="${Number(p.lng)}" style="background:#2563eb">📌 มอบหมาย</button>` : ""}`);
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

let pinmapSearchTimer = null;

const PINMAP_SEARCH_DEBOUNCE_MS = 2000;
let pinmapSearchRequestSeq = 0;

const handleSearch = () => {
  if (searchCoordinate()) return;

  // Important for smooth typing:
  // do NOT scan the large 7-Eleven/CJ MORE static arrays on every keystroke.
  // Wait until the user has stopped typing for 2 seconds, then run one combined search refresh.
  clearTimeout(pinmapSearchTimer);
  const q = pinmapSearchText();
  const seq = ++pinmapSearchRequestSeq;

  pinmapSearchTimer = setTimeout(async () => {
    if (seq !== pinmapSearchRequestSeq) return;

    // Local competitor search only runs after the debounce.
    // Skip duplicate redraws; one render is enough after both datasets are ready.
    s11Update(true);
    cjUpdate(true);
    pinmapApplyPointCap();

    if (seq !== pinmapSearchRequestSeq) return;

    if (q) await loadPinsSearch(q);
    else await loadPinsViewport();
  }, PINMAP_SEARCH_DEBOUNCE_MS);
};

function clearSearch() {
  if ($("search")) $("search").value = "";
  if ($("mSearchInput")) $("mSearchInput").value = "";
  if (coordinateSearchMarker) {
    map.removeLayer(coordinateSearchMarker);
    coordinateSearchMarker = null;
  }
  clearTimeout(pinmapSearchTimer);
  ++pinmapSearchRequestSeq;
  s11Update();
  cjUpdate();
  loadPinsViewport();
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
  stopSavedRoomsRealtime();
  stopPinmapPersonalNotifications();
  S.session = null; S.room = ""; S.savedRooms = []; S.all = []; pinmapRoomContext = null; pinmapNotifications = [];
  if (S.ch) { S.sb.removeChannel(S.ch); S.ch = null; }
  cluster.clearLayers(); S.markers.clear();
  if ($("pinCount")) $("pinCount").textContent = "0";
  pinmapRenderNotifyBadge(); pinmapSetRoomButtons();
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

      // Keep the pinner name synchronized on every historical point.
      // RPC is SECURITY DEFINER so points remain renameable even after leaving an old room.
      try {
        const { error: renameErr } = await S.sb.rpc("pinmap_update_display_name", { p_username: uname });
        if (renameErr) throw renameErr;
      } catch (renameErr) {
        console.warn("pinmap_update_display_name unavailable; using direct fallback", renameErr);
        try {
          await S.sb.from("pins").update({ created_by: uname }).eq("created_by_user_id", S.session.user.id);
          await S.sb.from("pinmap_room_members").update({ username: uname }).eq("user_id", S.session.user.id);
        } catch (_) {}
      }

      // Update current browser data without another read.
      (S.all || []).forEach(p => {
        if (String(p.created_by_user_id || "") === String(S.session.user.id)) p.created_by = uname;
      });
      refreshUserUI();
      if (S.room) { await pinmapTouchRoomMember(); await pinmapLoadRoomContext(); }
      if (typeof loadPins === "function" && S.room) loadPins().catch(()=>{});
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
  if (typeof pinmapSetRoomButtons === "function") pinmapSetRoomButtons();
}

/* ── PIN MODAL ── */
function pinBuildColorSwatches(icon = "", preferred = "") {
  const wrap = $("colorSwatches");
  if (!wrap) return;
  const customInput = $("colorCustom");
  wrap.querySelectorAll(".swatch").forEach(b => b.remove());

  const special = ["m1","van"].includes(String(icon||"").toLowerCase());
  const items = special
    ? PIN_WORKFLOW_COLORS.map(x => [x.hex, x.label])
    : COLORS.map(c => [c, ""]);

  items.forEach(([c,label]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch";
    b.dataset.color = c;
    b.style.cssText = special
      ? "display:inline-flex;flex-direction:column;align-items:center;gap:4px;min-width:54px;padding:5px 4px;background:#fff;border:1px solid #ddd;border-radius:9px"
      : "";
    b.innerHTML = `<span class="swatchPin" style="background:${c};border-color:${c}"></span>${label ? `<span style="font-size:10px;font-weight:700;line-height:1.1">${label}</span>` : ""}`;
    b.onclick = () => selectColor(c);
    wrap.insertBefore(b, customInput);
  });

  if (customInput) {
    customInput.style.display = special ? "none" : "";
    customInput.oninput = () => selectColor(customInput.value);
  }

  const allowed = items.map(x => x[0].toLowerCase());
  let chosen = String(preferred || $("color")?.value || "").toLowerCase();
  if (!allowed.includes(chosen)) chosen = items[0][0];
  selectColor(chosen);
}
function populateColorSwatches() {
  pinBuildColorSwatches($("icon")?.value || "pin", $("color")?.value || COLORS[0]);
}
function selectColor(c) {
  if ($("color")) $("color").value = c;
  $("colorSwatches")?.querySelectorAll(".swatch").forEach(b => b.classList.toggle("active", String(b.dataset.color).toLowerCase() === String(c).toLowerCase()));
}
populateColorSwatches();

document.querySelectorAll(".iconBtn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".iconBtn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    $("icon").value = btn.dataset.icon;
    $("imgUploadWrap").classList.toggle("hidden", btn.dataset.icon !== "photo");
    pinBuildColorSwatches(btn.dataset.icon, $("color")?.value);
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


function setupPinAreaField() {
  if ($("area")) return;

  // Address is no longer used by Pins. Hide its form row without touching
  // competitor address fields such as s11Address/cjAddress.
  const addressInput = $("address");
  if (addressInput) {
    const row = addressInput.closest(".field, .formGroup, .form-group, label") || addressInput.parentElement;
    if (row) row.style.display = "none";
    else addressInput.style.display = "none";
  }

  const noteInput = $("note");
  if (!noteInput) return;

  const select = document.createElement("select");
  select.id = "area";
  select.innerHTML = `
    <option value="">-- เลือก Area --</option>
    <option value="มีศักยภาพ">มีศักยภาพ</option>
    <option value="ไม่มีศักยภาพ">ไม่มีศักยภาพ</option>
  `;

  // Reuse the site's existing input styling where possible.
  select.className = noteInput.className || "";

  const noteRow = noteInput.closest(".field, .formGroup, .form-group, label") || noteInput.parentElement;
  const wrap = document.createElement("div");
  wrap.className = noteRow?.className || "field";

  const label = document.createElement("label");
  label.setAttribute("for", "area");
  label.textContent = "Area";
  wrap.appendChild(label);
  wrap.appendChild(select);

  if (noteRow?.parentNode) noteRow.parentNode.insertBefore(wrap, noteRow);
  else noteInput.parentNode?.insertBefore(wrap, noteInput);
}

setupPinAreaField();

let pinmapTitleSuggestionCache={room:"",loadedAt:0,items:[]};
const PINMAP_TITLE_SUGGEST_CACHE_MS=5*60*1000;

function pinmapBaseTitle(title,pointNo){
  let t=String(title||"").trim();
  const n=Number(pointNo||0);
  if(n>=1&&n<=10){
    const rx=new RegExp("\\s*จุดที่\\s*"+n+"\\s*$","i");
    t=t.replace(rx,"").trim();
  }else{
    t=t.replace(/\s*จุดที่\s*(?:10|[1-9])\s*$/i,"").trim();
  }
  return t;
}
function pinmapDisplayTitle(base,pointNo){
  const b=String(base||"").trim();
  const n=Number(pointNo||0);
  return n>=1&&n<=10 ? `${b} จุดที่ ${n}` : b;
}
function setupPinPointNoAndTitleSuggest(){
  if($("pointNo"))return;
  const titleInput=$("title");
  if(!titleInput)return;
  const titleRow=titleInput.closest(".field, .formGroup, .form-group, label")||titleInput.parentElement;
  if(!titleRow)return;

  titleRow.style.position="relative";

  const suggest=document.createElement("div");
  suggest.id="pinTitleSuggest";
  suggest.style.cssText="display:none;position:absolute;left:0;right:0;top:100%;z-index:100000;background:#fff;border:1px solid #d1d5db;border-radius:9px;box-shadow:0 8px 24px rgba(0,0,0,.18);max-height:180px;overflow:auto;margin-top:4px";
  titleRow.appendChild(suggest);

  const wrap=document.createElement("div");
  wrap.className=titleRow.className||"field";
  const label=document.createElement("label");
  label.setAttribute("for","pointNo");
  label.textContent="จุดที่";
  const select=document.createElement("select");
  select.id="pointNo";
  select.className=titleInput.className||"";
  select.innerHTML='<option value="">-- ไม่ระบุ --</option>'+Array.from({length:10},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join("");
  wrap.appendChild(label);wrap.appendChild(select);
  titleRow.parentNode.insertBefore(wrap,titleRow.nextSibling);

  titleInput.setAttribute("autocomplete","off");
  titleInput.addEventListener("input",()=>renderPinTitleSuggestions(titleInput.value));
  titleInput.addEventListener("focus",()=>renderPinTitleSuggestions(titleInput.value));
  titleInput.addEventListener("keydown",e=>{
    if(e.key==="Escape")suggest.style.display="none";
  });
  document.addEventListener("click",e=>{
    if(!titleRow.contains(e.target))suggest.style.display="none";
  });
}
async function loadPinTitleSuggestions(force=false){
  if(!S.sb||!S.room)return [];
  const fresh=!force&&pinmapTitleSuggestionCache.room===S.room&&(Date.now()-pinmapTitleSuggestionCache.loadedAt)<PINMAP_TITLE_SUGGEST_CACHE_MS;
  if(fresh)return pinmapTitleSuggestionCache.items;
  try{
    const {data,error}=await S.sb.from("pins").select("title,point_no").eq("room",S.room).limit(5000);
    if(error)throw error;
    const seen=new Set(),items=[];
    (data||[]).forEach(p=>{
      const base=pinmapBaseTitle(p.title,p.point_no);
      const k=base.toLocaleLowerCase("th");
      if(base&&!seen.has(k)){seen.add(k);items.push(base)}
    });
    items.sort((a,b)=>a.localeCompare(b,"th"));
    pinmapTitleSuggestionCache={room:S.room,loadedAt:Date.now(),items};
    return items;
  }catch(err){
    console.warn("โหลดคำแนะนำชื่อจุดไม่สำเร็จ",err);
    // fallback from points already present on the map
    const seen=new Set(),items=[];
    (S.all||[]).forEach(p=>{
      const base=pinmapBaseTitle(p.title,p.point_no),k=base.toLocaleLowerCase("th");
      if(base&&!seen.has(k)){seen.add(k);items.push(base)}
    });
    return items;
  }
}
async function renderPinTitleSuggestions(value){
  const box=$("pinTitleSuggest");if(!box)return;
  const q=String(value||"").trim().toLocaleLowerCase("th");
  if(!q){box.style.display="none";return}
  const all=await loadPinTitleSuggestions();
  const matches=all.filter(x=>x.toLocaleLowerCase("th").includes(q)).slice(0,12);
  if(!matches.length){box.style.display="none";return}
  box.innerHTML=matches.map(x=>`<button type="button" data-pin-title="${esc(x)}" style="display:block;width:100%;border:0;border-bottom:1px solid #eee;background:#fff;text-align:left;padding:9px 10px;cursor:pointer;font:inherit">${esc(x)}</button>`).join("");
  box.querySelectorAll("[data-pin-title]").forEach(b=>b.onclick=()=>{
    $("title").value=b.dataset.pinTitle||"";
    box.style.display="none";
    $("title").focus();
  });
  box.style.display="block";
}
setupPinPointNoAndTitleSuggest();

function openModal(p = null, latlng = null) {
  S.editing = p;
  S.pending = latlng || (p ? { lat: p.lat, lng: p.lng } : null);
  if (!S.pending) return;
  if ($("modalTitle")) $("modalTitle").textContent = p ? "แก้ไขจุด" : "เพิ่มจุด";
  if ($("title")) $("title").value = p ? pinmapBaseTitle(p.title,p.point_no) : "";
  if ($("pointNo")) $("pointNo").value = p?.point_no ? String(p.point_no) : "";
  $("pinTitleSuggest") && ($("pinTitleSuggest").style.display="none");
  loadPinTitleSuggestions().catch(()=>{});
  if ($("note")) $("note").value = p?.note || "";
  if ($("area")) $("area").value = p?.area || "";
  const icon = p?.icon || "pin";
  document.querySelectorAll(".iconBtn").forEach(b => b.classList.toggle("active", b.dataset.icon === icon));
  $("icon").value = icon;
  pinBuildColorSwatches(icon, p?.color || COLORS[0]);
  const activeLogoBtn = document.querySelector(`.iconBtn[data-icon="${CSS.escape(icon)}"]`);
  activeLogoBtn?.classList.add("active");
  $("iconImg").value = "";
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
    const baseTitle = ($("title")?.value || "").trim();
    if (!baseTitle) return toast("กรุณาใส่ชื่อจุด");
    const pointNoRaw = ($("pointNo")?.value || "").trim();
    const pointNo = pointNoRaw ? Number(pointNoRaw) : null;
    const title = pinmapDisplayTitle(baseTitle, pointNo);
    const autoAddress = window.pinmapAdminAddressFromLatLng
      ? await window.pinmapAdminAddressFromLatLng(S.pending.lat, S.pending.lng)
      : "";
    const payload = {
      room: S.room,
      title,
      point_no: pointNo,
      address: autoAddress,
      note: ($("note")?.value || "").trim(),
      area: ($("area")?.value || "").trim(),
      color: $("color").value,
      icon: $("icon").value,
      lat: S.pending.lat,
      lng: S.pending.lng,
      // Latest actor becomes the displayed pinner/responsible user for this point.
      // Also reuse created_at as "last action time" so no new DB column/query is needed.
      created_by: username(),
      created_by_user_id: S.session.user.id,
      created_at: new Date().toISOString()
    };
    $("save").disabled = true;
    try {
      let savedRow=null;
      if (S.editing) {
        const { data, error } = await S.sb.from("pins")
          .update(payload).eq("id", S.editing.id)
          .select(PINMAP_PIN_SELECT).single();
        if (error) throw error;
        savedRow=data;
      } else {
        const { data, error } = await S.sb.from("pins")
          .insert(payload)
          .select(PINMAP_PIN_SELECT).single();
        if (error) throw error;
        savedRow=data;
      }
      // Apply just this one row locally. This replaces the old post-save loadPins()
      // (which could re-download up to 200 viewport rows every save).
      if(savedRow) applyPinRealtimeDelta({eventType:S.editing?"UPDATE":"INSERT",new:savedRow,old:S.editing||{}});
      closeModal();
      if (coordinateSearchMarker) {
        map.removeLayer(coordinateSearchMarker);
        coordinateSearchMarker = null;
      }
      toast("บันทึกจุดแล้ว");
      pinmapTitleSuggestionCache.loadedAt=0;
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
      const deletedId=S.editing.id;
      const { error } = await S.sb.from("pins").delete().eq("id", deletedId);
      if (error) throw error;
      // Remove only this row locally; existing Realtime will dedupe the same DELETE.
      applyPinRealtimeDelta({eventType:"DELETE",old:{id:deletedId,room:S.room}});
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
                e.latlng.lng,

              is_custom: true
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
        rec.is_custom = true;
        fastRefreshS11(rec);
        toast("ย้ายจุด 7-Eleven แล้ว");
        /* no full competitor reload: Realtime delta keeps data in sync */
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
                e.latlng.lng,

              is_custom: true
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
        rec.is_custom = true;
        fastRefreshCJ(rec);
        toast("ย้ายจุด CJ MORE แล้ว");
        /* no full competitor reload: Realtime delta keeps data in sync */
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
let pinmapTableRows = [];
function renderTable(rows = S.all) {
  pinmapTableRows = rows || [];
  const body = $("tableBody");
  if (!body) return;
  if (!pinmapTableRows.length) {
    body.innerHTML = `<div class="tableEmpty">ยังไม่มีจุดในห้องนี้</div>`;
    return;
  }
  body.innerHTML = `<table class="pinTable"><thead><tr><th>ชื่อจุด</th><th>จุดที่</th><th>Address</th><th>Area</th><th>สี</th><th>ชื่อโลโก้</th><th>ดำเนินการล่าสุดโดย</th><th>วันที่/เวลาล่าสุด</th></tr></thead><tbody>
    ${pinmapTableRows.map(p => `<tr data-id="${p.id}"><td>${esc(p.title)}</td><td>${esc(p.point_no || "")}</td><td>${esc(p.address || "")}</td><td>${esc(p.area || "")}</td><td><span style="display:inline-block;width:14px;height:14px;border-radius:50%;vertical-align:middle;background:${esc(p.color || "#ef4444")}"></span></td><td>${esc(pinStatusName(p.icon))}</td><td>${esc(p.created_by || "")}</td><td>${esc(p.created_at ? new Date(p.created_at).toLocaleString("th-TH") : "")}</td></tr>`).join("")}
  </tbody></table>`;
  body.querySelectorAll("tr[data-id]").forEach(row => {
    row.onclick = () => {
      const p = pinmapTableRows.find(x => String(x.id) === row.dataset.id);
      if (!p) return;
      map.setView([p.lat, p.lng], 17);
      const m = S.markers.get(p.id);
      if (m) m.openPopup();
      $("tablePanel").classList.add("hidden");
    };
  });
}
const doTableToggle = async () => {
  if (!S.room) return toast("กรุณาเข้าห้องก่อน");

  const panel = $("tablePanel");
  const opening = panel?.classList.contains("hidden");
  if (!opening) {
    panel.classList.add("hidden");
    return;
  }

  try {
    const rows = await fetchAllPinsRoom();
    await pinmapHydratePinAddresses(rows);
    renderTable(rows);
    panel?.classList.remove("hidden");
  } catch (err) {
    toast(err.message || "โหลดตารางไม่สำเร็จ");
  }
};
if ($("tableToggle")) $("tableToggle").onclick = doTableToggle;
if ($("mTableToggle")) $("mTableToggle").onclick = () => { closeMobileMenu(); doTableToggle(); };
if ($("mQuickTable")) $("mQuickTable").onclick = doTableToggle;
if ($("tableClose")) $("tableClose").onclick = () => $("tablePanel").classList.add("hidden");

/* =========================================================
   PINMAP DASHBOARD
   - Counts only user Pins in the current room.
   - Excludes competitor-logo pins.
   - Province / district / tambon are derived from pin coordinates
     against the already loaded administrative GeoJSON.
   ========================================================= */
(function setupPinmapDashboard(){
  if (document.getElementById("pinmapDashboardPanel")) return;

  const DASH_EXCLUDED_ICONS = new Set([
    "seven11","7eleven","7-11","cjmore","cj","tops","thukdee","ถูกดี",
    "bigcmini","bigc","lawson108","lawson","lotusgo","lotus","makro","lotusmakro"
  ]);
  const DASH_ICON_NAMES = {
    pin:"Survey",m1:"M1",cjx:"CJX",van:"รถตู้",deal:"เจรจรา",find:"ตามหา",x:"ไม่ให้เช่า",
    decision:"Decision",star:"Star",heart:"Heart",flag:"Flag",home:"Home",food:"Food",
    shop:"Shop",hotel:"Hotel",photo:"Photo"
  };

  let dashRows=[], dashData=[], dashRoom="", dashLoadedAt=0;
  const DASH_CACHE_MS = 5 * 60 * 1000;
  const DASH_PIN_SELECT = "id,lat,lng,area,icon,color,point_no,title,created_by,created_at";
  let dashProvince="", dashDistrict="", dashTambon="", dashIcon="", dashArea="", dashPointNo="", dashPinner="";
  const geoCache=new Map();

  const st=document.createElement("style");
  st.id="pinmapDashboardStyle";
  st.textContent=`
    .pinmap-dashboard-btn.active{background:#111!important;color:#fff!important}
    #pinmapDashboardPanel{
      position:absolute;z-index:5000;right:14px;top:86px;bottom:16px;width:560px;
      min-width:360px;max-width:min(80vw,980px);background:rgba(255,255,255,.985);
      border:1px solid #ddd;border-radius:16px;box-shadow:0 10px 35px rgba(0,0,0,.22);
      overflow:hidden;display:flex;flex-direction:column;font-family:inherit
    }
    #pinmapDashboardPanel.hidden{display:none!important}

    /* Dashboard must stay above map floating controls on both desktop and mobile. */
    #pinmapDashboardPanel{z-index:2147483000!important}
    body.pinmap-dashboard-open #pinmapAllPointsEyeBtn,
    body.pinmap-dashboard-open #pinmapRulerBtn,
    body.pinmap-dashboard-open #locateBtn,
    body.pinmap-dashboard-open #mLocateBtn,
    body.pinmap-dashboard-open #mCompetitorBtn,
    body.pinmap-dashboard-open #competitorBtn,
    body.pinmap-dashboard-open .leaflet-control-zoom,
    body.pinmap-dashboard-open .pinmap-basemap-control,
    body.pinmap-dashboard-open .leaflet-bottom.leaflet-right{
      z-index:1!important;
    }
    @media(max-width:767px){
      /* On mobile these floating controls sit inside the Dashboard footprint.
         Hide them while Dashboard is open so nothing can cover the panel. */
      body.pinmap-dashboard-open #pinmapAllPointsEyeBtn,
      body.pinmap-dashboard-open #pinmapRulerBtn,
      body.pinmap-dashboard-open #locateBtn,
      body.pinmap-dashboard-open #mLocateBtn,
      body.pinmap-dashboard-open #mCompetitorBtn,
      body.pinmap-dashboard-open #competitorBtn,
      body.pinmap-dashboard-open .leaflet-control-zoom,
      body.pinmap-dashboard-open .pinmap-basemap-control,
      body.pinmap-dashboard-open .leaflet-bottom.leaflet-right{
        visibility:hidden!important;
        pointer-events:none!important;
      }
      #pinmapDashboardPanel{
        z-index:2147483000!important;
      }
    }


    .pinmap-dashboard-open #pinmapAllPointsEyeBtn,
    .pinmap-dashboard-open #pinmapRulerBtn,
    .pinmap-dashboard-open #locateBtn,
    .pinmap-dashboard-open #mCompetitorBtn,
    .pinmap-dashboard-open #competitorBtn,
    .pinmap-dashboard-open .leaflet-control-zoom,
    .pinmap-dashboard-open .pinmap-basemap-control,
    .pinmap-dashboard-open .leaflet-bottom.leaflet-right{
      z-index:1200 !important;
    }

    .pmd-resize{position:absolute;left:-5px;top:0;bottom:0;width:11px;cursor:ew-resize;touch-action:none;z-index:4}
    .pmd-head{flex:0 0 auto;padding:14px 15px 11px;border-bottom:1px solid #e7e7e7;display:flex;align-items:center;gap:10px;background:#fff}
    .pmd-title{font-size:17px;font-weight:800;flex:1}
    .pmd-close{width:34px;height:34px;border:0;border-radius:9px;background:#f1f1f1;font-size:20px;cursor:pointer}
    .pmd-export{border:0;border-radius:9px;background:#111;color:#fff;padding:9px 11px;font:inherit;font-size:11px;font-weight:800;cursor:pointer;white-space:nowrap}.pmd-export:hover{opacity:.88}
    .pmd-body{overflow:auto;padding:13px 14px 18px}
    .pmd-body img{max-width:24px!important;max-height:24px!important;width:auto!important;height:auto!important;object-fit:contain!important}
    .pmd-note{font-size:11px;color:#6b7280;line-height:1.45;margin:0 0 10px}
    .pmd-filters{display:grid;grid-template-columns:repeat(auto-fit,minmax(135px,1fr));gap:7px;margin-bottom:12px}
    .pmd-select{width:100%;min-width:0;padding:8px 9px;border:1px solid #d1d5db;border-radius:9px;background:#fff;font:inherit;font-size:12px}
    .pmd-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:13px}
    .pmd-kpi{background:#f6f7f8;border-radius:11px;padding:10px 9px;min-width:0}
    .pmd-kpi-v{font-size:20px;font-weight:900;line-height:1.15}
    .pmd-kpi-l{font-size:10px;color:#6b7280;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pmd-section{margin:13px 0 5px;font-weight:800;font-size:13px}
    .pmd-icon-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(105px,1fr));gap:7px}
    .pmd-icon-card{border:1px solid #e5e7eb;background:#fff;border-radius:12px;padding:9px 7px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;min-width:0;text-align:center}
    .pmd-icon-card.active{outline:2px solid #111}
    .pmd-icon-pic{width:38px;height:38px;border-radius:10px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;overflow:hidden;flex:0 0 auto;font-size:20px}
    .pmd-icon-pic img{max-width:22px!important;max-height:22px!important}
    .pmd-icon-num{font-size:17px;font-weight:900;line-height:1.05}
    .pmd-icon-name{font-size:10px;color:#374151;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
    .pmd-color-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:7px;margin-top:6px}
    .pmd-color-card{display:flex;align-items:center;gap:8px;border:1px solid #e5e7eb;border-radius:10px;padding:8px;background:#fff;min-width:0}
    .pmd-color-dot{width:21px;height:21px;border-radius:50%;border:2px solid rgba(0,0,0,.15);box-shadow:0 0 0 2px #fff inset;flex:0 0 auto}
    .pmd-color-num{font-size:15px;font-weight:900;line-height:1}
    .pmd-color-name{font-size:9px;color:#6b7280;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pmd-mini-icon{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;vertical-align:middle;overflow:hidden;border-radius:6px;background:#f6f7f8;margin-right:3px}
    .pmd-mini-icon img{max-width:18px!important;max-height:18px!important}
    .pmd-chart-grid{display:grid;grid-template-columns:1fr 1.25fr;gap:10px}
    .pmd-card{border:1px solid #e5e7eb;border-radius:12px;background:#fff;padding:11px;min-width:0}
    .pmd-card-title{font-weight:800;font-size:12px;margin-bottom:8px}
    .pmd-donut-wrap{display:flex;gap:11px;align-items:center}
    .pmd-donut{width:102px;height:102px;border-radius:50%;position:relative;flex:0 0 auto}
    .pmd-donut:after{content:"";position:absolute;inset:25px;background:#fff;border-radius:50%}
    .pmd-legend{min-width:0;flex:1;font-size:10px;line-height:1.55}
    .pmd-legend-row{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dotted #eee}
    .pmd-bars{display:flex;flex-direction:column;gap:7px}
    .pmd-bar-row{display:grid;grid-template-columns:110px 1fr 34px;gap:6px;align-items:center;font-size:10px}
    .pmd-bar-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .pmd-bar-track{height:8px;background:#eee;border-radius:999px;overflow:hidden}
    .pmd-bar-fill{height:100%;background:#111;border-radius:999px}
    .pmd-bar-val{text-align:right;font-weight:800}
    .pmd-table-wrap{overflow:auto;border:1px solid #e5e7eb;border-radius:11px}
    .pmd-table{border-collapse:collapse;width:100%;font-size:10px;white-space:nowrap}
    .pmd-table th,.pmd-table td{padding:7px 8px;border-bottom:1px solid #eee;text-align:center;vertical-align:middle}
    .pmd-table th:first-child,.pmd-table td:first-child{text-align:left;position:sticky;left:0;background:#fff}
    .pmd-table th{background:#f8f8f8;font-weight:800;position:sticky;top:0;z-index:1}
    .pmd-empty{padding:30px 10px;text-align:center;color:#777;font-size:12px}
    .pmd-status{font-size:11px;color:#666;margin:6px 0 10px}
    @media(max-width:900px){.pmd-filters{grid-template-columns:1fr 1fr}}
    @media(max-width:767px){
      #pinmapDashboardPanel{
        top:76px;
        right:7px;
        bottom:calc(86px + env(safe-area-inset-bottom));
        width:calc(100% - 14px)!important;
        min-width:0;
        max-width:none;
        max-height:calc(100dvh - 172px - env(safe-area-inset-bottom));
        border-radius:14px;
      }
      #pinmapDashboardPanel .pmd-body{
        padding-bottom:24px!important;
        overscroll-behavior:contain;
      }
      #pinmapDashboardPanel .pmd-table-wrap{
        margin-bottom:10px;
      }
      .pmd-resize{display:none}.pmd-filters{grid-template-columns:1fr 1fr}.pmd-kpis{grid-template-columns:1fr 1fr}.pmd-chart-grid{grid-template-columns:1fr}
      .pmd-title{font-size:14px}.pmd-export{padding:8px 9px;font-size:10px}
    }
  `;
  document.head.appendChild(st);

  function makeBtn(baseId,id,mobile){
    const base=$(baseId);
    if(!base||$(id)) return;
    const b=base.cloneNode(false);
    b.id=id;
    b.classList.add("pinmap-dashboard-btn");
    b.innerHTML="📊 Dashboard";
    base.insertAdjacentElement("afterend",b);
    b.onclick=()=>{if(mobile&&typeof closeMobileMenu==="function")closeMobileMenu();toggleDash()};
  }
  makeBtn("tableToggle","dashboardToggle",false);
  makeBtn("mTableToggle","mDashboardToggle",true);

  const panel=document.createElement("section");
  panel.id="pinmapDashboardPanel";
  panel.className="hidden";
  panel.innerHTML=`
    <div class="pmd-resize" id="pmdResize"></div>
    <div class="pmd-head">
      <div class="pmd-title">📊 Dashboard จุดที่ปัก</div>
      <button class="pmd-export" id="pmdExportDashboard" type="button">⬇ Export Dashboard (.xlsx)</button>
      <button class="pmd-close" id="pmdClose" type="button">×</button>
    </div>
    <div class="pmd-body">
      <div class="pmd-note">นับเฉพาะจุดที่ผู้ใช้ปักในห้องปัจจุบัน ไม่รวมจุดคู่แข่ง • Dashboard อัปเดตจาก Realtime โดยไม่ query ซ้ำ • cache 5 นาทีเป็น fallback เพื่อลด Egress</div>
      <div class="pmd-filters">
        <select id="pmdProvince" class="pmd-select"><option value="">ทุกจังหวัด</option></select>
        <select id="pmdDistrict" class="pmd-select"><option value="">ทุกอำเภอ/เขต</option></select>
        <select id="pmdTambon" class="pmd-select"><option value="">ทุกตำบล/แขวง</option></select>
        <select id="pmdIcon" class="pmd-select"><option value="">ทุกประเภทหมุด</option></select>
        <select id="pmdArea" class="pmd-select">
          <option value="">ทุก Area</option>
          <option value="มีศักยภาพ">มีศักยภาพ</option>
          <option value="ไม่มีศักยภาพ">ไม่มีศักยภาพ</option>
        </select>
        <select id="pmdPointNo" class="pmd-select">
          <option value="">ทุกจุดที่</option>
          <option value="1">จุดที่ 1</option><option value="2">จุดที่ 2</option><option value="3">จุดที่ 3</option>
          <option value="4">จุดที่ 4</option><option value="5">จุดที่ 5</option><option value="6">จุดที่ 6</option>
          <option value="7">จุดที่ 7</option><option value="8">จุดที่ 8</option><option value="9">จุดที่ 9</option><option value="10">จุดที่ 10</option>
        </select>
        <select id="pmdPinner" class="pmd-select"><option value="">ทุกคนปัก</option></select>
      </div>
      <div id="pmdStatus" class="pmd-status"></div>
      <div id="pmdContent"></div>
    </div>`;
  map.getContainer().appendChild(panel);
  L.DomEvent.disableClickPropagation(panel);
  L.DomEvent.disableScrollPropagation(panel);

  $("pmdClose").onclick=()=>setOpen(false);
  $("pmdProvince").onchange=e=>{
    dashProvince=e.target.value;dashDistrict="";dashTambon="";
    refreshDistricts();refreshTambons();renderDash();
  };
  $("pmdDistrict").onchange=e=>{
    dashDistrict=e.target.value;dashTambon="";
    refreshTambons();renderDash();
  };
  $("pmdTambon").onchange=e=>{dashTambon=e.target.value;renderDash()};
  $("pmdIcon").onchange=e=>{dashIcon=e.target.value;pinmapSetDashboardIconMapFilter(dashIcon);renderDash()};
  $("pmdArea").onchange=e=>{dashArea=e.target.value;renderDash()};
  $("pmdPointNo").onchange=e=>{dashPointNo=e.target.value;renderDash()};
  $("pmdPinner").onchange=e=>{dashPinner=e.target.value;renderDash()};

  const rh=$("pmdResize");
  rh.addEventListener("pointerdown",e=>{
    if(matchMedia("(max-width:767px)").matches)return;
    e.preventDefault();rh.setPointerCapture(e.pointerId);
    const sx=e.clientX,sw=panel.getBoundingClientRect().width;
    const mv=ev=>{
      const mw=Math.min(innerWidth*.80,980);
      panel.style.width=Math.round(Math.max(360,Math.min(mw,sw+(sx-ev.clientX))))+"px";
    };
    const up=ev=>{
      rh.releasePointerCapture?.(ev.pointerId);
      rh.removeEventListener("pointermove",mv);
      rh.removeEventListener("pointerup",up);
      rh.removeEventListener("pointercancel",up);
    };
    rh.addEventListener("pointermove",mv);
    rh.addEventListener("pointerup",up);
    rh.addEventListener("pointercancel",up);
  });

  function setOpen(on){
    panel.classList.toggle("hidden",!on);
    $("dashboardToggle")?.classList.toggle("active",on);
    $("mDashboardToggle")?.classList.toggle("active",on);
    map.getContainer().classList.toggle("pinmap-dashboard-open", !!on);
    document.body.classList.toggle("pinmap-dashboard-open", !!on);
    // Keep the current Dashboard logo filter on the map after closing Dashboard.
    // Competitor layers are unaffected.
  }
  async function toggleDash(){
    if(!S.room)return toast("กรุณาเข้าห้องก่อน");
    if(!panel.classList.contains("hidden")){setOpen(false);return}
    setOpen(true);await loadDash();
  }

  const ni=v=>String(v||"pin").trim().toLowerCase();
  const excluded=p=>DASH_EXCLUDED_ICONS.has(ni(p?.icon));
  function iconVisual(i){
    const k=ni(i);
    if(typeof PIN_LOGOS!=="undefined"&&PIN_LOGOS[k])return `<img src="${esc(PIN_LOGOS[k])}" alt="">`;
    if(typeof ICONS!=="undefined"&&ICONS[k])return esc(ICONS[k]);
    return "📍";
  }
  const iconName=i=>DASH_ICON_NAMES[ni(i)]||pinStatusName(i)||"Survey";

  function inRing(x,y,r){
    let inside=false;
    if(!Array.isArray(r))return false;
    for(let i=0,j=r.length-1;i<r.length;j=i++){
      const a=r[i],b=r[j];if(!a||!b)continue;
      const xi=+a[0],yi=+a[1],xj=+b[0],yj=+b[1];
      if(((yi>y)!==(yj>y))&&(x<(xj-xi)*(y-yi)/((yj-yi)||1e-12)+xi))inside=!inside;
    }
    return inside;
  }
  function inPoly(x,y,p){
    if(!p?.length||!inRing(x,y,p[0]))return false;
    for(let i=1;i<p.length;i++)if(inRing(x,y,p[i]))return false;
    return true;
  }
  function inGeom(x,y,g){
    if(!g)return false;
    if(g.type==="Polygon")return inPoly(x,y,g.coordinates);
    if(g.type==="MultiPolygon")return (g.coordinates||[]).some(p=>inPoly(x,y,p));
    return false;
  }

  function cleanText(v){
    const s=String(v??"").trim();
    if(!s || /^[-+]?\d+([.,]\d+)?$/.test(s)) return "";
    return s;
  }
  function directProp(props,keys){
    for(const k of keys){
      const v=cleanText(props?.[k]);
      if(v)return v;
    }
    return "";
  }
  function fuzzyProp(props,type){
    const entries=Object.entries(props||{});
    const rules={
      province:/(PROV|CHANGWAT|CHANG|ADM.?1|P_?NAME|จังหวัด)/i,
      district:/(AMP|AMPH|DISTRICT|KHET|ADM.?2|A_?NAME|อำเภอ|เขต)/i,
      tambon:/(TAM|TAMBON|TMB|SUB.?DIST|KHWAENG|ADM.?3|T_?NAME|ตำบล|แขวง)/i
    };
    const nameHint=/(NAME|NAMT|TH|TEXT|LABEL|NOM|ชื่อ)/i;
    let fallback="";
    for(const [k,v0] of entries){
      if(!rules[type].test(k))continue;
      const v=cleanText(v0);if(!v)continue;
      if(nameHint.test(k))return v;
      if(!fallback)fallback=v;
    }
    return fallback;
  }
  function adminName(props,type){
    const keys={
      province:["PROV_NAMT","PROV_NAME","PROVINCE","CHANGWAT","ADM1_TH","NAME_1","P_NAME_T","P_NAMT","PV_NAME","NAME_TH"],
      district:["AMP_NAMT","AMP_NAM_T","AMPHOE_T","AMPHOE","A_NAME_T","A_NAMT","DISTRICT","DISTRICT_T","ADM2_TH","NAME_2","AMP_NAME","AMP_NAME_T","KHET_NAME"],
      tambon:["T_NAME_T","T_NAMT","TAMBON_T","TAMBON","TAM_NAMT","TB_NAME","SUBDISTRICT","SUBDISTRICT_T","ADM3_TH","NAME_3","KHWAENG"]
    };
    return directProp(props,keys[type])||fuzzyProp(props,type);
  }

  function locate(p){
    const key=`${(+p.lat).toFixed(6)},${(+p.lng).toFixed(6)}`;
    if(geoCache.has(key))return geoCache.get(key);
    const y=+p.lat,x=+p.lng;
    let province="",district="",tambon="";

    // Province: spatial join directly against province polygons.
    const provFeatures=window.PINMAP_PROVINCE_BOUNDARIES?.features||[];
    const provLabels=window.PINMAP_PROVINCE_LABELS||[];
    for(let i=0;i<provFeatures.length;i++){
      const f=provFeatures[i];
      if(!inGeom(x,y,f.geometry))continue;
      province=adminName(f.properties||{},"province")||cleanText(provLabels[i]);
      break;
    }

    // District/Amphoe: spatial join directly against the uploaded Amphoe polygons.
    const ampFeatures=window.PINMAP_AMPHOE_BOUNDARIES?.features||[];
    for(let i=0;i<ampFeatures.length;i++){
      const f=ampFeatures[i];
      if(!inGeom(x,y,f.geometry))continue;
      district=cleanText(f?.properties?.AMP_NAME_T)||cleanText(f?.properties?.AMP_NAME_E);
      break;
    }

    // Tambon polygon supplies the tambon/subdistrict name.
    const tamFeatures=window.PINMAP_TAMBON_BOUNDARIES?.features||[];
    const tamLabels=window.PINMAP_TAMBON_LABELS||[];
    for(let i=0;i<tamFeatures.length;i++){
      const f=tamFeatures[i];
      if(!inGeom(x,y,f.geometry))continue;
      const q=f.properties||{};
      tambon=adminName(q,"tambon")||cleanText(tamLabels[i]);
      if(!province)province=adminName(q,"province");
      if(!district)district=adminName(q,"district");
      break;
    }

    const v={
      province:province||"ไม่ทราบจังหวัด",
      district:district||"ไม่ทราบอำเภอ/เขต",
      tambon:tambon||"ไม่ทราบตำบล/แขวง"
    };
    geoCache.set(key,v);
    return v;
  }

  // Shared coordinate -> address helper for Pins and competitor points.
  window.pinmapAdminLocationFromLatLng = async function(lat, lng){
    try { await ensureAmphoeBoundaryData(); } catch (_) {}
    return locate({lat:Number(lat), lng:Number(lng)});
  };
  window.pinmapAdminAddressFromLatLng = async function(lat, lng){
    const a = await window.pinmapAdminLocationFromLatLng(lat, lng);
    const parts = [];
    if (a?.province && a.province !== "ไม่ทราบจังหวัด") parts.push(`จังหวัด ${a.province}`);
    if (a?.district && a.district !== "ไม่ทราบอำเภอ/เขต") parts.push(`อำเภอ/เขต ${a.district}`);
    if (a?.tambon && a.tambon !== "ไม่ทราบตำบล/แขวง") parts.push(`ตำบล/แขวง ${a.tambon}`);
    return parts.join(" • ");
  };

  const uniq=a=>[...new Set(a.filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),"th"));
  function opts(sel,vals,label,current=""){
    sel.innerHTML=`<option value="">${label}</option>`+vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("");
    sel.value=vals.includes(current)?current:"";
  }
  function refreshDistricts(){
    const pool=dashProvince?dashData.filter(x=>x.province===dashProvince):dashData;
    const vals=uniq(pool.map(x=>x.district));
    opts($("pmdDistrict"),vals,"ทุกอำเภอ/เขต",dashDistrict);
    dashDistrict=$("pmdDistrict").value||"";
  }
  function refreshTambons(){
    let pool=dashData;
    if(dashProvince)pool=pool.filter(x=>x.province===dashProvince);
    if(dashDistrict)pool=pool.filter(x=>x.district===dashDistrict);
    const vals=uniq(pool.map(x=>x.tambon));
    opts($("pmdTambon"),vals,"ทุกตำบล/แขวง",dashTambon);
    dashTambon=$("pmdTambon").value||"";
  }
  function populate(){
    opts($("pmdProvince"),uniq(dashData.map(x=>x.province)),"ทุกจังหวัด",dashProvince);
    opts($("pmdIcon"),uniq(dashData.map(x=>x._dashIcon)),"ทุกประเภทหมุด",dashIcon);
    opts($("pmdPinner"),uniq(dashData.map(x=>x.created_by)),"ทุกคนปัก",dashPinner);
    refreshDistricts();refreshTambons();
  }

  async function fetchDashboardPinsRoom(){
    if(!S.sb || !S.room) return [];
    const all=[];
    const pageSize=2000;
    for(let from=0;;from+=pageSize){
      const {data,error}=await S.sb
        .from("pins")
        .select(DASH_PIN_SELECT)
        .eq("room",S.room)
        .order("id",{ascending:true})
        .range(from,from+pageSize-1);
      if(error) throw error;
      if(data?.length) all.push(...data);
      if(!data || data.length<pageSize) break;
    }
    return all;
  }

  // Incremental Dashboard cache sync. Reuses the existing Pins Realtime event;
  // it does NOT issue another Supabase SELECT. The 5-minute full refresh stays
  // only as a fallback/reconciliation when the Dashboard is opened later.
  function dashboardRebuildFromCache(renderIfOpen=true){
    dashData=dashRows.filter(p=>!excluded(p)).map(p=>({...p,...locate(p),_dashIcon:ni(p.icon)}));
    populate();
    if(renderIfOpen && !panel.classList.contains("hidden")) renderDash();
    const status=$("pmdStatus");
    if(status && !panel.classList.contains("hidden")){
      const knownP=dashData.filter(x=>x.province!=="ไม่ทราบจังหวัด").length;
      const knownD=dashData.filter(x=>x.district!=="ไม่ทราบอำเภอ/เขต").length;
      const knownT=dashData.filter(x=>x.tambon!=="ไม่ทราบตำบล/แขวง").length;
      status.textContent=`${dashData.length.toLocaleString("th-TH")} จุด • จังหวัด ${knownP.toLocaleString("th-TH")} / อำเภอ ${knownD.toLocaleString("th-TH")} / ตำบล ${knownT.toLocaleString("th-TH")} • Realtime + cache 5 นาที`;
    }
  }

  window.pinmapDashboardApplyPinDelta=function(payload){
    try{
      if(!payload || !S.room || dashRoom!==S.room || !dashLoadedAt) return;
      const eventType=String(payload.eventType||"").toUpperCase();
      if(eventType==="DELETE"){
        const id=payload?.old?.id;
        if(id==null) return;
        const before=dashRows.length;
        dashRows=dashRows.filter(p=>String(p.id)!==String(id));
        if(dashRows.length!==before) dashboardRebuildFromCache(true);
        return;
      }
      const row=payload?.new;
      if(!row || String(row.room)!==String(S.room) || row.id==null) return;
      const slim={
        id:row.id,lat:row.lat,lng:row.lng,area:row.area,icon:row.icon,color:row.color,
        point_no:row.point_no,title:row.title,created_by:row.created_by,created_at:row.created_at
      };
      const idx=dashRows.findIndex(p=>String(p.id)===String(row.id));
      if(idx>=0) dashRows[idx]={...dashRows[idx],...slim};
      else dashRows.push(slim);
      // Keep the original load timestamp. Realtime deltas keep this cache current;
      // the 5-minute age check remains a safety reconciliation on a later open.
      dashboardRebuildFromCache(true);
    }catch(err){ console.warn("Dashboard realtime cache sync failed",err); }
  };

  async function loadDash(){
    const status=$("pmdStatus"),root=$("pmdContent");
    status.textContent="กำลังคำนวณจังหวัด / อำเภอ / ตำบลจากพิกัด...";
    root.innerHTML="";
    try{
      // Make district analysis available even if the user has not toggled the Amphoe layer on.
      await ensureAmphoeBoundaryData();
      const fresh=dashRoom===S.room&&(Date.now()-dashLoadedAt)<DASH_CACHE_MS;
      if(!fresh){
        dashRows=await fetchDashboardPinsRoom();
        dashRoom=S.room;dashLoadedAt=Date.now();
        geoCache.clear();
      }
      dashData=dashRows.filter(p=>!excluded(p)).map(p=>({...p,...locate(p),_dashIcon:ni(p.icon)}));
      populate();renderDash();
      const knownP=dashData.filter(x=>x.province!=="ไม่ทราบจังหวัด").length;
      const knownD=dashData.filter(x=>x.district!=="ไม่ทราบอำเภอ/เขต").length;
      const knownT=dashData.filter(x=>x.tambon!=="ไม่ทราบตำบล/แขวง").length;
      status.textContent=`${dashData.length.toLocaleString("th-TH")} จุด • จังหวัด ${knownP.toLocaleString("th-TH")} / อำเภอ ${knownD.toLocaleString("th-TH")} / ตำบล ${knownT.toLocaleString("th-TH")} • Realtime + cache 5 นาที`;
    }catch(err){
      console.error("Dashboard error",err);
      status.textContent="";
      root.innerHTML=`<div class="pmd-empty">โหลด Dashboard ไม่สำเร็จ<br>${esc(err?.message||"")}</div>`;
    }
  }

  function rowsNow(){
    return dashData.filter(x=>
      (!dashProvince||x.province===dashProvince)&&
      (!dashDistrict||x.district===dashDistrict)&&
      (!dashTambon||x.tambon===dashTambon)&&
      (!dashIcon||x._dashIcon===dashIcon)&&
      (!dashArea||String(x.area||"")===dashArea)&&
      (!dashPointNo||String(x.point_no||"")===dashPointNo)&&
      (!dashPinner||String(x.created_by||"")===dashPinner)
    );
  }
  function countBy(rows,fn){
    const m=new Map();
    rows.forEach(r=>{const k=fn(r)||"ไม่ทราบ";m.set(k,(m.get(k)||0)+1)});
    return [...m].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||String(a.name).localeCompare(String(b.name),"th"));
  }
  function pinColor(v){
    const c=String(v||"").trim();
    return c || "#ef4444";
  }
  function colorLabel(c){
    const known={
      "#ef4444":"แดง","#f97316":"ส้ม","#eab308":"เหลือง","#22c55e":"เขียว",
      "#14b8a6":"เขียวอมฟ้า","#3b82f6":"น้ำเงิน","#8b5cf6":"ม่วง","#ec4899":"ชมพู"
    };
    return known[String(c).toLowerCase()] || c;
  }
  function colorBreakdown(rows){
    const items=countBy(rows,x=>pinColor(x.color));
    if(!items.length) return `<div class="pmd-empty">ไม่มีข้อมูลสี</div>`;
    const special = dashIcon === "m1" || dashIcon === "van";
    return `<div class="pmd-color-grid">${items.map(x=>`
      <div class="pmd-color-card">
        <span class="pmd-color-dot" style="background:${esc(x.name)}"></span>
        <span style="min-width:0">
          <div class="pmd-color-num">${x.count.toLocaleString("th-TH")}</div>
          <div class="pmd-color-name">${esc(special ? (pinWorkflowLabel(x.name) || colorLabel(x.name)) : colorLabel(x.name))}</div>
        </span>
      </div>`).join("")}</div>`;
  }

  function donut(items,total){
    if(!total)return `<div class="pmd-empty">ไม่มีข้อมูล</div>`;
    const pal=["#111827","#2563eb","#16a34a","#f59e0b","#dc2626","#7c3aed","#0891b2","#db2777","#64748b","#84cc16"];
    let cur=0;
    const parts=items.map((v,i)=>{const a=cur/total*360;cur+=v.count;return `${pal[i%pal.length]} ${a}deg ${cur/total*360}deg`});
    return `<div class="pmd-donut-wrap"><div class="pmd-donut" style="background:conic-gradient(${parts.join(",")})"></div><div class="pmd-legend">${items.slice(0,8).map(v=>`<div class="pmd-legend-row"><span>${esc(iconName(v.name))}</span><b>${v.count.toLocaleString("th-TH")}</b></div>`).join("")}</div></div>`;
  }
  function bars(items){
    const a=items.slice(0,10),mx=Math.max(1,...a.map(x=>x.count));
    if(!a.length)return `<div class="pmd-empty">ไม่มีข้อมูล</div>`;
    return `<div class="pmd-bars">${a.map(x=>`<div class="pmd-bar-row"><div class="pmd-bar-name" title="${esc(x.name)}">${esc(x.name)}</div><div class="pmd-bar-track"><div class="pmd-bar-fill" style="width:${Math.max(2,x.count/mx*100)}%"></div></div><div class="pmd-bar-val">${x.count.toLocaleString("th-TH")}</div></div>`).join("")}</div>`;
  }
  function breakdown(rows,icons){
    const m=new Map();
    rows.forEach(r=>{
      const k=r.province+"|||"+r.district+"|||"+r.tambon;
      if(!m.has(k))m.set(k,{province:r.province,district:r.district,tambon:r.tambon,total:0,potential:0,noPotential:0,icons:{}});
      const g=m.get(k);g.total++;
      if(r.area==="มีศักยภาพ")g.potential++;
      if(r.area==="ไม่มีศักยภาพ")g.noPotential++;
      g.icons[r._dashIcon]=(g.icons[r._dashIcon]||0)+1;
    });
    const a=[...m.values()].sort((x,y)=>y.total-x.total);
    if(!a.length)return `<div class="pmd-empty">ไม่มีข้อมูลตามตัวกรอง</div>`;
    return `<div class="pmd-table-wrap"><table class="pmd-table"><thead><tr>
      <th>จังหวัด / อำเภอ-เขต / ตำบล-แขวง</th><th>รวม</th><th>มีศักยภาพ</th><th>ไม่มีศักยภาพ</th>
      ${icons.map(i=>`<th><span class="pmd-mini-icon">${iconVisual(i)}</span>${esc(iconName(i))}</th>`).join("")}
      </tr></thead><tbody>
      ${a.map(g=>`<tr><td><b>${esc(g.province)}</b><br>${esc(g.district)}<br><span style="color:#777">${esc(g.tambon)}</span></td><td><b>${g.total.toLocaleString("th-TH")}</b></td><td>${(g.potential||0).toLocaleString("th-TH")}</td><td>${(g.noPotential||0).toLocaleString("th-TH")}</td>${icons.map(i=>`<td>${(g.icons[i]||0).toLocaleString("th-TH")}</td>`).join("")}</tr>`).join("")}
      </tbody></table></div>`;
  }



  // ---------- Real XLSX export for Dashboard ----------
  // Creates a real .xlsx workbook (multiple worksheets + filters) without
  // another Supabase query. It uses the Dashboard cache already in memory.
  function pmXlsxEsc(v){
    return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;")
      .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
  }
  function pmXlsxCol(n){
    let s="";
    while(n){ n--; s=String.fromCharCode(65+(n%26))+s; n=Math.floor(n/26); }
    return s;
  }
  function pmXlsxCell(ref, value, style=0){
    if(value===null||value===undefined||value==="") return `<c r="${ref}" s="${style}"/>`;
    if(typeof value==="number" && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${pmXlsxEsc(value)}</t></is></c>`;
  }
  function pmXlsxSheet(rows,{widths=[],filter=true,freeze=true}={}){
    const maxCols=Math.max(1,...rows.map(r=>r.length));
    const maxRows=Math.max(1,rows.length);
    const cols=widths.length?`<cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join("")}</cols>`:"";
    const sheetRows=rows.map((row,ri)=>{
      const cells=row.map((cell,ci)=>{
        const obj=(cell&&typeof cell==="object"&&("v" in cell))?cell:{v:cell};
        return pmXlsxCell(`${pmXlsxCol(ci+1)}${ri+1}`,obj.v,obj.s||0);
      }).join("");
      return `<row r="${ri+1}">${cells}</row>`;
    }).join("");
    const pane=freeze?`<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`:`<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
    const af=filter&&rows.length>1?`<autoFilter ref="A1:${pmXlsxCol(maxCols)}${maxRows}"/>`:"";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        ${pane}${cols}<sheetData>${sheetRows}</sheetData>${af}
      </worksheet>`;
  }
  function pmCrc32(bytes){
    if(!pmCrc32.table){
      pmCrc32.table=Array.from({length:256},(_,n)=>{
        let c=n;
        for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
        return c>>>0;
      });
    }
    let c=0xFFFFFFFF;
    for(const b of bytes)c=pmCrc32.table[(c^b)&255]^(c>>>8);
    return (c^0xFFFFFFFF)>>>0;
  }
  function pmU16(n){return new Uint8Array([n&255,(n>>>8)&255])}
  function pmU32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}
  function pmCat(parts){
    const len=parts.reduce((a,b)=>a+b.length,0),out=new Uint8Array(len);
    let p=0; for(const b of parts){out.set(b,p);p+=b.length} return out;
  }
  function pmZip(files){
    const enc=new TextEncoder(),locals=[],centrals=[]; let offset=0;
    for(const f of files){
      const name=enc.encode(f.name),data=typeof f.data==="string"?enc.encode(f.data):f.data;
      const crc=pmCrc32(data),flags=0x0800;
      const local=pmCat([
        pmU32(0x04034b50),pmU16(20),pmU16(flags),pmU16(0),pmU16(0),pmU16(0),
        pmU32(crc),pmU32(data.length),pmU32(data.length),pmU16(name.length),pmU16(0),name,data
      ]);
      const central=pmCat([
        pmU32(0x02014b50),pmU16(20),pmU16(20),pmU16(flags),pmU16(0),pmU16(0),pmU16(0),
        pmU32(crc),pmU32(data.length),pmU32(data.length),pmU16(name.length),pmU16(0),pmU16(0),
        pmU16(0),pmU16(0),pmU32(0),pmU32(offset),name
      ]);
      locals.push(local);centrals.push(central);offset+=local.length;
    }
    const centralData=pmCat(centrals);
    const end=pmCat([
      pmU32(0x06054b50),pmU16(0),pmU16(0),pmU16(files.length),pmU16(files.length),
      pmU32(centralData.length),pmU32(offset),pmU16(0)
    ]);
    return pmCat([...locals,centralData,end]);
  }
  function pmColorStyle(hex){
    const m={
      "#ef4444":4,"#f97316":5,"#eab308":6,"#22c55e":7,
      "#14b8a6":8,"#3b82f6":9,"#8b5cf6":10,"#ec4899":11,
      "#000000":12,"#111111":12
    };
    return m[String(hex||"").toLowerCase()]||3;
  }
  function pmColorDot(hex){
    const m={
      "#ef4444":"🔴 แดง","#f97316":"🟠 ส้ม","#eab308":"🟡 เหลือง",
      "#22c55e":"🟢 เขียว","#14b8a6":"🟢 เขียวอมฟ้า","#3b82f6":"🔵 น้ำเงิน",
      "#8b5cf6":"🟣 ม่วง","#ec4899":"🩷 ชมพู","#000000":"⚫ ดำ","#111111":"⚫ ดำ"
    };
    return m[String(hex||"").toLowerCase()]||String(hex||"");
  }
  function pmMakeXlsx(sheets){
    const styleXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
        <fonts count="3">
          <font><sz val="10"/><name val="Tahoma"/></font>
          <font><b/><color rgb="FFFFFFFF"/><sz val="10"/><name val="Tahoma"/></font>
          <font><b/><sz val="10"/><name val="Tahoma"/></font>
        </fonts>
        <fills count="12">
          <fill><patternFill patternType="none"/></fill>
          <fill><patternFill patternType="gray125"/></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FF111827"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFF3F4F6"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFEF4444"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFF97316"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFEAB308"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FF22C55E"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FF14B8A6"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FF3B82F6"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FF8B5CF6"/><bgColor indexed="64"/></patternFill></fill>
          <fill><patternFill patternType="solid"><fgColor rgb="FFEC4899"/><bgColor indexed="64"/></patternFill></fill>
        </fills>
        <borders count="2">
          <border><left/><right/><top/><bottom/><diagonal/></border>
          <border><left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right><top style="thin"><color rgb="FFD1D5DB"/></top><bottom style="thin"><color rgb="FFD1D5DB"/></bottom><diagonal/></border>
        </borders>
        <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
        <cellXfs count="13">
          <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
          <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
          <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
          <xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>
          ${[4,5,6,7,8,9,10,11].map(fill=>`<xf numFmtId="0" fontId="2" fillId="${fill}" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>`).join("")}
          <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center"/></xf>
        </cellXfs>
        <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
      </styleSheet>`;

    const sheetFiles=sheets.map((sh,i)=>({
      name:`xl/worksheets/sheet${i+1}.xml`,
      data:pmXlsxSheet(sh.rows,sh.options||{})
    }));
    const workbookSheets=sheets.map((sh,i)=>`<sheet name="${pmXlsxEsc(sh.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join("");
    const relSheets=sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join("");
    const styleRid=sheets.length+1;

    const files=[
      {name:"[Content_Types].xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
          <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
          <Default Extension="xml" ContentType="application/xml"/>
          <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
          <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
          ${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}
          <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
          <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
        </Types>`},
      {name:"_rels/.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
          <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
          <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
        </Relationships>`},
      {name:"xl/workbook.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
          <bookViews><workbookView/></bookViews><sheets>${workbookSheets}</sheets>
        </workbook>`},
      {name:"xl/_rels/workbook.xml.rels",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
          ${relSheets}<Relationship Id="rId${styleRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
        </Relationships>`},
      {name:"xl/styles.xml",data:styleXml},
      {name:"docProps/core.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
          <dc:title>PinMap Dashboard</dc:title><dc:creator>PinMap</dc:creator>
          <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
        </cp:coreProperties>`},
      {name:"docProps/app.xml",data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
          <Application>PinMap</Application><AppVersion>1.0</AppVersion>
        </Properties>`},
      ...sheetFiles
    ];
    return pmZip(files);
  }

  function exportDashboardExcel(){
    if(!S.room) return toast("กรุณาเข้าห้องก่อน");
    if(!pinmapRoomContext?.is_leader) return toast("Export ได้เฉพาะหัวหน้าห้อง");
    const rows=rowsNow();
    if(!rows.length) return toast("ไม่มีข้อมูล Dashboard ตามตัวกรอง");

    const ic=countBy(rows,x=>x._dashIcon);
    const pc=countBy(rows,x=>x.province);
    const dc=countBy(rows,x=>x.district);
    const tc=countBy(rows,x=>x.tambon);
    const areaCounts=countBy(rows,x=>String(x.area||"ยังไม่ได้ระบุ"));
    const potentialCount=rows.filter(x=>x.area==="มีศักยภาพ").length;
    const noPotentialCount=rows.filter(x=>x.area==="ไม่มีศักยภาพ").length;
    const icons=uniq(rows.map(x=>x._dashIcon));

    const filterRows=[
      [{v:"ตัวกรอง",s:1},{v:"ค่าที่เลือก",s:1}],
      ["จังหวัด",dashProvince||"ทั้งหมด"],
      ["อำเภอ/เขต",dashDistrict||"ทั้งหมด"],
      ["ตำบล/แขวง",dashTambon||"ทั้งหมด"],
      ["Status",dashIcon?iconName(dashIcon):"ทั้งหมด"],
      ["Area",dashArea||"ทั้งหมด"],
      ["จุดที่",dashPointNo?`จุดที่ ${dashPointNo}`:"ทั้งหมด"],
      ["ชื่อคนปัก",dashPinner||"ทั้งหมด"]
    ];
    const kpiRows=[
      [{v:"KPI",s:1},{v:"ค่า",s:1}],
      ["จุดที่ปักทั้งหมด",rows.length],
      ["Area: มีศักยภาพ",potentialCount],
      ["Area: ไม่มีศักยภาพ",noPotentialCount],
      ["ประเภทหมุด",ic.length],
      ["จังหวัดมากสุด",pc[0]?.name||"—"],
      ["อำเภอ/เขตมากสุด",dc[0]?.name||"—"]
    ];
    const summaryRows=[
      [{v:`PinMap Dashboard — ${S.room}`,s:1},{v:"",s:1}],
      ["วันที่ Export",new Date().toLocaleString("th-TH")],
      ["หมายเหตุ","ข้อมูลตามตัวกรอง Dashboard ปัจจุบัน • ไม่รวมคู่แข่ง"],
      ["",""],
      ...filterRows,
      ["",""],
      ...kpiRows
    ];

    const exportStatusCounts=countBy(rows,x=>pinDetailedStatus(x._dashIcon,x.color));
    const statusRows=[
      [{v:"Status",s:1},{v:"จำนวน",s:1},{v:"เปอร์เซ็นต์",s:1}],
      ...exportStatusCounts.map(x=>[x.name,x.count,Number((x.count/rows.length*100).toFixed(2))])
    ];

    const colorRows=[[{v:"Status",s:1},{v:"สี",s:1},{v:"HEX",s:1},{v:"จำนวน",s:1},{v:"เปอร์เซ็นต์",s:1}]];
    ic.forEach(st=>{
      const subset=rows.filter(r=>r._dashIcon===st.name);
      countBy(subset,r=>pinColor(r.color)).forEach(c=>{
        const hex=pinColor(c.name);
        colorRows.push([
          pinDetailedStatus(st.name,hex),
          {v:pmColorDot(hex),s:pmColorStyle(hex)},
          hex,
          c.count,
          Number((c.count/rows.length*100).toFixed(2))
        ]);
      });
    });

    const areaRows=[
      [{v:"Area",s:1},{v:"จำนวน",s:1},{v:"เปอร์เซ็นต์",s:1}],
      ...areaCounts.map(x=>[x.name,x.count,Number((x.count/rows.length*100).toFixed(2))])
    ];

    const topRows=[[{v:"ประเภทพื้นที่",s:1},{v:"อันดับ",s:1},{v:"พื้นที่",s:1},{v:"จำนวน",s:1}]];
    [["จังหวัด",pc],["อำเภอ/เขต",dc],["ตำบล/แขวง",tc]].forEach(([kind,arr])=>{
      arr.slice(0,10).forEach((x,i)=>topRows.push([kind,i+1,x.name,x.count]));
    });

    const m=new Map();
    rows.forEach(r=>{
      const k=r.province+"|||"+r.district+"|||"+r.tambon;
      if(!m.has(k))m.set(k,{province:r.province,district:r.district,tambon:r.tambon,total:0,potential:0,noPotential:0,icons:{}});
      const g=m.get(k);g.total++;
      if(r.area==="มีศักยภาพ")g.potential++;
      if(r.area==="ไม่มีศักยภาพ")g.noPotential++;
      g.icons[r._dashIcon]=(g.icons[r._dashIcon]||0)+1;
    });
    const breakdownRows=[[
      {v:"จังหวัด",s:1},{v:"อำเภอ/เขต",s:1},{v:"ตำบล/แขวง",s:1},
      {v:"รวม",s:1},{v:"มีศักยภาพ",s:1},{v:"ไม่มีศักยภาพ",s:1},
      ...icons.map(i=>({v:iconName(i),s:1}))
    ]];
    [...m.values()].sort((a,b)=>b.total-a.total).forEach(g=>{
      breakdownRows.push([
        g.province,g.district,g.tambon,g.total,g.potential||0,g.noPotential||0,
        ...icons.map(i=>g.icons[i]||0)
      ]);
    });

    // Flat dashboard data: one row per point, ready for Excel Filter / Sort / Pivot.
    // Column order requested: ชื่อจุด -> จุดที่.
    const rawRows=[[
      {v:"ลำดับ",s:1},{v:"ชื่อจุด",s:1},{v:"จุดที่",s:1},
      {v:"จังหวัด",s:1},{v:"อำเภอ/เขต",s:1},{v:"ตำบล/แขวง",s:1},
      {v:"Area",s:1},{v:"ชื่อคนปัก",s:1},{v:"Status",s:1},
      {v:"สี",s:1},{v:"HEX",s:1},{v:"Latitude",s:1},{v:"Longitude",s:1},
      {v:"วันที่/เวลาการกระทำล่าสุด",s:1}
    ]];
    rows.forEach((r,i)=>{
      const hex=pinColor(r.color);
      rawRows.push([
        i+1,r.title||"",r.point_no||"",
        r.province,r.district,r.tambon,r.area||"ยังไม่ได้ระบุ",
        r.created_by||"",
        pinDetailedStatus(r._dashIcon,hex),
        {v:pmColorDot(hex),s:pmColorStyle(hex)},hex,
        Number(r.lat),Number(r.lng),
        r.created_at ? new Date(r.created_at).toLocaleString("th-TH") : ""
      ]);
    });

    const sheets=[
      {name:"สรุป",rows:summaryRows,options:{widths:[28,42],filter:false,freeze:false}},
      {name:"ข้อมูล Dashboard",rows:rawRows,options:{widths:[8,30,10,20,22,22,18,18,22,18,12,15,15,24]}},
      {name:"Status",rows:statusRows,options:{widths:[24,12,14]}},
      {name:"สี",rows:colorRows,options:{widths:[22,20,14,12,14]}},
      {name:"Area",rows:areaRows,options:{widths:[24,12,14]}},
      {name:"Top พื้นที่",rows:topRows,options:{widths:[18,10,28,12]}},
      {name:"สรุปพื้นที่",rows:breakdownRows,options:{widths:[20,22,22,12,14,16,...icons.map(()=>14)]}}
    ];

    const bytes=pmMakeXlsx(sheets);
    const blob=new Blob([bytes],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
    const a=document.createElement("a");
    const safeRoom=String(S.room||"room").replace(/[\\/:*?"<>|]+/g,"-");
    a.href=URL.createObjectURL(blob);
    a.download=`pinmap-dashboard-${safeRoom}.xlsx`;
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000);
    toast("ดาวน์โหลด Dashboard Excel (.xlsx) แล้ว");
  }

  $("pmdExportDashboard").onclick=exportDashboardExcel;

  function renderDash(){
    const root=$("pmdContent"),rows=rowsNow();
    const ic=countBy(rows,x=>x._dashIcon),pc=countBy(rows,x=>x.province),dc=countBy(rows,x=>x.district),tc=countBy(rows,x=>x.tambon);
    const pinnerCounts=countBy(rows,x=>String(x.created_by||"ไม่ทราบชื่อ"));
    const areaCounts=countBy(rows,x=>String(x.area||"ยังไม่ได้ระบุ"));
    const potentialCount=rows.filter(x=>x.area==="มีศักยภาพ").length;
    const noPotentialCount=rows.filter(x=>x.area==="ไม่มีศักยภาพ").length;
    const icons=uniq(rows.map(x=>x._dashIcon));
    root.innerHTML=`
      <div class="pmd-kpis">
        <div class="pmd-kpi"><div class="pmd-kpi-v">${rows.length.toLocaleString("th-TH")}</div><div class="pmd-kpi-l">จุดที่ปักทั้งหมด</div></div>
        <div class="pmd-kpi"><div class="pmd-kpi-v">${potentialCount.toLocaleString("th-TH")}</div><div class="pmd-kpi-l">Area: มีศักยภาพ</div></div>
        <div class="pmd-kpi"><div class="pmd-kpi-v">${noPotentialCount.toLocaleString("th-TH")}</div><div class="pmd-kpi-l">Area: ไม่มีศักยภาพ</div></div>
        <div class="pmd-kpi"><div class="pmd-kpi-v">${ic.length}</div><div class="pmd-kpi-l">ประเภทหมุด</div></div>
        <div class="pmd-kpi"><div class="pmd-kpi-v" style="font-size:13px">${esc(pc[0]?.name||"—")}</div><div class="pmd-kpi-l">จังหวัดมากสุด</div></div>
        <div class="pmd-kpi"><div class="pmd-kpi-v" style="font-size:13px">${esc(dc[0]?.name||"—")}</div><div class="pmd-kpi-l">อำเภอ/เขตมากสุด</div></div>
      </div>

      <div class="pmd-section">จำนวนตามรูปหมุด</div>
      <div class="pmd-icon-grid">
        ${ic.map(x=>`<button type="button" class="pmd-icon-card ${dashIcon===x.name?"active":""}" data-icon="${esc(x.name)}"><span class="pmd-icon-pic">${iconVisual(x.name)}</span><div class="pmd-icon-name">${esc(iconName(x.name))}</div><div class="pmd-icon-num">${x.count.toLocaleString("th-TH")}</div></button>`).join("")||`<div class="pmd-empty">ไม่มีจุด</div>`}
      </div>

      ${dashIcon ? `
        <div class="pmd-section">จำนวนแยกตามสี — ${esc(iconName(dashIcon))}</div>
        ${colorBreakdown(rows)}
      ` : ""}

      <div class="pmd-section">ภาพรวมเพิ่มเติม</div>
      <div class="pmd-chart-grid">
        <div class="pmd-card"><div class="pmd-card-title">สัดส่วน Area</div>${donut(areaCounts,rows.length)}</div>
        <div class="pmd-card"><div class="pmd-card-title">สัดส่วนประเภทหมุด</div>${donut(ic,rows.length)}</div>
      </div>
      <div class="pmd-card" style="margin-top:10px"><div class="pmd-card-title">10 จังหวัดที่มีจุดปักมากที่สุด</div>${bars(pc)}</div>

      <div class="pmd-chart-grid" style="margin-top:10px">
        <div class="pmd-card"><div class="pmd-card-title">10 อำเภอ/เขตที่มีจุดปักมากที่สุด</div>${bars(dc)}</div>
        <div class="pmd-card"><div class="pmd-card-title">10 ตำบล/แขวงที่มีจุดปักมากที่สุด</div>${bars(tc)}</div>
      </div>

      <div class="pmd-card" style="margin-top:10px"><div class="pmd-card-title">จำนวนจุดตามชื่อคนปัก</div>${bars(pinnerCounts)}</div>

      <div class="pmd-section">สรุปจังหวัด → อำเภอ/เขต → ตำบล/แขวง → ประเภทหมุด</div>
      ${breakdown(rows,icons)}
    `;

    root.querySelectorAll(".pmd-icon-card").forEach(b=>b.onclick=()=>{
      dashIcon=dashIcon===b.dataset.icon?"":b.dataset.icon;
      $("pmdIcon").value=dashIcon;
      pinmapSetDashboardIconMapFilter(dashIcon);
      renderDash();
    });
  }

  addEventListener("resize",()=>{if(matchMedia("(max-width:767px)").matches)panel.style.width=""});
})();


/* ── EXPORT EXCEL ── */
const doExportXlsx = async () => {
  if (!S.room) return toast("กรุณาเข้าห้องก่อน");
  if (!pinmapRoomContext?.is_leader) return toast("Export ได้เฉพาะหัวหน้าห้อง");

  try {
    const allPins = await fetchAllPinsRoom();
    if (!allPins.length) return toast("ไม่มีจุดให้ export");

    await pinmapHydratePinAddresses(allPins);

    // Timeline is fetched ONLY when the leader explicitly presses Export.
    // It is not used by the live map/dashboard, so normal Egress is unchanged.
    let auditRows = [];
    try {
      const pageSize = 3000;
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await S.sb
          .from("pin_audit_log")
          .select("id,room,pin_id,action,action_at,actor_name,title_before,title_after,point_no_before,point_no_after,lat_before,lat_after,lng_before,lng_after,area_before,area_after,note_before,note_after,color_before,color_after,icon_before,icon_after,address_before,address_after,change_summary")
          .eq("room", S.room)
          .order("action_at", { ascending: true })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        auditRows.push(...(data || []));
        if (!data || data.length < pageSize) break;
      }
    } catch (auditErr) {
      console.warn("Timeline unavailable", auditErr);
      toast("Export จุดได้ แต่ Timeline ยังใช้ไม่ได้ — กรุณารัน SQL Timeline");
    }

    const x = v => String(v ?? "")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&apos;");

    const colorName = c => ({
      "#ef4444":"แดง","#f97316":"ส้ม","#eab308":"เหลือง","#22c55e":"เขียว",
      "#14b8a6":"เขียวอมฟ้า","#3b82f6":"น้ำเงิน","#8b5cf6":"ม่วง",
      "#ec4899":"ชมพู","#000000":"ดำ","#111111":"ดำ"
    })[String(c||"").toLowerCase()] || "";

    const styleIdForColor = c => ({
      "#ef4444":"red","#f97316":"orange","#eab308":"yellow","#22c55e":"green",
      "#14b8a6":"teal","#3b82f6":"blue","#8b5cf6":"purple","#ec4899":"pink",
      "#000000":"black","#111111":"black"
    })[String(c||"").toLowerCase()] || "normal";

    const cell = (v, style="normal") =>
      `<Cell ss:StyleID="${style}"><Data ss:Type="String">${x(v)}</Data></Cell>`;
    const numCell = (v, style="normal") =>
      `<Cell ss:StyleID="${style}"><Data ss:Type="Number">${Number(v)||0}</Data></Cell>`;

    const pointsHeader = [
      "ชื่อจุด","จุดที่","Status","ชื่อโลโก้","สีหมุด","Address","Area","รายละเอียด",
      "ละติจูด","ลองจิจูด","ดำเนินการล่าสุดโดย","วันที่/เวลาล่าสุด"
    ];

    const pointsXml = [
      `<Row>${pointsHeader.map(h=>cell(h,"header")).join("")}</Row>`,
      ...allPins.map(p => {
        const clr = /^#[0-9a-fA-F]{6}$/.test(String(p.color||"")) ? p.color : "#ef4444";
        return `<Row>
          ${cell(p.title)}
          ${cell(p.point_no || "")}
          ${cell(pinDetailedStatus(p.icon,p.color))}
          ${cell(pinStatusName(p.icon))}
          ${cell(colorName(clr),styleIdForColor(clr))}
          ${cell(p.address || "")}
          ${cell(p.area || "")}
          ${cell(p.note || "")}
          ${numCell(p.lat)}
          ${numCell(p.lng)}
          ${cell(p.created_by || "")}
          ${cell(p.created_at ? new Date(p.created_at).toLocaleString("th-TH") : "")}
        </Row>`;
      })
    ].join("");

    const timelineHeader = [
      "ลำดับ","Pin ID","ชื่อจุด","จุดที่","วันที่/เวลา","ผู้ดำเนินการ","การกระทำ","รายการที่เปลี่ยน",
      "ชื่อจุด ก่อน→หลัง","จุดที่ ก่อน→หลัง","ตำแหน่ง ก่อน→หลัง",
      "Area ก่อน→หลัง","รายละเอียด ก่อน→หลัง","สี ก่อน→หลัง","โลโก้/Status ก่อน→หลัง",
      "Address ก่อน→หลัง"
    ];

    const timelineXml = [
      `<Row>${timelineHeader.map(h=>cell(h,"header")).join("")}</Row>`,
      ...auditRows.map((a,i) => {
        const latestTitle = a.title_after || a.title_before || "";
        const latestPointNo = a.point_no_after ?? a.point_no_before ?? "";
        const posBefore = (a.lat_before == null || a.lng_before == null) ? "" : `${a.lat_before}, ${a.lng_before}`;
        const posAfter  = (a.lat_after == null || a.lng_after == null) ? "" : `${a.lat_after}, ${a.lng_after}`;

        const oldStatus = (a.icon_before || a.color_before)
          ? pinDetailedStatus(a.icon_before || "pin", a.color_before) : "";
        const newStatus = (a.icon_after || a.color_after)
          ? pinDetailedStatus(a.icon_after || "pin", a.color_after) : "";

        const oldColor = a.color_before ? `${colorName(a.color_before) || a.color_before} ${a.color_before}` : "";
        const newColor = a.color_after ? `${colorName(a.color_after) || a.color_after} ${a.color_after}` : "";

        return `<Row>
          ${numCell(i+1)}
          ${cell(a.pin_id ?? "")}
          ${cell(latestTitle)}
          ${cell(latestPointNo)}
          ${cell(a.action_at ? new Date(a.action_at).toLocaleString("th-TH") : "")}
          ${cell(a.actor_name || "")}
          ${cell(pinAuditActionName(a.action))}
          ${cell(a.change_summary || "")}
          ${cell(pinAuditValue(a.title_before,a.title_after))}
          ${cell(pinAuditValue(a.point_no_before,a.point_no_after))}
          ${cell(pinAuditValue(posBefore,posAfter))}
          ${cell(pinAuditValue(a.area_before,a.area_after))}
          ${cell(pinAuditValue(a.note_before,a.note_after))}
          ${cell(pinAuditValue(oldColor,newColor))}
          ${cell(pinAuditValue(oldStatus,newStatus))}
          ${cell(pinAuditValue(a.address_before,a.address_after))}
        </Row>`;
      })
    ].join("");

    const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
 xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="normal"><Font ss:FontName="Tahoma" ss:Size="10"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders></Style>
  <Style ss:ID="header"><Font ss:FontName="Tahoma" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#111827" ss:Pattern="Solid"/><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="red"><Interior ss:Color="#EF4444" ss:Pattern="Solid"/><Font ss:FontName="Tahoma" ss:Bold="1" ss:Color="#FFFFFF"/></Style>
  <Style ss:ID="orange"><Interior ss:Color="#F97316" ss:Pattern="Solid"/><Font ss:FontName="Tahoma" ss:Bold="1"/></Style>
  <Style ss:ID="yellow"><Interior ss:Color="#EAB308" ss:Pattern="Solid"/><Font ss:FontName="Tahoma" ss:Bold="1"/></Style>
  <Style ss:ID="green"><Interior ss:Color="#22C55E" ss:Pattern="Solid"/><Font ss:FontName="Tahoma" ss:Bold="1"/></Style>
  <Style ss:ID="teal"><Interior ss:Color="#14B8A6" ss:Pattern="Solid"/><Font ss:FontName="Tahoma" ss:Bold="1"/></Style>
  <Style ss:ID="blue"><Interior ss:Color="#3B82F6" ss:Pattern="Solid"/><Font ss:FontName="Tahoma" ss:Bold="1" ss:Color="#FFFFFF"/></Style>
  <Style ss:ID="purple"><Interior ss:Color="#8B5CF6" ss:Pattern="Solid"/><Font ss:FontName="Tahoma" ss:Bold="1" ss:Color="#FFFFFF"/></Style>
  <Style ss:ID="pink"><Interior ss:Color="#EC4899" ss:Pattern="Solid"/><Font ss:FontName="Tahoma" ss:Bold="1"/></Style>
  <Style ss:ID="black"><Interior ss:Color="#111111" ss:Pattern="Solid"/><Font ss:FontName="Tahoma" ss:Bold="1" ss:Color="#FFFFFF"/></Style>
 </Styles>

 <Worksheet ss:Name="จุดทั้งหมด">
  <Table>${pointsXml}</Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane>
   <AutoFilter x:Range="R1C1:R${allPins.length+1}C${pointsHeader.length}" xmlns="urn:schemas-microsoft-com:office:excel"/>
  </WorksheetOptions>
 </Worksheet>

 <Worksheet ss:Name="Timeline">
  <Table>${timelineXml}</Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane>
   <AutoFilter x:Range="R1C1:R${auditRows.length+1}C${timelineHeader.length}" xmlns="urn:schemas-microsoft-com:office:excel"/>
  </WorksheetOptions>
 </Worksheet>
</Workbook>`;

    const blob = new Blob(["\ufeff", workbook], {
      type: "application/vnd.ms-excel;charset=utf-8"
    });
    const a = document.createElement("a");
    const safeRoom = String(S.room || "export").replace(/[\\/:*?"<>|]+/g, "-");
    a.href = URL.createObjectURL(blob);
    a.download = `pinmap-${safeRoom}-with-timeline.xls`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);

    toast(auditRows.length
      ? `ดาวน์โหลด Excel + Timeline ${auditRows.length.toLocaleString("th-TH")} รายการแล้ว`
      : "ดาวน์โหลด Excel แล้ว (ยังไม่มี Timeline)");
  } catch (err) {
    console.error(err);
    toast(err.message || "Export ไม่สำเร็จ");
  }
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
let pinmapSavedRoomsCh = null;

function stopSavedRoomsRealtime(){
  if(pinmapSavedRoomsCh && S.sb){
    try{ S.sb.removeChannel(pinmapSavedRoomsCh); }catch(_){}
  }
  pinmapSavedRoomsCh = null;
}

function startSavedRoomsRealtime(){
  stopSavedRoomsRealtime();
  if(!S.sb || !S.session) return;

  const uid = S.session.user.id;
  pinmapSavedRoomsCh = S.sb
    .channel(`pinmap-saved-rooms-${uid}`)
    .on("postgres_changes", {
      event: "*",
      schema: "public",
      table: "saved_rooms",
      filter: `user_id=eq.${uid}`
    }, () => {
      // Any save/delete from another device refreshes this account's list.
      loadSavedRooms();
    })
    .subscribe();
}

async function loadSavedRooms() {
  if (!S.sb || !S.session) { S.savedRooms = []; renderSavedRooms(); return; }
  const { data, error } = await S.sb
    .from("saved_rooms")
    .select("id,user_id,room,label,created_at")
    .eq("user_id", S.session.user.id)
    .order("created_at", { ascending: false });
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
    const { data, error } = await S.sb.rpc("pinmap_enter_member", { p_room: room });
    if (error) throw error;
    if (!data) return toast("คุณไม่ได้เป็นสมาชิกห้องนี้แล้ว");
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


/* =========================================================
   TEAM / ROOM LEADERS / APPROVAL / NOTIFICATIONS / ASSIGNMENTS
   ========================================================= */
let pinmapRoomContext = null;
let pinmapNotifications = [];
let pinmapNotificationPanelOpen = false;
let pinmapAssignTarget = null;

(function setupPinmapTeamUi(){
  if (document.getElementById("pinmapTeamUiStyle")) return;
  const st = document.createElement("style");
  st.id = "pinmapTeamUiStyle";
  st.textContent = `
    .pinmap-notify-btn,.pinmap-members-btn,.pinmap-leader-btn,.pinmap-leave-team-btn{border:0;border-radius:9px;font:inherit;font-weight:700;cursor:pointer;min-height:36px;padding:7px 10px;position:relative}
    .pinmap-notify-btn{background:#f3f4f6}.pinmap-members-btn{background:#f3f4f6}.pinmap-leader-btn{background:#fef3c7;color:#92400e}.pinmap-leave-team-btn{background:#111;color:#fff}
    .ptm-online-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#22c55e;margin-right:6px;box-shadow:0 0 0 2px rgba(34,197,94,.14);vertical-align:1px}
    .ptm-offline-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#d1d5db;margin-right:6px;vertical-align:1px}
    .pinmap-notify-badge{position:absolute;right:-5px;top:-6px;min-width:18px;height:18px;border-radius:999px;background:#ef4444;color:#fff;font-size:10px;display:flex;align-items:center;justify-content:center;padding:0 4px;box-sizing:border-box}
    .pinmap-notify-badge.hidden,.pinmap-leader-btn.hidden,.pinmap-leave-team-btn.hidden{display:none!important}
    #pinmapNotificationPanel{position:fixed;z-index:99997;right:18px;top:74px;width:min(430px,calc(100vw - 24px));max-height:70vh;overflow:auto;background:#fff;border:1px solid #ddd;border-radius:14px;box-shadow:0 15px 45px rgba(0,0,0,.25);padding:10px}
    #pinmapNotificationPanel.hidden{display:none!important}.pnt-head{display:flex;align-items:center;gap:8px;padding:4px 4px 9px;border-bottom:1px solid #eee}.pnt-head b{flex:1}.pnt-close{border:0;background:#eee;border-radius:8px;width:32px;height:32px;font-size:18px}
    .pnt-item{padding:10px;border-bottom:1px solid #eee}.pnt-item.unread{background:#f8fbff}.pnt-title{font-weight:800;font-size:13px}.pnt-msg{font-size:12px;color:#444;margin-top:4px;line-height:1.45}.pnt-meta{font-size:10px;color:#888;margin-top:5px}.pnt-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.pnt-actions button{border:0;border-radius:8px;padding:7px 9px;font-size:11px;font-weight:800;cursor:pointer}.pnt-ok{background:#111;color:#fff}.pnt-no{background:#fee2e2;color:#b91c1c}.pnt-go{background:#dbeafe;color:#1d4ed8}.pnt-del{background:#fee2e2;color:#b91c1c}
    #pinmapRoomManager,#pinmapAssignModal,#pinmapNotificationDetail,#pinmapLeaveConfirm{position:fixed;z-index:99999;inset:0;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:14px}
    #pinmapRoomManager.hidden,#pinmapAssignModal.hidden,#pinmapNotificationDetail.hidden,#pinmapLeaveConfirm.hidden{display:none!important}
    .ptm-card{width:min(560px,96vw);max-height:88vh;overflow:auto;background:#fff;border-radius:16px;padding:15px;box-shadow:0 18px 60px rgba(0,0,0,.3)}.ptm-head{display:flex;align-items:center;gap:8px;margin-bottom:10px}.ptm-head b{font-size:17px;flex:1}.ptm-x{border:0;background:#eee;width:34px;height:34px;border-radius:9px;font-size:19px}
    .ptm-pass{display:grid;grid-template-columns:1fr auto;gap:7px;margin:10px 0}.ptm-pass input{min-width:0;border:1px solid #d1d5db;border-radius:9px;padding:9px;font:inherit}.ptm-pass button{border:0;border-radius:9px;background:#111;color:#fff;font-weight:800;padding:0 12px}
    .ptm-member{display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #eee}.ptm-member-main{flex:1;min-width:0}.ptm-name{font-weight:800;font-size:13px}.ptm-sub{font-size:10px;color:#777}.ptm-badge{display:inline-block;font-size:9px;padding:2px 6px;border-radius:999px;background:#fef3c7;color:#92400e;margin-left:5px}.ptm-actions{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}.ptm-actions button{border:0;border-radius:7px;padding:6px 7px;font-size:10px;font-weight:800;cursor:pointer}.ptm-add{background:#dbeafe;color:#1d4ed8}.ptm-transfer{background:#ede9fe;color:#6d28d9}.ptm-remove{background:#f3f4f6}.ptm-kick{background:#fee2e2;color:#b91c1c}.ptm-approve{background:#dcfce7;color:#166534}
    .pta-members{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:8px 0}.pta-user{display:flex;align-items:center;gap:7px;border:1px solid #e5e7eb;border-radius:9px;padding:8px;font-size:12px}.pta-user input{width:16px;height:16px}.pta-desc{width:100%;min-height:95px;box-sizing:border-box;border:1px solid #d1d5db;border-radius:9px;padding:9px;font:inherit}.pta-send{width:100%;border:0;border-radius:10px;background:#111;color:#fff;font-weight:800;padding:10px;margin-top:10px}
    @media(max-width:767px){#pinmapNotificationPanel{right:8px;left:8px;top:64px;width:auto;max-height:72vh}.pta-members{grid-template-columns:1fr}.pinmap-notify-btn,.pinmap-members-btn,.pinmap-leader-btn,.pinmap-leave-team-btn{min-height:34px;padding:6px 8px;font-size:12px}}
  `;
  document.head.appendChild(st);

  function makeNotifyButton(mobile=false){
    const ref = document.querySelector(mobile ? ".m-online" : ".online");
    if (!ref) return;

    // Replace the old Online button with Members in this room.
    ref.classList.remove(mobile ? "m-online" : "online");
    ref.classList.add("pinmap-members-btn");
    ref.id = mobile ? "mPinmapMembersBtn" : "pinmapMembersBtn";
    ref.innerHTML = "👥 <span>สมาชิกในห้อง</span>";
    ref.onclick = e => { e.stopPropagation(); openPinmapMembers(); };

    const id = mobile ? "mPinmapNotifyBtn" : "pinmapNotifyBtn";
    if ($(id)) return;
    const b = document.createElement("button"); b.type="button"; b.id=id; b.className="pinmap-notify-btn"; b.innerHTML='🔔 <span>แจ้งเตือน</span><i class="pinmap-notify-badge hidden">0</i>';
    ref.insertAdjacentElement("afterend", b); b.onclick=e=>{e.stopPropagation(); togglePinmapNotifications()};
    // ไม่มีปุ่ม "หัวห้อง" แยกบนแถบบนแล้ว
    // การจัดการหัวห้อง/สมาชิกทำผ่านปุ่ม "สมาชิกในห้อง" เพียงจุดเดียว
  }
  makeNotifyButton(false); makeNotifyButton(true);

  function makeLeaveButton(id,mobile=false){
    const ref=$(id); if(!ref)return; const bid=mobile?"mLeaveTeamBtn":"leaveTeamBtn"; if($(bid))return;
    const b=document.createElement("button"); b.type="button"; b.id=bid; b.className="pinmap-leave-team-btn hidden"; b.textContent="ออกจากทีมถาวร"; ref.insertAdjacentElement("afterend",b); b.onclick=()=>$("pinmapLeaveConfirm")?.classList.remove("hidden");
  }
  makeLeaveButton("logoutBtn",false); makeLeaveButton("mLogoutBtn",true);

  const np=document.createElement("div"); np.id="pinmapNotificationPanel"; np.className="hidden"; np.innerHTML='<div class="pnt-head"><b>🔔 การแจ้งเตือน</b><button type="button" id="pinmapNotifyRefresh" class="pnt-close" title="รีเฟรช">↻</button><button type="button" id="pinmapNotifyClose" class="pnt-close">×</button></div><div id="pinmapNotificationList"></div>'; document.body.appendChild(np);
  $("pinmapNotifyClose").onclick=()=>{np.classList.add("hidden");pinmapNotificationPanelOpen=false}; $("pinmapNotifyRefresh").onclick=()=>loadPinmapNotifications();

  const rm=document.createElement("div"); rm.id="pinmapRoomManager"; rm.className="hidden"; rm.innerHTML='<div class="ptm-card"><div class="ptm-head"><b>👑 จัดการหัวห้องและสมาชิก</b><button type="button" id="ptmClose" class="ptm-x">×</button></div><div id="ptmRoomInfo"></div><div class="ptm-pass"><input id="ptmPassword" type="text" placeholder="รหัสห้อง"><button type="button" id="ptmSavePassword">เปลี่ยนรหัส</button></div><div id="ptmMembers"></div></div>';document.body.appendChild(rm); $("ptmClose").onclick=()=>rm.classList.add("hidden"); $("ptmSavePassword").onclick=changePinmapRoomPassword;

  const am=document.createElement("div"); am.id="pinmapAssignModal"; am.className="hidden"; am.innerHTML='<div class="ptm-card"><div class="ptm-head"><b id="ptaTitle">📌 มอบหมายจุด</b><button type="button" id="ptaClose" class="ptm-x">×</button></div><div id="ptaPoint" class="pnt-msg"></div><div style="font-weight:800;font-size:12px;margin-top:12px">เลือกสมาชิก (เลือกได้หลายคน)</div><div id="ptaMembers" class="pta-members"></div><div style="font-weight:800;font-size:12px;margin:8px 0 4px">คำอธิบาย</div><textarea id="ptaDescription" class="pta-desc" placeholder="รายละเอียดงาน / สิ่งที่ต้องทำ"></textarea><button type="button" id="ptaSend" class="pta-send">ส่งมอบหมาย</button></div>';document.body.appendChild(am); $("ptaClose").onclick=()=>am.classList.add("hidden"); $("ptaSend").onclick=sendPinmapAssignment;

  const nd=document.createElement("div");nd.id="pinmapNotificationDetail";nd.className="hidden";nd.innerHTML='<div class="ptm-card" style="width:min(460px,95vw)"><div class="ptm-head"><b>รายละเอียด</b><button type="button" id="pndClose" class="ptm-x">×</button></div><div id="pndBody" class="pnt-msg" style="font-size:13px;white-space:pre-wrap"></div><div id="pndActions" class="pnt-actions"></div></div>';document.body.appendChild(nd); $("pndClose").onclick=()=>nd.classList.add("hidden");

  const lc=document.createElement("div");lc.id="pinmapLeaveConfirm";lc.className="hidden";lc.innerHTML='<div class="ptm-card" style="width:min(390px,94vw)"><div class="ptm-head"><b>ออกจากทีมถาวร</b></div><div style="font-size:14px;line-height:1.55">คุณแน่ใจว่าจะออกจากทีมถาวรเลยใช่มั้ย?</div><div class="pnt-actions" style="margin-top:14px"><button type="button" id="leaveTeamYes" class="pnt-no" style="flex:1">ใช่</button><button type="button" id="leaveTeamNo" class="pnt-ok" style="flex:1">ไม่</button></div></div>';document.body.appendChild(lc); $("leaveTeamNo").onclick=()=>lc.classList.add("hidden"); $("leaveTeamYes").onclick=leavePinmapTeamForever;
})();

function pinmapSetRoomButtons(){
  const inRoom=!!S.room, isLeader=!!pinmapRoomContext?.is_leader;
  $("leaveTeamBtn")?.classList.toggle("hidden",!inRoom); $("mLeaveTeamBtn")?.classList.toggle("hidden",!inRoom);
  $("pinmapMembersBtn")?.classList.toggle("hidden",!inRoom); $("mPinmapMembersBtn")?.classList.toggle("hidden",!inRoom);

  // Export ทุกปุ่มแสดงเฉพาะหัวหน้าห้อง
  ["exportXlsx","mExportXlsx","pmdExportDashboard"].forEach(id=>{
    const el=$(id); if(el) el.classList.toggle("hidden", !(inRoom && isLeader));
  });
  // ไม่มีปุ่มหัวห้องแยกบน Header; จัดการผ่าน "สมาชิกในห้อง"
}

async function pinmapLoadRoomContext(){
  pinmapRoomContext=null; pinmapSetRoomButtons();
  if(!S.sb||!S.session||!S.room)return null;

  try{
    const {data,error}=await S.sb.rpc("pinmap_room_context",{p_room:S.room});
    if(error)throw error;
    const ctx=data||null;
    if(!ctx)return null;

    let members=Array.isArray(ctx.members)?ctx.members.slice():[];

    // Reliable full list from a dedicated SECURITY DEFINER RPC.
    try{
      const {data:allMembers,error:allErr}=await S.sb.rpc("pinmap_room_members_all",{p_room:S.room});
      if(!allErr && Array.isArray(allMembers)){
        const byId=new Map();
        [...members,...allMembers].forEach(m=>{
          const uid=String(m?.user_id||"");
          if(!uid)return;
          byId.set(uid,{...(byId.get(uid)||{}),...m});
        });
        members=[...byId.values()];
      }
    }catch(err){
      console.warn("all room members rpc",err);
    }

    // Reconcile with users who have actually created Pins in this room.
    // This only runs when loading the Members dialog/context.
    try{
      const {data:authors,error:authorsErr}=await S.sb
        .from("pins")
        .select("created_by_user_id,created_by")
        .eq("room",S.room)
        .not("created_by_user_id","is",null)
        .limit(2000);

      if(!authorsErr && Array.isArray(authors)){
        const byId=new Map(members.map(m=>[String(m.user_id||""),m]));
        authors.forEach(a=>{
          const uid=String(a?.created_by_user_id||"");
          if(!uid || byId.has(uid))return;
          byId.set(uid,{
            user_id:uid,
            username:a.created_by||"ผู้ใช้",
            status:"recovered",
            is_leader:false,
            recovered_from_pins:true
          });
        });
        members=[...byId.values()];
      }
    }catch(err){
      console.warn("room member pin reconciliation",err);
    }

    ctx.members=members;
    pinmapRoomContext=ctx;
    pinmapSetRoomButtons();
    return pinmapRoomContext;
  }catch(err){
    console.warn("room context",err);
    return null;
  }
}

async function pinmapTouchRoomMember(){
  if(!S.sb||!S.room||!S.session)return;
  try{await S.sb.rpc("pinmap_touch_member",{p_room:S.room,p_username:username()})}catch(err){console.warn("touch member",err)}
}

async function openPinmapMembers(){
  if(!S.room)return toast("กรุณาเข้าห้องก่อน");
  const ctx=await pinmapLoadRoomContext();
  if(!ctx?.is_member)return toast("คุณไม่ได้เป็นสมาชิกห้องนี้");
  const memberRows=Array.isArray(ctx.members)?ctx.members:[];
  const activeCount=memberRows.filter(x=>x.status==="active").length;
  const pendingCount=memberRows.filter(x=>x.status==="pending").length;
  const otherCount=memberRows.filter(x=>x.status!=="active"&&x.status!=="pending").length;
  $("ptmRoomInfo").innerHTML=`<div style="font-weight:800">👥 สมาชิกในห้อง: ${esc(S.room)}</div><div style="font-size:11px;color:#777">${ctx.is_leader?"คุณเป็นหัวห้อง สามารถเพิ่ม/โอน/ปลดหัว และเตะสมาชิกได้":"จุดสีเขียว = ออนไลน์ตอนนี้"} • พบทั้งหมด ${memberRows.length} • สมาชิก ${activeCount}${pendingCount?` • รออนุมัติ ${pendingCount}`:""}${otherCount?` • ตรวจพบเพิ่ม ${otherCount}`:""}</div>`;
  const pass=$("ptmPassword"), passWrap=pass?.closest(".ptm-pass");
  if(passWrap)passWrap.style.display=ctx.is_leader?"grid":"none";
  if(pass)pass.value=ctx.is_leader?(ctx.password||""):"";
  renderPinmapRoomMembers(ctx.members||[],!!ctx.is_leader);
  $("pinmapRoomManager").classList.remove("hidden");
}
async function openPinmapRoomManager(){ return openPinmapMembers(); }

function renderPinmapRoomMembers(members,isLeader=!!pinmapRoomContext?.is_leader){
  const wrap=$("ptmMembers"); if(!wrap)return; const me=S.session?.user?.id;
  const online=getOnlineUsers();
  const rows=Array.isArray(members)?members:[];
  const active=rows.filter(x=>x.status==="active");
  const pending=rows.filter(x=>x.status==="pending");
  let html='';

  html+=`<div style="font-weight:800;margin:13px 0 5px">สมาชิก (${active.length})</div>`+
    active.map(m=>{
      const isMe=String(m.user_id)===String(me), isOnline=online.has(String(m.user_id));
      const actions=isLeader
        ? `${!m.is_leader?`<button class="ptm-add" data-leader-action="add" data-user="${esc(m.user_id)}">+ หัว</button><button class="ptm-transfer" data-leader-action="transfer" data-user="${esc(m.user_id)}">โอนหัว</button>`:''}${m.is_leader&&!isMe?`<button class="ptm-remove" data-leader-action="remove" data-user="${esc(m.user_id)}">ปลดหัว</button>`:''}${!isMe?`<button class="ptm-kick" data-kick-user="${esc(m.user_id)}">เตะ</button>`:''}`
        : '';
      return `<div class="ptm-member"><div class="ptm-member-main"><div class="ptm-name"><i class="${isOnline?'ptm-online-dot':'ptm-offline-dot'}"></i>${esc(m.username||'ผู้ใช้')}${m.is_leader?'<span class="ptm-badge">👑 หัวห้อง</span>':''}${isMe?' <span style="font-size:9px;color:#777">(คุณ)</span>':''}</div><div class="ptm-sub">${isOnline?'ออนไลน์':'ออฟไลน์'}</div></div><div class="ptm-actions">${actions}</div></div>`;
    }).join('');

  if(pending.length){
    html+=`<div style="font-weight:800;margin:15px 0 5px">รออนุมัติ (${pending.length})</div>`+
      pending.map(m=>{
        const isOnline=online.has(String(m.user_id));
        const actions=isLeader
          ? `<button class="ptm-approve" data-room-approve="${esc(m.user_id)}" data-ok="1">ยอมรับ</button><button class="ptm-kick" data-room-approve="${esc(m.user_id)}" data-ok="0">ปฏิเสธ</button>`
          : '';
        return `<div class="ptm-member"><div class="ptm-member-main"><div class="ptm-name"><i class="${isOnline?'ptm-online-dot':'ptm-offline-dot'}"></i>${esc(m.username||'ผู้ใช้')} <span class="ptm-badge" style="background:#f3f4f6;color:#6b7280">รออนุมัติ</span></div><div class="ptm-sub">${isOnline?'ออนไลน์ • ':''}ยังไม่ได้เป็นสมาชิกที่อนุมัติ</div></div><div class="ptm-actions">${actions}</div></div>`;
      }).join('');
  }

  const other=rows.filter(x=>x.status!=="active"&&x.status!=="pending");
  if(other.length){
    html+=`<div style="font-weight:800;margin:15px 0 5px">สมาชิกที่ตรวจพบเพิ่มเติม (${other.length})</div>`+
      other.map(m=>{
        const isMe=String(m.user_id)===String(me), isOnline=online.has(String(m.user_id));
        const statusText=m.recovered_from_pins?"พบจากประวัติการปักจุด":(`สถานะ: ${esc(m.status||"ไม่ระบุ")}`);
        return `<div class="ptm-member"><div class="ptm-member-main"><div class="ptm-name"><i class="${isOnline?'ptm-online-dot':'ptm-offline-dot'}"></i>${esc(m.username||'ผู้ใช้')}${m.is_leader?'<span class="ptm-badge">👑 หัวห้อง</span>':''}${isMe?' <span style="font-size:9px;color:#777">(คุณ)</span>':''}</div><div class="ptm-sub">${isOnline?'ออนไลน์ • ':''}${statusText}</div></div><div class="ptm-actions"></div></div>`;
      }).join('');
  }

  if(!rows.length){
    html='<div style="padding:20px 0;color:#777;font-size:12px">ยังไม่มีรายชื่อสมาชิก</div>';
  }

  wrap.innerHTML=html;
  if(isLeader){
    wrap.querySelectorAll('[data-room-approve]').forEach(b=>b.onclick=()=>approvePinmapMember(b.dataset.roomApprove,b.dataset.ok==='1'));
    wrap.querySelectorAll('[data-leader-action]').forEach(b=>b.onclick=()=>changePinmapLeader(b.dataset.user,b.dataset.leaderAction));
    wrap.querySelectorAll('[data-kick-user]').forEach(b=>b.onclick=()=>kickPinmapMember(b.dataset.kickUser));
  }
}
async function approvePinmapMember(userId,approve){
  try{const {error}=await S.sb.rpc("pinmap_approve_member",{p_room:S.room,p_user_id:userId,p_approve:!!approve});if(error)throw error;toast(approve?"อนุมัติสมาชิกแล้ว":"ปฏิเสธคำขอแล้ว");await openPinmapMembers();await loadPinmapNotifications()}catch(err){toast(err.message||"ทำรายการไม่สำเร็จ")}
}
async function changePinmapLeader(userId,mode){
  const msg=mode==='transfer'?"โอนหัวห้องให้คนนี้ และปลดคุณจากหัวห้องใช่หรือไม่?":mode==='add'?"เพิ่มคนนี้เป็นหัวห้องใช่หรือไม่?":"ปลดคนนี้จากหัวห้องใช่หรือไม่?"; if(!confirm(msg))return;
  try{const {error}=await S.sb.rpc("pinmap_set_leader",{p_room:S.room,p_user_id:userId,p_mode:mode});if(error)throw error;toast("อัปเดตหัวห้องแล้ว");await pinmapLoadRoomContext();if(pinmapRoomContext?.is_leader)await openPinmapMembers();else $("pinmapRoomManager")?.classList.add("hidden") }catch(err){toast(err.message||"ทำรายการไม่สำเร็จ")}
}
async function kickPinmapMember(userId){
  if(!confirm("เตะสมาชิก/หัวห้องคนนี้ออกจากทีมถาวรใช่หรือไม่?"))return;
  try{const {error}=await S.sb.rpc("pinmap_kick_member",{p_room:S.room,p_user_id:userId});if(error)throw error;toast("เตะออกจากทีมแล้ว");await openPinmapMembers()}catch(err){toast(err.message||"เตะไม่สำเร็จ")}
}
async function changePinmapRoomPassword(){
  const pass=$("ptmPassword")?.value||""; if(!pass)return toast("กรุณาใส่รหัสห้องใหม่");
  try{const {error}=await S.sb.rpc("pinmap_change_room_password",{p_room:S.room,p_passcode:pass});if(error)throw error;toast("เปลี่ยนรหัสห้องแล้ว");await pinmapLoadRoomContext()}catch(err){toast(err.message||"เปลี่ยนรหัสไม่สำเร็จ")}
}

async function pinmapExitRoomLocal(message="ออกจากห้องแล้ว"){
  if(S.ch){try{S.sb.removeChannel(S.ch)}catch(_){}S.ch=null} S.room=""; pinmapRoomContext=null; S.all=[];cluster.clearLayers();S.markers.clear(); if($("pinCount"))$("pinCount").textContent="0"; if($("room"))$("room").value="";if($("mRoom"))$("mRoom").value="";pinmapSetRoomButtons();refreshUserUI();closeMobileMenu();toast(message)
}
async function leavePinmapTeamForever(){
  $("pinmapLeaveConfirm")?.classList.add("hidden"); if(!S.room)return;
  const room=S.room;
  try{const {error}=await S.sb.rpc("pinmap_leave_room",{p_room:room});if(error)throw error;await pinmapExitRoomLocal("ออกจากทีมถาวรแล้ว");await loadSavedRooms();await loadPinmapNotifications()}catch(err){toast(err.message||"ออกจากทีมไม่สำเร็จ")}
}

function pinmapUnreadCount(){return pinmapNotifications.filter(n=>!n.read_at).length}
function pinmapRenderNotifyBadge(){const n=pinmapUnreadCount();["pinmapNotifyBtn","mPinmapNotifyBtn"].forEach(id=>{const b=$(id)?.querySelector('.pinmap-notify-badge');if(!b)return;b.textContent=n>99?'99+':String(n);b.classList.toggle('hidden',!n)})}
async function loadPinmapNotifications(){
  if(!S.sb||!S.session){pinmapNotifications=[];pinmapRenderNotifyBadge();renderPinmapNotifications();return}
  try{const {data,error}=await S.sb.from("pinmap_notifications").select("id,user_id,room,type,title,message,actor_id,actor_name,lat,lng,pin_kind,pin_id,payload,read_at,created_at").eq("user_id",S.session.user.id).order("created_at",{ascending:false}).limit(100);if(error)throw error;pinmapNotifications=data||[];pinmapRenderNotifyBadge();renderPinmapNotifications()}catch(err){console.warn("notifications",err)}
}
function togglePinmapNotifications(){pinmapNotificationPanelOpen=!pinmapNotificationPanelOpen;$("pinmapNotificationPanel")?.classList.toggle("hidden",!pinmapNotificationPanelOpen);if(pinmapNotificationPanelOpen)loadPinmapNotifications()}
function renderPinmapNotifications(){
  const wrap=$("pinmapNotificationList");if(!wrap)return;if(!pinmapNotifications.length){wrap.innerHTML='<div style="padding:22px;text-align:center;color:#777;font-size:12px">ยังไม่มีการแจ้งเตือน</div>';return}
  wrap.innerHTML=pinmapNotifications.map(n=>{const d=new Date(n.created_at);const p=n.payload||{};let actions='';if(n.type==='join_request'&&p.requester_id){actions=`<button class="pnt-ok" data-notify-approve="${esc(p.requester_id)}" data-room="${esc(n.room||'')}">ยอมรับ</button><button class="pnt-no" data-notify-reject="${esc(p.requester_id)}" data-room="${esc(n.room||'')}">ปฏิเสธ</button>`}if(n.type==='join_approved'){actions+=`<button class="pnt-ok" data-notify-enter="${esc(n.room||'')}">เข้าห้อง</button>`}if((n.type==='assignment_received'||n.type==='assignment_sent')&&Number.isFinite(Number(n.lat))&&Number.isFinite(Number(n.lng))){actions+=`<button class="pnt-ok" data-notify-detail="${n.id}">อ่านรายละเอียด</button><button class="pnt-go" data-notify-warp="${n.id}">วาร์ปไปจุด</button>`}actions+=`<button class="pnt-del" data-notify-delete="${n.id}">ลบ</button>`;return `<div class="pnt-item ${n.read_at?'':'unread'}" data-notify-id="${n.id}"><div class="pnt-title">${esc(n.title||'แจ้งเตือน')}</div><div class="pnt-msg">${esc(n.message||'')}</div><div class="pnt-meta">${esc(n.room?`ห้อง ${n.room} • `:'')}${isNaN(d)?'':d.toLocaleString('th-TH')}</div>${actions?`<div class="pnt-actions">${actions}</div>`:''}</div>`}).join('');
  wrap.querySelectorAll('[data-notify-approve]').forEach(b=>b.onclick=()=>approveJoinFromNotification(b.dataset.room,b.dataset.notifyApprove,true));wrap.querySelectorAll('[data-notify-reject]').forEach(b=>b.onclick=()=>approveJoinFromNotification(b.dataset.room,b.dataset.notifyReject,false));wrap.querySelectorAll('[data-notify-enter]').forEach(b=>b.onclick=()=>enterRoom(b.dataset.notifyEnter));wrap.querySelectorAll('[data-notify-detail]').forEach(b=>b.onclick=()=>openPinmapNotificationDetail(Number(b.dataset.notifyDetail)));wrap.querySelectorAll('[data-notify-warp]').forEach(b=>b.onclick=()=>warpToPinmapNotification(Number(b.dataset.notifyWarp)));wrap.querySelectorAll('[data-notify-delete]').forEach(b=>b.onclick=()=>deletePinmapNotification(Number(b.dataset.notifyDelete)));wrap.querySelectorAll('.pnt-item').forEach(el=>el.addEventListener('click',e=>{if(e.target.closest('button'))return;markPinmapNotificationRead(Number(el.dataset.notifyId))}));
}
async function deletePinmapNotification(id){
  if(!S.sb||!S.session)return;
  if(!confirm("ลบการแจ้งเตือนนี้ใช่หรือไม่?"))return;
  try{
    const {error}=await S.sb.from("pinmap_notifications").delete().eq("id",id).eq("user_id",S.session.user.id);
    if(error)throw error;
    pinmapNotifications=pinmapNotifications.filter(x=>Number(x.id)!==Number(id));
    pinmapRenderNotifyBadge();renderPinmapNotifications();
    toast("ลบการแจ้งเตือนแล้ว");
  }catch(err){toast(err.message||"ลบการแจ้งเตือนไม่สำเร็จ")}
}
async function markPinmapNotificationRead(id){const n=pinmapNotifications.find(x=>Number(x.id)===Number(id));if(!n||n.read_at)return;try{await S.sb.from("pinmap_notifications").update({read_at:new Date().toISOString()}).eq("id",id).eq("user_id",S.session.user.id);n.read_at=new Date().toISOString();pinmapRenderNotifyBadge();renderPinmapNotifications()}catch(_){} }
async function approveJoinFromNotification(room,userId,approve){
  try{const {error}=await S.sb.rpc("pinmap_approve_member",{p_room:room,p_user_id:userId,p_approve:!!approve});if(error)throw error;toast(approve?"อนุมัติสมาชิกแล้ว":"ปฏิเสธคำขอแล้ว");await loadPinmapNotifications();if(S.room===room)await pinmapLoadRoomContext()}catch(err){toast(err.message||"ทำรายการไม่สำเร็จ")}
}
function openPinmapNotificationDetail(id){const n=pinmapNotifications.find(x=>Number(x.id)===Number(id));if(!n)return;const p=n.payload||{};$("pndBody").textContent=[n.title,n.message,p.description?`\nคำอธิบาย:\n${p.description}`:'',p.recipients?`\nส่งให้: ${Array.isArray(p.recipients)?p.recipients.join(', '):p.recipients}`:''].filter(Boolean).join('\n');$("pndActions").innerHTML=(Number.isFinite(Number(n.lat))&&Number.isFinite(Number(n.lng)))?`<button class="pnt-go" id="pndWarp">วาร์ปไปจุด</button>`:'';if($("pndWarp"))$("pndWarp").onclick=()=>warpToPinmapNotification(id);$("pinmapNotificationDetail").classList.remove("hidden");markPinmapNotificationRead(id)}
async function warpToPinmapNotification(id){const n=pinmapNotifications.find(x=>Number(x.id)===Number(id));if(!n)return;if(n.room&&n.room!==S.room){const {data,error}=await S.sb.rpc("pinmap_enter_member",{p_room:n.room});if(error||!data)return toast("คุณไม่ได้เป็นสมาชิกห้องนี้แล้ว");await enterRoom(n.room)}map.flyTo([Number(n.lat),Number(n.lng)],Math.max(17,map.getZoom()),{duration:.8});$("pinmapNotificationDetail")?.classList.add("hidden");$("pinmapNotificationPanel")?.classList.add("hidden");pinmapNotificationPanelOpen=false;markPinmapNotificationRead(id)}

function stopPinmapPersonalNotifications(){if(S.notifyCh&&S.sb){try{S.sb.removeChannel(S.notifyCh)}catch(_){}}S.notifyCh=null}
function startPinmapPersonalNotifications(){
  stopPinmapPersonalNotifications();if(!S.sb||!S.session)return;const uid=S.session.user.id;
  S.notifyCh=S.sb.channel(`pinmap-personal-${uid}`)
    .on("postgres_changes",{event:"*",schema:"public",table:"pinmap_notifications",filter:`user_id=eq.${uid}`},payload=>{loadPinmapNotifications();if(payload.eventType==='INSERT'&&payload.new?.title)toast(payload.new.title)})
    .on("postgres_changes",{event:"*",schema:"public",table:"pinmap_room_members",filter:`user_id=eq.${uid}`},async payload=>{if(S.room&&(String(payload.old?.room||payload.new?.room||'')===String(S.room))){const {data}=await S.sb.rpc("pinmap_enter_member",{p_room:S.room});if(!data)await pinmapExitRoomLocal("คุณออกจากทีม/ถูกนำออกจากทีมแล้ว");else await pinmapLoadRoomContext()}loadSavedRooms()})
    .subscribe();
}

async function openPinmapAssignmentModal(info){
  if(!S.session)return openAuth("เข้าสู่ระบบก่อน");if(!S.room)return toast("กรุณาเข้าห้องก่อน");
  const ctx=await pinmapLoadRoomContext();if(!ctx?.is_member)return toast("คุณไม่ได้เป็นสมาชิกห้องนี้");pinmapAssignTarget=info;$("ptaTitle").textContent=`📌 มอบหมาย: ${info.title||'จุด'}`;$("ptaPoint").textContent=`${info.title||''} • ${Number(info.lat).toFixed(6)}, ${Number(info.lng).toFixed(6)}`;$("ptaDescription").value="";const me=S.session.user.id;const members=(ctx.members||[]).filter(m=>m.status==='active'&&String(m.user_id)!==String(me));$("ptaMembers").innerHTML=members.length?members.map(m=>`<label class="pta-user"><input type="checkbox" value="${esc(m.user_id)}"><span>${esc(m.username||'ผู้ใช้')}${m.is_leader?' 👑':''}</span></label>`).join(''):'<div style="font-size:12px;color:#777">ยังไม่มีสมาชิกคนอื่นในห้อง</div>';$("pinmapAssignModal").classList.remove("hidden")
}
async function sendPinmapAssignment(){
  if(!pinmapAssignTarget)return;const ids=[...document.querySelectorAll('#ptaMembers input:checked')].map(x=>x.value);if(!ids.length)return toast("กรุณาเลือกผู้รับอย่างน้อย 1 คน");const d=$("ptaDescription")?.value.trim()||"";const t=pinmapAssignTarget;
  try{const {error}=await S.sb.rpc("pinmap_create_assignment",{p_room:S.room,p_pin_kind:t.kind||'pin',p_pin_id:String(t.id??''),p_pin_title:t.title||'จุด',p_lat:Number(t.lat),p_lng:Number(t.lng),p_description:d,p_recipient_ids:ids});if(error)throw error;$("pinmapAssignModal").classList.add("hidden");toast(`ส่งมอบหมายให้ ${ids.length} คนแล้ว`);await loadPinmapNotifications()}catch(err){toast(err.message||"ส่งมอบหมายไม่สำเร็จ")}
}

document.addEventListener("click",e=>{const b=e.target.closest?.(".pinAssignBtn");if(!b)return;e.preventDefault();e.stopPropagation();openPinmapAssignmentModal({kind:b.dataset.kind||'pin',id:b.dataset.id||'',title:b.dataset.title||'จุด',lat:Number(b.dataset.lat),lng:Number(b.dataset.lng)})},true);


/* ── ROOM JOIN + PINS LOAD + REALTIME ── */
const PINMAP_PIN_SELECT = "id,room,lat,lng,title,point_no,address,area,note,created_by,created_by_user_id,color,icon,created_at";
let pinmapPinLoadSeq = 0;

// Existing blank addresses are computed locally from lat/lng using the
// loaded province / amphoe / tambon polygons, then backfilled to Supabase.
const pinmapAddressBackfilledRooms = new Set();

async function pinmapHydratePinAddresses(rows) {
  if (!Array.isArray(rows) || !rows.length || !window.pinmapAdminAddressFromLatLng) return rows || [];
  for (const p of rows) {
    if (!p || String(p.address || "").trim()) continue;
    const lat = Number(p.lat), lng = Number(p.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    try {
      const addr = await window.pinmapAdminAddressFromLatLng(lat, lng);
      if (addr) p.address = addr;
    } catch (err) {
      console.warn("คำนวณ Address ของ pin ไม่สำเร็จ", p?.id, err);
    }
  }
  return rows;
}

async function pinmapPersistMissingPinAddresses(rows) {
  if (!S.sb || !S.room || !Array.isArray(rows)) return;
  const targets = rows.filter(p => p?.id != null && String(p.address || "").trim());
  let cursor = 0;
  const workers = Math.min(4, targets.length);
  async function worker() {
    while (cursor < targets.length) {
      const p = targets[cursor++];
      try {
        const { error } = await S.sb
          .from("pins")
          .update({ address: p.address })
          .eq("id", p.id)
          .eq("room", S.room);
        if (error) console.warn("อัปเดต Address ไม่สำเร็จ", p.id, error);
      } catch (err) {
        console.warn("อัปเดต Address ไม่สำเร็จ", p.id, err);
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, worker));
}

async function pinmapBackfillCurrentRoomAddresses() {
  if (!S.sb || !S.room || pinmapAddressBackfilledRooms.has(S.room)) return;
  pinmapAddressBackfilledRooms.add(S.room);
  try {
    const rows = await fetchAllPinsRoom();
    const missing = rows.filter(p => !String(p.address || "").trim());
    if (!missing.length) return;

    await pinmapHydratePinAddresses(missing);
    const ready = missing.filter(p => String(p.address || "").trim());
    if (!ready.length) return;

    await pinmapPersistMissingPinAddresses(ready);

    const byId = new Map(ready.map(p => [String(p.id), p.address]));
    S.all.forEach(p => {
      const a = byId.get(String(p.id));
      if (a) p.address = a;
    });
    rebuild();
    toast(`เติม Address อัตโนมัติแล้ว ${ready.length.toLocaleString("th-TH")} จุด`);
  } catch (err) {
    pinmapAddressBackfilledRooms.delete(S.room);
    console.warn("Backfill Address ไม่สำเร็จ", err);
  }
}

function pinmapPinMatchesSearch(p, q) {
  if (!q) return true;
  return (
    String(p?.title || "") + " " +
    String(p?.address || "") + " " +
    String(p?.area || "") + " " +
    String(p?.note || "")
  ).toLowerCase().includes(String(q).toLowerCase());
}

async function loadPinsViewport() {
  if (!S.sb || !S.room) return;

  const seq = ++pinmapPinLoadSeq;
  const bounds = pinmapVisibleBounds();
  const south = bounds.getSouth();
  const north = bounds.getNorth();
  const west = bounds.getWest();
  const east = bounds.getEast();

  const { data, error } = await S.sb
    .from("pins")
    .select(PINMAP_PIN_SELECT)
    .eq("room", S.room)
    .gte("lat", south)
    .lte("lat", north)
    .gte("lng", west)
    .lte("lng", east)
    .order("created_at", { ascending: false })
    .limit(PINMAP_MAX_VISIBLE_POINTS);

  if (seq !== pinmapPinLoadSeq) return;
  if (error) { toast(error.message); return; }

  S.all = data || [];
  await pinmapHydratePinAddresses(S.all);
  rebuild();
}

function pinmapSafePostgrestSearch(value) {
  return String(value || "")
    .replace(/[,%()]/g, " ")
    .trim();
}

async function loadPinsSearch(queryText) {
  if (!S.sb || !S.room) return;

  const q = pinmapSafePostgrestSearch(queryText);
  if (!q) return loadPinsViewport();

  const seq = ++pinmapPinLoadSeq;
  const all = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await S.sb
      .from("pins")
      .select(PINMAP_PIN_SELECT)
      .eq("room", S.room)
      .or(`title.ilike.%${q}%,address.ilike.%${q}%,area.ilike.%${q}%,note.ilike.%${q}%`)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (seq !== pinmapPinLoadSeq) return;
    if (error) { toast(error.message); return; }

    if (data?.length) all.push(...data);
    if (!data || data.length < pageSize) break;
  }

  if (seq !== pinmapPinLoadSeq) return;
  S.all = all;
  await pinmapHydratePinAddresses(S.all);
  rebuild();
}

async function loadPins() {
  const q = pinmapSearchText();
  if (q && !parseCoordinateQuery(q)) return loadPinsSearch(q);
  return loadPinsViewport();
}

async function fetchAllPinsRoom() {
  if (!S.sb || !S.room) return [];

  const all = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await S.sb
      .from("pins")
      .select(PINMAP_PIN_SELECT)
      .eq("room", S.room)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (data?.length) all.push(...data);
    if (!data || data.length < pageSize) break;
  }

  return all;
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
  // Online status is now shown as a green dot beside each member name.
  const panel=$("pinmapRoomManager");
  if(panel && !panel.classList.contains("hidden") && pinmapRoomContext?.members){
    renderPinmapRoomMembers(pinmapRoomContext.members,!!pinmapRoomContext.is_leader);
  }
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
// The old Online buttons are replaced by "สมาชิกในห้อง" during team UI setup.


function applyPinRealtimeDelta(payload) {
  // Reuse this SAME Realtime payload for Dashboard; no second subscription/query.
  if (typeof window.pinmapDashboardApplyPinDelta === "function") {
    window.pinmapDashboardApplyPinDelta(payload);
  }
  const eventType = payload?.eventType;
  const q = pinmapSearchText();

  if (eventType === "DELETE") {
    const id = payload?.old?.id;
    if (id == null) return;
    S.all = S.all.filter(p => String(p.id) !== String(id));
    rebuild();
    return;
  }

  const row = payload?.new;
  if (!row || String(row.room) !== String(S.room)) return;

  const shouldKeep = q
    ? pinmapPinMatchesSearch(row, q)
    : pinmapInViewport(row.lat, row.lng);

  const idx = S.all.findIndex(p => String(p.id) === String(row.id));

  if (!shouldKeep) {
    if (idx >= 0) {
      S.all.splice(idx, 1);
      rebuild();
    }
    return;
  }

  if (idx >= 0) S.all[idx] = row;
  else S.all.push(row);

  // Normal mode remains capped at 200; search mode is intentionally uncapped.
  if (!q && S.all.length > PINMAP_MAX_VISIBLE_POINTS) {
    const center = map.getCenter();
    S.all.sort((a, b) =>
      pinmapDistanceToCenter(a.lat, a.lng, center) -
      pinmapDistanceToCenter(b.lat, b.lng, center)
    );
    S.all = S.all.slice(0, PINMAP_MAX_VISIBLE_POINTS);
  }

  rebuild();
}

function subscribeRealtime() {
  if (S.ch) { S.sb.removeChannel(S.ch); S.ch = null; }

  const presenceKey = S.session?.user?.id || `guest-${Math.random().toString(36).slice(2)}`;

  S.ch = S.sb.channel(`pins-${S.room}`, {
    config: {
      presence: { key: presenceKey }
    }
  })
    .on("postgres_changes", { event: "*", schema: "public", table: "pins", filter: `room=eq.${S.room}` }, applyPinRealtimeDelta)
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
  if (!S.session) return openAuth("เข้าสู่ระบบก่อน");
  try {
    const { data: allowed, error: memberError } = await S.sb.rpc("pinmap_enter_member", { p_room: room });
    if (memberError) throw memberError;
    if (!allowed) return toast("คุณยังไม่ได้รับอนุมัติให้เข้าห้องนี้");
  } catch (err) {
    return toast(err.message || "ตรวจสอบสิทธิ์ห้องไม่สำเร็จ");
  }
  S.room = room;
  await pinmapTouchRoomMember();
  await pinmapLoadRoomContext();
  refreshUserUI();
  toast(`เข้าสู่ห้อง: ${room}`);
  if (pinmapRoomContext?.is_leader && !pinmapRoomContext?.password) {
    setTimeout(() => { toast("ห้องเดิมยังไม่มีรหัสในระบบหัวห้อง กรุณาตั้งรหัสใหม่ 👑"); openPinmapRoomManager(); }, 350);
  }
  await loadPins();
  void pinmapBackfillCurrentRoomAddresses();
  subscribeRealtime();
  loadPinmapNotifications();
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
      const { data, error } = await S.sb.rpc("pinmap_request_join", { p_room: rm, p_passcode: pass, p_username: username() });
      if (error) throw error;
      const status = String(data || "");
      if (status === "created") {
        toast("สร้างห้องแล้ว คุณเป็นหัวห้องคนแรก 👑");
        await enterRoom(rm);
      } else if (status === "joined") {
        await enterRoom(rm);
      } else if (status === "pending") {
        toast("ส่งคำขอเข้าห้องแล้ว รอหัวห้องกดยอมรับ");
        await loadPinmapNotifications();
      } else if (status === "wrong_password") {
        toast("รหัสห้องไม่ถูกต้อง");
      } else if (status === "password_not_set") {
        toast("ห้องเดิมนี้ยังไม่ได้ตั้งรหัสใหม่ กรุณาให้หัวห้องตั้งรหัสก่อน");
      } else {
        toast("ไม่สามารถเข้าห้องได้");
      }
    } else {
      const { data, error } = await S.sb.rpc("pinmap_enter_member", { p_room: rm });
      if (error) throw error;
      if (!data) { toast("ต้องใส่รหัสห้อง หรือรอหัวห้องอนุมัติก่อน"); return; }
      await enterRoom(rm);
    }
    if ($(passInputId) && S.room === rm) $(passInputId).value = "";
    await loadSavedRooms();
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

  // Pin choices: keep only the 7 requested choices.
  const iconRow = document.querySelector(".iconRow");
  if (iconRow) {
    iconRow.innerHTML = "";
    const choices = [
      ["m1", "M1", "m1.png"],
      ["cjx", "CJX", "logo-cjx.png"],
      ["van", "รถตู้", "van.webp"],
      ["deal", "เจรจรา", "deal.png"],
      ["pin", "Survey", ""],
      ["find", "ตามหา", "find.png"],
      ["x", "ไม่ให้เช่า", "no-rent.jpg"]
    ];
    choices.forEach(([key,title,src]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "iconBtn logoIconBtn";
      b.dataset.icon = key;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.style.cssText = [
        "display:inline-flex",
        "flex-direction:column",
        "align-items:center",
        "justify-content:flex-start",
        "gap:5px",
        "width:64px",
        "min-width:64px",
        "height:76px",
        "padding:6px 4px 5px",
        "background:#fff",
        "border:1px solid #e5e7eb",
        "border-radius:10px",
        "overflow:visible",
        "box-sizing:border-box"
      ].join(";");
      b.innerHTML = src
        ? `<span class="pinLogoVisual"><img src="${src}" alt="${title}" draggable="false"></span><span class="pinLogoLabel">${title}</span>`
        : `<span class="pinLogoVisual pinLogoEmoji">📍</span><span class="pinLogoLabel">${title}</span>`;
      b.onclick = () => {
        document.querySelectorAll(".iconBtn").forEach(x => x.classList.remove("active"));
        b.classList.add("active");
        $("icon").value = key;
        $("imgUploadWrap")?.classList.add("hidden");
        pinBuildColorSwatches(key, $("color")?.value);
      };
      iconRow.appendChild(b);
    });
  }

  // Roads: optimized canvas renderer for GitHub Pages.
  // Unlike normal Leaflet polylines, this draws all visible roads into ONE canvas.
  // This avoids creating thousands of Leaflet layer objects and greatly reduces lag.
  const ROAD_MIN_ZOOM = 12;
  const ROAD_CELL_SIZE = 0.25;
  let roadManifest = null;
  let roadManifestPromise = null;
  let roadRefreshTimer = null;
  let roadIdleTimer = null;
  let roadMapInteracting = false;

  const ROAD_GROUPS = {
    major:{label:"Primary / Secondary",codes:["p","s"],on:false},
    local:{label:"Tertiary / Residential",codes:["t","r"],on:false}
  };

  // One lightweight canvas overlay for all roads.
  const roadCanvas = document.createElement("canvas");
  roadCanvas.id = "pinmapRoadCanvas";
  roadCanvas.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;z-index:450;display:none;";
  // IMPORTANT: latLngToContainerPoint() returns coordinates relative to the map
  // container. Therefore the road canvas must also live directly in the map
  // container. Putting it inside overlayPane applies Leaflet's pane transform a
  // second time, which shifts roads and clips part of the network.
  map.getContainer().appendChild(roadCanvas);
  const roadCtx = roadCanvas.getContext("2d", {alpha:true, desynchronized:true});

  function resizeRoadCanvas(){
    const size=map.getSize();
    const ratio=Math.min(window.devicePixelRatio||1,2);
    roadCanvas.width=Math.max(1,Math.round(size.x*ratio));
    roadCanvas.height=Math.max(1,Math.round(size.y*ratio));
    roadCanvas.style.width=`${size.x}px`;
    roadCanvas.style.height=`${size.y}px`;
    roadCtx.setTransform(ratio,0,0,ratio,0,0);
  }

  function clearRoadCanvas(){
    const size=map.getSize();
    roadCtx.clearRect(0,0,size.x,size.y);
  }

  function pinmapLoadRoadScript(src,id){
    return new Promise((resolve,reject)=>{
      if(id && document.getElementById(id)) return resolve();
      const sc=document.createElement("script");
      if(id) sc.id=id;
      sc.src=src;
      sc.async=true;
      sc.onload=resolve;
      sc.onerror=()=>reject(new Error(`โหลด ${src} ไม่สำเร็จ`));
      document.head.appendChild(sc);
    });
  }

  async function ensureRoadManifest(){
    if(roadManifest) return roadManifest;
    if(window.PINMAP_ROAD_MANIFEST){
      roadManifest=window.PINMAP_ROAD_MANIFEST;
      return roadManifest;
    }
    if(roadManifestPromise) return roadManifestPromise;
    roadManifestPromise=(async()=>{
      await pinmapLoadRoadScript("manifest.js","pinmapRoadManifestScript");
      roadManifest=window.PINMAP_ROAD_MANIFEST;
      if(!roadManifest) throw new Error("ไม่พบ PINMAP_ROAD_MANIFEST");
      return roadManifest;
    })().finally(()=>{roadManifestPromise=null;});
    return roadManifestPromise;
  }

  function pinmapDecodeRoadPolyline(str,precision=5){
    let index=0,lat=0,lng=0,coords=[];
    const factor=Math.pow(10,precision);
    while(index<str.length){
      let result=0,shift=0,b;
      do{b=str.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5;}while(b>=0x20);
      lat+=(result&1)?~(result>>1):(result>>1);
      result=0;shift=0;
      do{b=str.charCodeAt(index++)-63;result|=(b&0x1f)<<shift;shift+=5;}while(b>=0x20);
      lng+=(result&1)?~(result>>1):(result>>1);
      coords.push([lat/factor,lng/factor]);
    }
    return coords;
  }

  function neededRoadCells(){
    if(!roadManifest) return [];
    const b=map.getBounds();
    const pad=ROAD_CELL_SIZE;
    const y1=Math.floor((b.getSouth()-pad)/ROAD_CELL_SIZE);
    const y2=Math.floor((b.getNorth()+pad)/ROAD_CELL_SIZE);
    const x1=Math.floor((b.getWest()-pad)/ROAD_CELL_SIZE);
    const x2=Math.floor((b.getEast()+pad)/ROAD_CELL_SIZE);
    const out=[];
    for(let gy=y1;gy<=y2;gy++){
      for(let gx=x1;gx<=x2;gx++){
        const key=`${gy}_${gx}`;
        if(roadManifest.cells?.[key]) out.push(key);
      }
    }
    return out;
  }

  async function ensureRoadChunk(key){
    window.PINMAP_ROAD_CHUNKS=window.PINMAP_ROAD_CHUNKS||{};
    window.PINMAP_ROAD_BUNDLES=window.PINMAP_ROAD_BUNDLES||{};
    if(window.PINMAP_ROAD_CHUNKS[key]) return window.PINMAP_ROAD_CHUNKS[key];

    const bundleKey=roadManifest?.cellToBundle?.[key];
    if(!bundleKey) return null;

    if(!window.PINMAP_ROAD_BUNDLES[bundleKey]){
      const safe=bundleKey.replace(/[^a-zA-Z0-9_-]/g,"_");
      await pinmapLoadRoadScript(`bundle_${bundleKey}.js`,`pinmapRoadBundle_${safe}`);
    }

    window.PINMAP_ROAD_U_CHUNKS=window.PINMAP_ROAD_U_CHUNKS||{};
    window.PINMAP_ROAD_U_BUNDLES=window.PINMAP_ROAD_U_BUNDLES||{};
    if(!window.PINMAP_ROAD_U_BUNDLES[bundleKey]){
      const safeU=bundleKey.replace(/[^a-zA-Z0-9_-]/g,"_");
      await pinmapLoadRoadScript(`u_bundle_${bundleKey}.js`,`pinmapRoadUBundle_${safeU}`);
    }
    const base=window.PINMAP_ROAD_CHUNKS[key]||null;
    if(base) base.u=window.PINMAP_ROAD_U_CHUNKS[key]||[];
    return base;
  }

  function drawEncodedRoad(encoded,color,width,opacity){
    const pts=pinmapDecodeRoadPolyline(encoded,5);
    if(pts.length<2) return;
    roadCtx.beginPath();
    let started=false;
    for(const ll of pts){
      const p=map.latLngToContainerPoint([ll[0],ll[1]]);
      if(!started){ roadCtx.moveTo(p.x,p.y); started=true; }
      else roadCtx.lineTo(p.x,p.y);
    }
    roadCtx.strokeStyle=color;
    roadCtx.lineWidth=width;
    roadCtx.globalAlpha=opacity;
    roadCtx.lineJoin="round";
    roadCtx.lineCap="round";
    roadCtx.stroke();
  }

  async function redrawRoadCanvas(){
    if(roadMapInteracting) return;
    const anyOn=ROAD_GROUPS.major.on||ROAD_GROUPS.local.on;
    if(!anyOn || map.getZoom()<ROAD_MIN_ZOOM){
      roadCanvas.style.display="none";
      clearRoadCanvas();
      return;
    }

    await ensureRoadManifest();
    const keys=neededRoadCells();

    // Load only currently-needed small chunks.
    const chunks=await Promise.all(keys.map(ensureRoadChunk));
    if(roadMapInteracting) return;

    resizeRoadCanvas();
    clearRoadCanvas();

    // Primary / Secondary keep their previous styles.
    if(ROAD_GROUPS.major.on){
      for(const data of chunks){
        if(!data) continue;
        for(const s of (data.p||[])) drawEncodedRoad(s,"#e11d48",3.2,.92);
        for(const s of (data.s||[])) drawEncodedRoad(s,"#f59e0b",2.5,.90);
      }
    }

    // Tertiary + Residential (+ unclassified): SAME yellow and SAME 1.5 px width.
    if(ROAD_GROUPS.local.on){
      for(const data of chunks){
        if(!data) continue;
        for(const s of (data.t||[])) drawEncodedRoad(s,"#ffd400",1.5,.96);
        for(const s of (data.r||[])) drawEncodedRoad(s,"#ffd400",1.5,.96);
          for(const s of (data.u||[])) drawEncodedRoad(s,"#ffd400",1.5,.96);
      }
    }

    roadCtx.globalAlpha=1;
    roadCanvas.style.display="block";
  }

  function syncRoadButtons(){
    roadMajorBtn?.classList.toggle("active",ROAD_GROUPS.major.on);
    mRoadMajorBtn?.classList.toggle("active",ROAD_GROUPS.major.on);
    roadLocalBtn?.classList.toggle("active",ROAD_GROUPS.local.on);
    mRoadLocalBtn?.classList.toggle("active",ROAD_GROUPS.local.on);
    const anyOn=ROAD_GROUPS.major.on||ROAD_GROUPS.local.on;
    roadBtn?.classList.toggle("active",anyOn);
    mRoadBtn?.classList.toggle("active",anyOn);
  }

  async function toggleRoadGroup(name){
    const group=ROAD_GROUPS[name];
    group.on=!group.on;
    syncRoadButtons();
    if(!group.on && !(ROAD_GROUPS.major.on||ROAD_GROUPS.local.on)){
      roadCanvas.style.display="none";
      clearRoadCanvas();
      toast(`ปิดถนน ${group.label}`);
      return;
    }
    try{
      await ensureRoadManifest();
      await redrawRoadCanvas();
      toast(map.getZoom()>=ROAD_MIN_ZOOM
        ? `${group.on?"เปิด":"ปิด"}ถนน ${group.label}`
        : `ซูมถึงระดับ ${ROAD_MIN_ZOOM} เพื่อแสดงถนน`);
    }catch(err){
      console.error("Road load error:",err);
      group.on=false;
      syncRoadButtons();
      toast("โหลดข้อมูลถนนไม่สำเร็จ — ตรวจสอบ manifest.js และ bundle_*.js ว่าอยู่ข้าง app.js");
    }
  }

  function beginRoadInteraction(){
    if(!(ROAD_GROUPS.major.on||ROAD_GROUPS.local.on)) return;
    roadMapInteracting=true;
    clearTimeout(roadRefreshTimer);
    clearTimeout(roadIdleTimer);
    // Hide the static road canvas while moving/zooming.
    roadCanvas.style.display="none";
  }

  function endRoadInteraction(){
    if(!(ROAD_GROUPS.major.on||ROAD_GROUPS.local.on)) return;
    clearTimeout(roadIdleTimer);
    // Longer idle delay avoids repeated redraws during wheel-zoom or momentum panning.
    roadIdleTimer=setTimeout(async()=>{
      roadMapInteracting=false;
      await redrawRoadCanvas();
    },420);
  }

  map.on("movestart zoomstart",beginRoadInteraction);
  map.on("moveend zoomend",endRoadInteraction);
  map.on("resize",()=>{
    if(!roadMapInteracting) {
      clearTimeout(roadRefreshTimer);
      roadRefreshTimer=setTimeout(redrawRoadCanvas,250);
    }
  });

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
  let roadBtn=null, roadMajorBtn=null, roadLocalBtn=null, roadPanel=null, importBtn=null, mRoadBtn=null, mRoadMajorBtn=null, mRoadLocalBtn=null, mRoadPanel=null, mImportBtn=null;
  if (sidebarBody) {
    const anchor = $("dolToggle") || $("locate");
    roadBtn = makeButton("roadToggle", "🛣️ Road");
    roadBtn.classList.add("pinmap-road-item");

    roadPanel=document.createElement("div");
    roadPanel.id="roadPanel";
    roadPanel.className="pinmap-road-subpanel hidden";
    roadPanel.style.cssText="display:none;padding:4px 0 4px 14px;gap:4px;flex-direction:column";
    roadMajorBtn=makeButton("roadMajorToggle","↳ Primary / Secondary");
    roadLocalBtn=makeButton("roadLocalToggle","↳ Tertiary / Residential");
    roadPanel.append(roadMajorBtn,roadLocalBtn);

    importBtn = makeButton("importAdd", "📥 Import KML/CSV");
    importBtn.classList.add("pinmap-kml-item");

    anchor?.parentNode.insertBefore(roadBtn, anchor.nextSibling);
    roadBtn.parentNode.insertBefore(roadPanel, roadBtn.nextSibling);
    roadBtn.parentNode.insertBefore(importBtn, roadPanel.nextSibling);

    roadBtn.onclick=()=>{
      const open=roadPanel.style.display!=="flex";
      roadPanel.style.display=open?"flex":"none";
      roadPanel.classList.toggle("hidden",!open);
    };
    roadMajorBtn.onclick=()=>toggleRoadGroup("major");
    roadLocalBtn.onclick=()=>toggleRoadGroup("local");
    importBtn.onclick=addImport;
  }
  if (mobileMenuBody) {
    const anchor = $("mDolBtn") || $("mBoundaryToggle");
    mRoadBtn = makeButton("mRoadToggle", "🛣️ Road");
    mRoadBtn.classList.add("pinmap-road-item");

    mRoadPanel=document.createElement("div");
    mRoadPanel.id="mRoadPanel";
    mRoadPanel.className="pinmap-road-subpanel hidden";
    mRoadPanel.style.cssText="display:none;padding:4px 0 4px 14px;gap:4px;flex-direction:column";
    mRoadMajorBtn=makeButton("mRoadMajorToggle","↳ Primary / Secondary");
    mRoadLocalBtn=makeButton("mRoadLocalToggle","↳ Tertiary / Residential");
    mRoadPanel.append(mRoadMajorBtn,mRoadLocalBtn);

    mImportBtn = makeButton("mImportAdd", "📥 Import KML/CSV");
    mImportBtn.classList.add("pinmap-kml-item");

    anchor?.parentNode.insertBefore(mRoadBtn, anchor.nextSibling);
    mRoadBtn.parentNode.insertBefore(mRoadPanel, mRoadBtn.nextSibling);
    mRoadBtn.parentNode.insertBefore(mImportBtn, mRoadPanel.nextSibling);

    mRoadBtn.onclick=()=>{
      const open=mRoadPanel.style.display!=="flex";
      mRoadPanel.style.display=open?"flex":"none";
      mRoadPanel.classList.toggle("hidden",!open);
    };
    mRoadMajorBtn.onclick=()=>toggleRoadGroup("major");
    mRoadLocalBtn.onclick=()=>toggleRoadGroup("local");
    mImportBtn.onclick=addImport;
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

async function supabaseGetAll(tableName, columns = "*") {

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
        .select(columns)
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



const PINMAP_STATIC_SEVEN11 = (window.SEVEN11_DATA || []).map(x => ({ ...x }));
const PINMAP_STATIC_CJMORE = (window.CJMORE_DATA || []).map(x => ({ ...x }));
const PINMAP_S11_TOMBSTONE_COLOR = "__deleted__";

async function supabaseGetCustomRows(tableName, columns) {
  if (!S.sb) return [];

  const all = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await S.sb
      .from(tableName)
      .select(columns)
      .eq("is_custom", true)
      .range(from, from + pageSize - 1);

    if (error) throw error;
    if (data?.length) all.push(...data);
    if (!data || data.length < pageSize) break;
  }

  return all;
}

function pinmapNormalizeDedupeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pinmapCoordKey(lat, lng) {
  const y = Number(lat);
  const x = Number(lng);
  if (!Number.isFinite(y) || !Number.isFinite(x)) return "";
  // 5 decimals is roughly meter-level precision and removes tiny import-format differences.
  return `${y.toFixed(5)},${x.toFixed(5)}`;
}

function pinmapS11Signature(row) {
  const id = pinmapNormalizeDedupeText(row?.id);
  const name = pinmapNormalizeDedupeText(
    row?.name_th ?? row?.n ?? row?.name_en ?? row?.name
  );

  // 7-Eleven: ถือว่าซ้ำเมื่อ "id + name_th" ตรงกันคู่กัน
  if (!id || !name) return "";
  return `${id}|${name}`;
}

function pinmapCJSignature(row) {
  const code = pinmapNormalizeDedupeText(row?.code);
  const name = pinmapNormalizeDedupeText(row?.name);

  // CJ MORE: ถือว่าซ้ำเมื่อ "code + name" ตรงกันคู่กัน
  if (!code || !name) return "";
  return `${code}|${name}`;
}

function pinmapMergeCompetitorRows(baseRows, overrideRows, signatureFn, isDeleted = () => false, primaryKeyFn = row => String(row?.id ?? "")) {
  const byPrimary = new Map();
  const basePrimary = new Set();
  const baseSignatures = new Set();

  (baseRows || []).forEach(row => {
    const primary = String(primaryKeyFn(row) ?? "");
    const copy = { ...row };

    if (primary) {
      byPrimary.set(primary, copy);
      basePrimary.add(primary);
    }

    const sig = signatureFn(copy);
    if (sig) baseSignatures.add(sig);
  });

  (overrideRows || []).forEach(row => {
    const primary = String(primaryKeyFn(row) ?? "");

    if (isDeleted(row)) {
      if (primary) byPrimary.delete(primary);
      return;
    }

    // ถ้าเป็น record เดิมที่ถูกแก้ ให้ Supabase override static ได้
    if (primary && basePrimary.has(primary)) {
      byPrimary.set(primary, { ...row });
      return;
    }

    // ถ้า pair ที่ใช้ตรวจซ้ำตรงกับ static อยู่แล้ว ไม่แสดงซ้ำ
    const sig = signatureFn(row);
    if (sig && baseSignatures.has(sig)) return;

    if (primary) byPrimary.set(primary, { ...row });
  });

  // กัน duplicate ในกลุ่ม custom/override เอง ด้วย pair เดียวกัน
  const seen = new Set();
  const result = [];

  for (const row of byPrimary.values()) {
    const sig = signatureFn(row);
    if (sig && seen.has(sig)) continue;
    if (sig) seen.add(sig);
    result.push(row);
  }

  return result;
}

function pinmapS11IsDuplicateOfStatic(row) {
  const id = String(row?.id ?? "").trim();

  // Same 7-Eleven ID = the same branch. Allow Supabase to override its
  // coordinates/details instead of treating it as a duplicate.
  if (id && PINMAP_STATIC_SEVEN11.some(x => String(x?.id ?? "").trim() === id)) {
    return false;
  }

  const sig = pinmapS11Signature(row);
  return !!sig && PINMAP_STATIC_SEVEN11.some(x => pinmapS11Signature(x) === sig);
}

function pinmapCJIsDuplicateOfStatic(row) {
  const code = pinmapNormalizeDedupeText(row?.code);

  // Same CJ MORE code = the same branch. Allow moved/edited Supabase data
  // to override the static record instead of disappearing from the map.
  if (code && PINMAP_STATIC_CJMORE.some(x => pinmapNormalizeDedupeText(x?.code) === code)) {
    return false;
  }

  const sig = pinmapCJSignature(row);
  return !!sig && PINMAP_STATIC_CJMORE.some(x => pinmapCJSignature(x) === sig);
}

async function loadCompetitorDataFromSupabase() {
  if (!S.sb) return;

  try {
    // Base nationwide datasets already come from seven11-data.js / cjmore-data.js.
    // Supabase now transfers only custom rows and edited overrides.
    const sevenRows = await supabaseGetCustomRows(
      "7-11",
      "id,name_th,name_en,address_th,address_en,note,color,latitude,longitude,telephone,website,is_custom"
    );

    const sevenOverrides = sevenRows.map(row => ({
      id: row.id,
      n: row.name_th || row.name_en || "7-Eleven",
      a: row.address_th || row.address_en || "",
      note: row.note || "",
      color: row.color || "green",
      y: Number(row.latitude),
      x: Number(row.longitude),
      telephone: row.telephone || "",
      website: row.website || "",
      is_custom: row.is_custom === true
    }));

    window.SEVEN11_DATA = pinmapMergeCompetitorRows(
      PINMAP_STATIC_SEVEN11,
      sevenOverrides,
      pinmapS11Signature,
      row => row.color === PINMAP_S11_TOMBSTONE_COLOR,
      row => String(row?.id ?? "")
    ).filter(row =>
      Number.isFinite(Number(row.y)) &&
      Number.isFinite(Number(row.x))
    );

    const cjRows = await supabaseGetCustomRows(
      "CJMore",
      "id,code,name,address,tel,description,lat,long,is_custom"
    );

    const cjOverrides = cjRows.map(row => ({
      id: row.id,
      code: row.code || "",
      name: row.name || "CJ MORE",
      address: row.address || "",
      tel: row.tel || "",
      description: row.description || "",
      lat: Number(row.lat),
      lng: Number(row.long),
      is_custom: row.is_custom === true
    }));

    window.CJMORE_DATA = pinmapMergeCompetitorRows(
      PINMAP_STATIC_CJMORE,
      cjOverrides,
      pinmapCJSignature,
      () => false,
      row => String(row?.code ?? "")
    ).filter(row =>
      Number.isFinite(Number(row.lat)) &&
      Number.isFinite(Number(row.lng))
    );

    S11.all = [];
    CJ.all = [];
    s11Update();
    cjUpdate();
  } catch (err) {
    console.error("Competitor Supabase load error:", err);
    toast("โหลดข้อมูลที่เพิ่ม/แก้ไขของ 7-Eleven / CJ MORE จาก Supabase ไม่สำเร็จ");
  }
}
/* =========================================================
   COMPETITOR FAST UI REFRESH
   - Update the visible map immediately after CRUD.
   - Supabase reload happens in the background.
   - Realtime events are debounced to avoid duplicate full reloads.
   ========================================================= */

let competitorReloadTimer = null;
let competitorReloadInFlight = false;
let competitorReloadQueued = false;

function scheduleCompetitorReload(delay = 500) {
  clearTimeout(competitorReloadTimer);
  competitorReloadTimer = setTimeout(async () => {
    competitorReloadTimer = null;

    if (competitorReloadInFlight) {
      competitorReloadQueued = true;
      return;
    }

    competitorReloadInFlight = true;
    try {
      await loadCompetitorDataFromSupabase();
    } catch (err) {
      console.error("[Competitor] background reload error:", err);
    } finally {
      competitorReloadInFlight = false;
      if (competitorReloadQueued) {
        competitorReloadQueued = false;
        scheduleCompetitorReload(250);
      }
    }
  }, delay);
}

function fastRefreshS11(rec) {
  if (!rec) return;
  const id = String(rec.id ?? "");

  if (rec.color === PINMAP_S11_TOMBSTONE_COLOR) {
    fastDeleteS11(id);
    return;
  }

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

  if (pinmapS11IsDuplicateOfStatic(next)) {
    // Same store already exists in seven11-data.js; ignore the duplicate Supabase row.
    const duplicateId = String(next.id ?? "");
    window.SEVEN11_DATA = (window.SEVEN11_DATA || [])
      .filter(x => String(x.id ?? "") !== duplicateId);
    s11Update();
    return;
  }

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

  if (pinmapCJIsDuplicateOfStatic(next)) {
    // Same store already exists in cjmore-data.js; ignore the duplicate Supabase row.
    const duplicateId = String(next.id ?? "");
    window.CJMORE_DATA = (window.CJMORE_DATA || [])
      .filter(x => String(x.id ?? "") !== duplicateId);
    cjUpdate();
    return;
  }

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

  // กันการเปิด channel ซ้ำ
  if (competitorRealtimeChannel) {
    try {
      S.sb.removeChannel(competitorRealtimeChannel);
    } catch (e) {}
    competitorRealtimeChannel = null;
  }

  competitorRealtimeChannel = S.sb
    .channel("pinmap-competitor-realtime")

    /* ---------- 7-ELEVEN ---------- */
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "7-11"
      },
      (payload) => {
        console.log("[Realtime] 7-11:", payload.eventType, payload);

        try {
          if (payload.eventType === "DELETE") {
            const id = payload.old?.id;
            if (id != null) fastDeleteS11(id);
          } else if (payload.new) {
            fastRefreshS11(payload.new);
          }
        } catch (err) {
          console.error("[Realtime] 7-11 delta error:", err);
        }
      }
    )

    /* ---------- CJ MORE ---------- */
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "CJMore"
      },
      (payload) => {
        console.log("[Realtime] CJMore:", payload.eventType, payload);

        try {
          if (payload.eventType === "DELETE") {
            const id = payload.old?.id;
            if (id != null) fastDeleteCJ(id);
          } else if (payload.new) {
            fastRefreshCJ(payload.new);
          }
        } catch (err) {
          console.error("[Realtime] CJMore delta error:", err);
        }
      }
    )

    .subscribe((status) => {
      console.log("[Realtime] Competitor:", status);
    });
}

/* ── INIT ── */
function onAuthReady() {
  refreshUserUI();
  loadSavedRooms();
  if (S.session) {
    startSavedRoomsRealtime();
    startPinmapPersonalNotifications();
    loadPinmapNotifications();
  } else {
    stopSavedRoomsRealtime();
    stopPinmapPersonalNotifications();
    pinmapNotifications = [];
    pinmapRenderNotifyBadge();
  }
}


// Render at most 300 points on screen, with priority: user pins -> 7-Eleven -> CJ MORE.
// When a layer has more candidates than the remaining slots, prefer points nearest the screen center.
function pinmapSearchText() {
  return (($("search") ? $("search").value : "") || ($("mSearchInput") ? $("mSearchInput").value : "")).toLowerCase().trim();
}
function pinmapDistanceToCenter(lat, lng, center) {
  const dy = Number(lat) - center.lat;
  const dx = (Number(lng) - center.lng) * Math.cos(center.lat * Math.PI / 180);
  return dx * dx + dy * dy;
}
function pinmapApplyPointCap() {
  if (!PINMAP_ALL_POINTS_VISIBLE) {
    if (map.hasLayer(cluster)) map.removeLayer(cluster);
    if (map.hasLayer(s11Cluster)) map.removeLayer(s11Cluster);
    if (map.hasLayer(cjCluster)) map.removeLayer(cjCluster);
    if (typeof PINMAP_EXTRA_COMPETITORS !== "undefined") {
      for (const st of PINMAP_EXTRA_COMPETITORS.values()) if (map.hasLayer(st.layer)) map.removeLayer(st.layer);
    }
    return;
  }
  if (!map.hasLayer(cluster)) cluster.addTo(map);

  const bounds = pinmapVisibleBounds();
  const center = map.getCenter();
  const q = pinmapSearchText();
  const searching = !!q;
  const max = PINMAP_MAX_VISIBLE_POINTS;

  // Search can still match points globally, but rendering is always capped at 200.
  // Normal mode remains viewport-only.
  const pinList = S.all.filter(p =>
    (searching || pinmapInViewport(p.lat, p.lng, bounds)) &&
    (!q || pinmapPinMatchesSearch(p, q)) &&
    (!PINMAP_DASHBOARD_ICON_FILTER ||
      String(p.icon || "pin").trim().toLowerCase() === PINMAP_DASHBOARD_ICON_FILTER)
  );
  const s11List = S11.all.filter(x =>
    (searching || S11.on) &&
    (searching || pinmapInViewport(x.rec.y, x.rec.x, bounds)) &&
    (!q || (String(x.rec.n || "") + " " + String(x.rec.a || "")).toLowerCase().includes(q))
  );
  const cjList = CJ.all.filter(x =>
    (searching || CJ.on) &&
    (searching || pinmapInViewport(x.rec.lat, x.rec.lng, bounds)) &&
    (!q || (cjDisplayName(x.rec) + " " + (x.rec.address || "") + " " + (x.rec.description || "")).toLowerCase().includes(q))
  );

  const byCenter = (a, b) => a._pinmapDistance - b._pinmapDistance;
  pinList.forEach(p => p._pinmapDistance = pinmapDistanceToCenter(p.lat, p.lng, center));
  s11List.forEach(x => x._pinmapDistance = pinmapDistanceToCenter(x.rec.y, x.rec.x, center));
  cjList.forEach(x => x._pinmapDistance = pinmapDistanceToCenter(x.rec.lat, x.rec.lng, center));
  pinList.sort(byCenter);
  s11List.sort(byCenter);
  cjList.sort(byCenter);

  // Always enforce the 200-point render cap, including search mode.
  // Search may query globally, but at most 200 markers are attached to the map.
  // Priority remains: user pins -> 7-Eleven -> CJ MORE.
  let selectedPins = pinList.slice(0, max);
  let remaining = Math.max(0, max - selectedPins.length);
  let selectedS11 = s11List.slice(0, remaining);
  remaining -= selectedS11.length;
  let selectedCJ = cjList.slice(0, remaining);

  const selectedPinIds = new Set(selectedPins.map(p => String(p.id)));
  const selectedS11Set = new Set(selectedS11);
  const selectedCJSet = new Set(selectedCJ);

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
  if (typeof pinmapExtraRender === "function") pinmapExtraRender();
}

let pinmapViewportTimer = null;
function pinmapRefreshViewport() {
  clearTimeout(pinmapViewportTimer);
  pinmapViewportTimer = setTimeout(() => {
    if (S.room && !pinmapSearchText()) loadPinsViewport();
    else pinmapApplyPointCap();
  }, 180);
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
      void pinmapLoadExtraCompetitors();
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


(function pinmapMobileCompetitorPosition(){
  const st = document.createElement("style");
  st.id = "pinmapMobileCompetitorPosition";
  st.textContent = `
/* Mobile competitor panel: vertically centered lower on screen */
@media (max-width: 768px) {
  #mCompetitorPanel {
    top: 50% !important;
    bottom: auto !important;
    transform: translateY(-42%) !important;
    max-height: 72vh !important;
    overflow-y: auto !important;
  }
}
`;
  document.head.appendChild(st);
})();


(function pinmapSavedRoomDeleteFeature(){
  const LONG_PRESS_MS = 650;
  let longPressTimer = null;
  let longPressTriggered = false;

  function getSavedRoomElement(target){
    if(!(target instanceof Element)) return null;
    return target.closest(".savedRoomBtn,[data-saved-room]");
  }

  function roomNameFromElement(el){
    if(!el) return "";
    return String(
      el.dataset?.room ||
      el.dataset?.savedRoom ||
      el.getAttribute("data-room") ||
      el.getAttribute("data-saved-room") ||
      ""
    ).trim();
  }

  async function deleteSavedRoomByName(roomName){
    roomName = String(roomName || "").trim();
    if(!roomName || !S.sb || !S.session) return false;

    try{
      const { error } = await S.sb
        .from("saved_rooms")
        .delete()
        .eq("user_id", S.session.user.id)
        .eq("room", roomName);

      if(error) throw error;

      S.savedRooms = (S.savedRooms || []).filter(r => String(r.room) !== roomName);
      renderSavedRooms();
      toast(`ลบ "${roomName}" ออกจากห้องที่บันทึกไว้แล้ว`);
      return true;
    }catch(err){
      console.warn("delete saved room", err);
      toast(err.message || "ลบห้องที่บันทึกไว้ไม่สำเร็จ");
      return false;
    }
  }

  async function confirmDelete(roomName){
    const ok = window.confirm(
      `ลบห้อง "${roomName}" ออกจากรายการที่บันทึกไว้ใช่ไหม?\n\n` +
      `รายการนี้จะหายจากทุกเครื่องที่ล็อกอินบัญชีเดียวกัน\n` +
      `แต่ห้องจริง สมาชิก Pins และข้อมูลใน Supabase จะไม่ถูกลบ`
    );
    if(ok) await deleteSavedRoomByName(roomName);
  }

  // Desktop: right-click a saved room.
  document.addEventListener("contextmenu", e => {
    const el = getSavedRoomElement(e.target);
    if(!el) return;
    const roomName = roomNameFromElement(el);
    if(!roomName) return;
    e.preventDefault();
    confirmDelete(roomName);
  }, true);

  // Mobile: long-press a saved room.
  document.addEventListener("touchstart", e => {
    const el = getSavedRoomElement(e.target);
    if(!el) return;
    const roomName = roomNameFromElement(el);
    if(!roomName) return;

    longPressTriggered = false;
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      longPressTriggered = true;
      try{ navigator.vibrate?.(30); }catch(_){}
      confirmDelete(roomName);
    }, LONG_PRESS_MS);
  }, {passive:true, capture:true});

  ["touchend","touchcancel","touchmove"].forEach(type => {
    document.addEventListener(type, () => {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }, {passive:true, capture:true});
  });

  document.addEventListener("click", e => {
    if(longPressTriggered && getSavedRoomElement(e.target)){
      e.preventDefault();
      e.stopPropagation();
      longPressTriggered = false;
    }
  }, true);

  window.pinmapDeleteSavedRoom = deleteSavedRoomByName;
})();


(function pinmapCenterMembersDialog(){
  const st = document.createElement("style");
  st.id = "pinmapCenterMembersDialog";
  st.textContent = `
/* สมาชิกในห้อง: อยู่กลางหน้าจอและย่อ/ขยายตาม viewport */
#pinmapRoomManager{
  position:fixed !important;
  left:50% !important;
  top:50% !important;
  right:auto !important;
  bottom:auto !important;
  transform:translate(-50%,-50%) !important;
  width:min(620px, calc(100vw - 32px)) !important;
  max-width:calc(100vw - 32px) !important;
  max-height:calc(100dvh - 32px) !important;
  overflow-y:auto !important;
  overflow-x:hidden !important;
  box-sizing:border-box !important;
  margin:0 !important;
  z-index:10050 !important;
}

#pinmapRoomManager .ptm-members{
  max-height:min(52vh, 460px) !important;
  overflow-y:auto !important;
  overflow-x:hidden !important;
}

@media (max-width: 768px){
  #pinmapRoomManager{
    width:calc(100vw - 20px) !important;
    max-width:calc(100vw - 20px) !important;
    max-height:calc(100dvh - 20px) !important;
    border-radius:14px !important;
  }
  #pinmapRoomManager .ptm-members{
    max-height:48dvh !important;
  }
}

@media (max-width: 420px){
  #pinmapRoomManager{
    width:calc(100vw - 12px) !important;
    max-width:calc(100vw - 12px) !important;
    max-height:calc(100dvh - 12px) !important;
  }
  #pinmapRoomManager .ptm-member{
    grid-template-columns:1fr !important;
    gap:7px !important;
  }
  #pinmapRoomManager .ptm-actions{
    display:flex !important;
    flex-wrap:wrap !important;
    gap:5px !important;
  }
}
`;
  document.head.appendChild(st);

  // ถ้ามีการ resize/zoom ขณะเปิดอยู่ ให้ browser คำนวณตำแหน่งใหม่ทันที
  const keepCentered = () => {
    const el = document.getElementById("pinmapRoomManager");
    if(!el || el.classList.contains("hidden")) return;
    el.style.left = "50%";
    el.style.top = "50%";
    el.style.transform = "translate(-50%,-50%)";
  };
  window.addEventListener("resize", keepCentered, {passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener("resize", keepCentered, {passive:true});
    window.visualViewport.addEventListener("scroll", keepCentered, {passive:true});
  }
})();


(function pinmapResponsiveDesktopHeaderFix(){
  const st=document.createElement('style');
  st.id='pinmapResponsiveDesktopHeaderFix';
  st.textContent=`
/* Header desktop: ให้ปุ่มไหลลงบรรทัดใหม่ตามพื้นที่จริงของหน้าจอ/Browser Zoom */
@media (min-width:769px){
  .pinmap-header-row{
    display:flex !important;
    align-items:center !important;
    align-content:center !important;
    justify-content:flex-start !important;
    gap:6px !important;
    row-gap:6px !important;
    flex-wrap:wrap !important;
    box-sizing:border-box !important;
    width:calc(100% - 24px) !important;
    max-width:calc(100% - 24px) !important;
    height:auto !important;
    min-height:52px !important;
    padding:8px 12px !important;
    overflow:visible !important;
  }

  .pinmap-header-row > *{
    flex:0 0 auto !important;
    min-width:0 !important;
    box-sizing:border-box !important;
  }

  .pinmap-header-row button,
  .pinmap-header-row input,
  #pinmapMembersBtn,#pinmapNotifyBtn,#leaveTeamBtn{
    height:36px !important;
    min-height:36px !important;
    max-height:36px !important;
    padding:0 9px !important;
    margin:0 !important;
    font-size:12px !important;
    line-height:1 !important;
    display:inline-flex !important;
    align-items:center !important;
    justify-content:center !important;
    vertical-align:middle !important;
    white-space:nowrap !important;
    border-radius:8px !important;
    box-sizing:border-box !important;
  }

  /* สมาชิกและแจ้งเตือนสูง/แนวเดียวกันเสมอ */
  #pinmapMembersBtn,#pinmapNotifyBtn{
    align-self:center !important;
    transform:none !important;
    position:relative !important;
    top:auto !important;
    bottom:auto !important;
    height:36px !important;
    min-height:36px !important;
    max-height:36px !important;
  }

  /* ไม่มีปุ่มหัวห้องแยกบน header */
  #pinmapLeaderBtn,#mPinmapLeaderBtn{
    display:none !important;
  }

  #room{
    width:150px !important;
    max-width:min(150px,24vw) !important;
  }
  #passcode{
    width:155px !important;
    max-width:min(155px,25vw) !important;
  }
  #userLabel{
    max-width:145px !important;
    overflow:hidden !important;
    text-overflow:ellipsis !important;
    white-space:nowrap !important;
    font-size:12px !important;
  }
}

/* เมื่อ Zoom 125% หรือพื้นที่แนวนอนลดลง ให้ย่อเล็กน้อย แต่ "ไม่ซ่อน" ปุ่ม */
@media (min-width:769px) and (max-width:1380px){
  .pinmap-header-row{
    gap:5px !important;
    row-gap:5px !important;
    padding:7px 9px !important;
    width:calc(100% - 18px) !important;
    max-width:calc(100% - 18px) !important;
  }

  .pinmap-header-row button,
  .pinmap-header-row input,
  #pinmapMembersBtn,#pinmapNotifyBtn,#leaveTeamBtn{
    height:34px !important;
    min-height:34px !important;
    max-height:34px !important;
    padding-left:7px !important;
    padding-right:7px !important;
    font-size:11px !important;
  }

  #pinmapMembersBtn,#pinmapNotifyBtn{
    height:34px !important;
    min-height:34px !important;
    max-height:34px !important;
  }

  #room{width:132px !important;max-width:132px !important;}
  #passcode{width:140px !important;max-width:140px !important;}
  #userLabel{max-width:112px !important;font-size:11px !important;}
}

/* แคบกว่านี้: ปุ่มจะย้ายลงแถว 2/3 อัตโนมัติ แทนการหายหรือทับกัน */
@media (min-width:769px) and (max-width:1100px){
  .pinmap-header-row{
    gap:4px !important;
    row-gap:5px !important;
    padding:6px 8px !important;
  }

  .pinmap-header-row button,
  .pinmap-header-row input,
  #pinmapMembersBtn,#pinmapNotifyBtn,#leaveTeamBtn{
    padding-left:6px !important;
    padding-right:6px !important;
    font-size:10.5px !important;
  }

  #room{width:118px !important;max-width:118px !important;}
  #passcode{width:122px !important;max-width:122px !important;}
  #userLabel{max-width:95px !important;font-size:10.5px !important;}
}

/* มือถือใช้ UI มือถือเดิม และซ่อนปุ่มหัวห้องแยก */
@media (max-width:768px){
  #pinmapLeaderBtn,#mPinmapLeaderBtn{display:none !important;}
}
`;
  document.head.appendChild(st);

  function commonParent(nodes){
    const valid=nodes.filter(Boolean);
    if(!valid.length)return null;
    let p=valid[0].parentElement;
    while(p && p!==document.body){
      if(valid.every(n=>p.contains(n))) return p;
      p=p.parentElement;
    }
    return null;
  }

  function apply(){
    const row=commonParent([
      document.getElementById('room'),
      document.getElementById('join'),
      document.getElementById('logoutBtn'),
      document.getElementById('pinmapMembersBtn'),
      document.getElementById('pinmapNotifyBtn')
    ]);
    if(row) row.classList.add('pinmap-header-row');

    // ถ้ามีปุ่มหัวห้องจาก cache/ไฟล์เก่า ให้เอาออกจาก DOM
    document.getElementById('pinmapLeaderBtn')?.remove();
    document.getElementById('mPinmapLeaderBtn')?.remove();
  }

  apply();
  window.addEventListener('resize',apply,{passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',apply,{passive:true});
  }
  setTimeout(apply,100);
  setTimeout(apply,500);
})();

