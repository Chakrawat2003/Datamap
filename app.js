const C = window.APP_CONFIG || {};
const $ = id => document.getElementById(id);
const dbConfigured = () => C.SUPABASE_URL && C.SUPABASE_ANON_KEY && !C.SUPABASE_URL.includes("YOUR_");

const S = { 
  sb: null, ch: null, session: null, room: "", passcode: "", 
  adding: false, pending: null, editing: null, markers: new Map(), 
  all: [], savedRooms: [], _locMarker: null 
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
const map = L.map("map", { preferCanvas: true, zoomControl: false }).setView([13.7563, 100.5018], 6);
L.control.zoom({ position: "bottomright" }).addTo(map);

// Esri World Imagery Layer
const esriUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" + (C.ESRI_API_KEY ? "?token=" + encodeURIComponent(C.ESRI_API_KEY) : "");
L.tileLayer(esriUrl, { maxZoom: 19, attribution: "Tiles © Esri" }).addTo(map);

// DOL (Department of Lands) Layer WMS
const dolLayer = L.tileLayer.wms("https://landsgis.dol.go.th/arcgis/services/DOL_PARCEL/MapServer/WMSServer", {
  layers: '0',
  format: 'image/png',
  transparent: true,
  maxZoom: 20,
  attribution: 'กรมที่ดิน (DOL)'
});
let dolOn = false;

function toggleDol() {
  dolOn = !dolOn;
  if (dolOn) {
    dolLayer.addTo(map);
    toast("เปิดชั้นข้อมูลแปลงที่ดิน (DOL) แล้ว");
  } else {
    map.removeLayer(dolLayer);
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

const S11 = { all: [], custom: [], deletedIds: new Set(), edits: new Map(), on: localStorage.getItem("pinmap-s11-on") !== "0" };

function s11PopupHtml(rec) {
  const gmapUrl = `https://www.google.com/maps/dir/?api=1&destination=${rec.y},${rec.x}`;
  return `<div class="pin-title">🏪 ${esc(rec.n)}</div>
    <div>${esc(rec.a)}</div>
    ${rec.note ? `<div class="pin-note">${esc(rec.note)}</div>` : ""}
    <div class="pin-meta"><a href="${gmapUrl}" target="_blank" rel="noopener" class="pin-nav-link">🧭 นำทาง (Google Maps)</a></div>`;
}

function s11Update() {
  if (!window.SEVEN11_DATA) return;
  if (!S11.all.length) {
    S11.all = (window.SEVEN11_DATA || []).map(rec => {
      const icon = L.divIcon({ className: "", html: `<img src="7-11-logo.png" style="width:22px;height:22px;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23008450\'/><text x=\'50\' y=\'65\' font-size=\'50\' text-anchor=\'middle\' fill=\'white\'>7</text></svg>'">`, iconSize: [22, 22], iconAnchor: [11, 11] });
      const m = L.marker([rec.y, rec.x], { icon });
      m.bindPopup(s11PopupHtml(rec));
      return { rec, m };
    });
  }
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
  localStorage.setItem("pinmap-s11-on", S11.on ? "1" : "0");
  s11Update();
  toast(S11.on ? "แสดง 7-Eleven" : "ซ่อน 7-Eleven");
};
if ($("s11Toggle")) $("s11Toggle").onclick = toggleS11;
if ($("mS11Btn")) $("mS11Btn").onclick = toggleS11;

/* ── PINS MANAGEMENT & GOOGLE MAPS DIRECT NAV ── */
const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#8b5cf6", "#ec4899"];
const ICONS = { pin: "📍", star: "⭐", heart: "❤️", flag: "🚩", home: "🏠", food: "🍜", shop: "🏪", hotel: "🏨", photo: "📷" };

function pinIcon(color, icon) {
  const c = /^#[0-9a-fA-F]{6}$/.test(color) ? color : COLORS[0];
  const html = `<div style="font-size:26px;filter:drop-shadow(0 2px 3px #0005)">${ICONS[icon] || "📍"}</div>`;
  return L.divIcon({ className: "", html: `<div style="display:flex;justify-content:center">${html}</div>`, iconSize: [36, 36], iconAnchor: [18, 32] });
}

function marker(p) {
  const m = L.marker([p.lat, p.lng], { icon: pinIcon(p.color, p.icon) });
  const gmapUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`;
  m.bindPopup(`<div class="pin-title">${esc(p.title)}</div>
    <div>${esc(p.address || "")}</div>
    <div class="pin-note">${esc(p.note || "")}</div>
    <div class="pin-meta">ปักโดย ${esc(p.created_by || "ผู้ใช้")}</div>
    <a href="${gmapUrl}" target="_blank" rel="noopener" class="pin-nav-link">🧭 นำทาง (Google Maps)</a>`);
  S.markers.set(p.id, m);
  cluster.addLayer(m);
}

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

// AUTH & MODAL CONTROLS
function openAuth(msg = "") { 
  if ($("authModal")) $("authModal").classList.remove("hidden"); 
  if ($("authMessage")) $("authMessage").textContent = msg; 
}
if ($("authClose")) $("authClose").onclick = () => $("authModal").classList.add("hidden");
if ($("profileBtn")) $("profileBtn").onclick = () => openAuth();

function openModal(p = null, latlng = null) {
  S.editing = p; S.pending = latlng || { lat: p.lat, lng: p.lng };
  if ($("modalTitle")) $("modalTitle").textContent = p ? "แก้ไขจุด" : "เพิ่มจุด";
  if ($("title")) $("title").value = p?.title || "";
  if ($("address")) $("address").value = p?.address || "";
  if ($("note")) $("note").value = p?.note || "";
  if ($("modal")) $("modal").classList.remove("hidden");
}
function closeModal() { if ($("modal")) $("modal").classList.add("hidden"); }
if ($("close")) $("close").onclick = closeModal;
if ($("cancel")) $("cancel").onclick = closeModal;

// Add Pin Action
const triggerAddPin = () => {
  if (!S.session) return openAuth("เข้าสู่ระบบก่อนปักจุด");
  if (!S.room) return toast("กรุณาพิมพ์ชื่อห้องและกดเข้าห้องก่อน");
  S.adding = !S.adding;
  if ($("mode")) $("mode").classList.toggle("hidden", !S.adding);
  toast(S.adding ? "แตะบนแผนที่เพื่อปักจุด" : "ยกเลิกปักจุด");
};

if ($("add")) $("add").onclick = triggerAddPin;
if ($("mAddBtn")) $("mAddBtn").onclick = triggerAddPin;

map.on("click", e => {
  if (S.adding) {
    S.adding = false;
    if ($("mode")) $("mode").classList.add("hidden");
    openModal(null, e.latlng);
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

// Join Room Handler
if ($("join")) {
  $("join").onclick = () => {
    const rm = $("room").value.trim();
    if (!rm) return toast("กรุณาใส่ชื่อห้อง");
    S.room = rm;
    toast(`เข้าสู่ห้อง: ${rm}`);
    if ($("userLabel")) $("userLabel").textContent = `${username()} (ห้อง: ${rm})`;
    if ($("mUserInfo")) $("mUserInfo").textContent = `👤 ${username()} · ห้อง: ${rm}`;
  };
}

async function init() {
  if (dbConfigured() && window.supabase) {
    try {
      S.sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
      const { data } = await S.sb.auth.getSession();
      S.session = data.session;
    } catch (e) {
      console.warn("Supabase Config Issue:", e);
    }
  }
  if ($("userLabel")) $("userLabel").textContent = username();
  if ($("mUserInfo")) $("mUserInfo").textContent = `👤 ${username()} · ห้อง: -`;
}
init();