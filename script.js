// ---- California Zone Checker (2.2) ----
// Zonas por franjas de LATITUD alineadas a tu mapa:
//  - Zona Norte:  lat >= 37.9  (Sacramento queda en Norte)
//  - Zona Central: 34.7 <= lat < 37.9  (Fresno y Bakersfield quedan en Central)
//  - Zona Sur:    lat < 34.7   (LA y Calexico quedan en Sur)
// Además, mantenemos overrides por condado (p.ej., Kern -> Central).
// IMPORTANTE: mueve tu API key a un backend/proxy en producción.

const CA_BOUNDS = {
  minLat: 32.4,
  maxLat: 42.1,
  minLng: -124.6,
  maxLng: -114.0,
};

function inCABounds(lat, lng) {
  return (
    lat >= CA_BOUNDS.minLat &&
    lat <= CA_BOUNDS.maxLat &&
    lng >= CA_BOUNDS.minLng &&
    lng <= CA_BOUNDS.maxLng
  );
}

// --- Config de zonas ---
const ZONE_BANDS = {
  north_min: 37.9, // >= 37.9 -> Norte
  central_min: 34.7, // >= 34.7 y < north_min -> Central; menor a esto -> Sur
};

// Overrides explícitos por condado (normalizados en minúsculas, sin "county")
const COUNTY_OVERRIDES = {
  kern: "Zona Central", // Bakersfield
  // Agrega más si lo necesitas...
};

function normalizeDireccion(input) {
  const value = (input || "").trim();
  if (!value) return value;
  const lower = value.toLowerCase();
  const hasCA = /\bcalifornia\b|\bca\b(?!\S)/i.test(lower);
  const hasUS = /\busa\b|\bunited states\b|\bestados unidos\b/i.test(lower);
  if (hasCA && hasUS) return value;
  if (hasCA && !hasUS) return `${value}, USA`;
  if (!hasCA && hasUS) return `${value}, California`;
  return `${value}, California, USA`;
}

function computeZoneFromLat(lat) {
  if (typeof lat !== "number") return "Zona desconocida";
  if (lat >= ZONE_BANDS.north_min) return "Zona Norte";
  if (lat >= ZONE_BANDS.central_min) return "Zona Central";
  return "Zona Sur";
}

function computeZone(components, lat) {
  // 1) Override por condado, si aplica
  const countyRaw = (
    components.county ||
    components.state_district ||
    ""
  ).toLowerCase();
  const county = countyRaw.replace(/\s*county$/i, "").trim();
  if (county && COUNTY_OVERRIDES[county]) {
    return COUNTY_OVERRIDES[county];
  }
  // 2) Si no hay override, usar latitud
  return computeZoneFromLat(lat);
}

function scoreCandidate(item) {
  if (!item || !item.geometry) return -Infinity;
  const c = item.components || {};
  const lat = item.geometry.lat;
  const lng = item.geometry.lng;
  let score = item.confidence || 0;

  // Preferir dentro de CA
  if (inCABounds(lat, lng)) score += 4;
  else score -= 10;

  // Preferir dirección específica
  if (c.house_number) score += 6;
  if (c.road) score += 3;
  if (c.postcode) score += 2;

  // Preferir que declare CA/US
  const isCA = c.state_code === "CA" || /california/i.test(c.state || "");
  const isUS = (c.country_code || "").toLowerCase() === "us";
  if (isCA) score += 3;
  if (isUS) score += 2;

  // Plus por ciudad/localidad
  if (c.city || c.town || c.village || c.municipality || c.locality) score += 1;

  return score;
}

function pickBest(results) {
  let best = null;
  let bestScore = -Infinity;
  for (const r of results || []) {
    const s = scoreCandidate(r);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

function renderMap(lat, lng) {
  const mapaDiv = document.getElementById("mapa");
  mapaDiv.classList.remove("hidden");
  const bboxSize = 0.01;
  const bbox = `${lng - bboxSize},${lat - bboxSize},${lng + bboxSize},${
    lat + bboxSize
  }`;
  mapaDiv.innerHTML = `
    <iframe width="100%" height="450" frameborder="0" scrolling="no"
      src="https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
        bbox
      )}&layer=mapnik&marker=${lat},${lng}"></iframe>
    <small><a target="_blank" rel="noopener" href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}">Ver en OpenStreetMap</a></small>`;
}

function renderAlternatives(results) {
  const zonaDiv = document.getElementById("zona");
  if (!results || results.length <= 1) return;
  const items = results
    .slice(0, 5)
    .map((r) => {
      const label = r.formatted || `${r.geometry.lat}, ${r.geometry.lng}`;
      return `<li><button type="button" data-addr="${encodeURIComponent(
        label
      )}" class="alt-btn">➡ ${label}</button></li>`;
    })
    .join("");
  const wrapper = document.createElement("div");
  wrapper.className = "card";
  wrapper.style.marginTop = "12px";
  wrapper.innerHTML = `
    <div class="card-header" style="font-weight:600">¿No es exacto? Prueba una sugerencia:</div>
    <div class="card-body">
      <ul class="alts" style="display:grid; gap:6px; list-style:none; padding:0; margin:0;">${items}</ul>
    </div>`;
  zonaDiv.appendChild(wrapper);
  wrapper.querySelectorAll(".alt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const label = decodeURIComponent(btn.getAttribute("data-addr") || "");
      const input = document.getElementById("direccion");
      input.value = label;
      buscarZona();
    });
  });
}

async function buscarZona() {
  const raw = document.getElementById("direccion").value;
  const direccion = normalizeDireccion(raw);
  const zonaDiv = document.getElementById("zona");
  const mapaDiv = document.getElementById("mapa");

  if (!direccion) {
    zonaDiv.classList.remove("hidden");
    zonaDiv.innerHTML = "<p>Por favor ingresa una dirección.</p>";
    mapaDiv.innerHTML = "";
    mapaDiv.classList.add("hidden");
    return;
  }

  zonaDiv.classList.remove("hidden");
  zonaDiv.innerHTML = "<p>Buscando ubicación precisa…</p>";
  mapaDiv.innerHTML = "";
  mapaDiv.classList.add("hidden");

  // ⚠️ Reemplaza por tu clave o usa un backend/proxy
  const apiKey = "49ee6b24d22e47af9c8fea54e56ac89b".trim();
  if (!apiKey || apiKey === "YOUR_OPENCAGE_API_KEY") {
    zonaDiv.innerHTML = `
      <div class="card error">
        <div class="card-header">Falta tu API key</div>
        <div class="card-body">
          Agrega tu clave de OpenCage en <code>script.js</code> o usa un backend/proxy.
        </div>
      </div>`;
    return;
  }

  const url =
    `https://api.opencagedata.com/geocode/v1/json` +
    `?q=${encodeURIComponent(direccion)}` +
    `&key=${apiKey}` +
    `&language=es` +
    `&limit=5` +
    `&no_annotations=1` +
    `&countrycode=us` +
    `&components=${encodeURIComponent("country:US|state:CA")}`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      let message = `HTTP ${resp.status}`;
      try {
        const errData = await resp.json();
        if (errData?.status?.message) message += ` – ${errData.status.message}`;
      } catch {}
      throw new Error(message);
    }
    const data = await resp.json();
    const results = data.results || [];
    if (!results.length) {
      zonaDiv.innerHTML = `<div class="card"><div class="card-body">
        No encontramos resultados para: <b>${direccion}</b>.<br/>
        Prueba agregando número de casa, código postal o una intersección.</div></div>`;
      return;
    }

    const best = pickBest(results);
    const c = best.components || {};
    const lat = best.geometry.lat;
    const lng = best.geometry.lng;

    const parts = [
      c.house_number && c.road
        ? `${c.road} ${c.house_number}`
        : best.formatted || "",
      c.neighbourhood || c.suburb || c.city_district,
      c.city || c.town || c.village || c.municipality,
      c.state_code === "CA" ? "CA" : c.state || "",
      c.postcode,
    ].filter(Boolean);
    const pretty = parts.join(", ");

    const zone = computeZone(c, lat);

    zonaDiv.innerHTML = `
      <div class="card">
        <div class="card-header">Resultado más específico</div>
        <div class="card-body">
          <p><b>Dirección:</b> ${pretty}</p>
          <p><b>Coordenadas:</b> ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
          <p><b>Zona:</b> ${zone}</p>
        </div>
      </div>`;

    renderMap(lat, lng);
    renderAlternatives(results);
  } catch (err) {
    zonaDiv.innerHTML = `
      <div class="card error">
        <div class="card-header">Error al buscar</div>
        <div class="card-body"><code>${String(err)}</code></div>
      </div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("direccion");
  const btn = document.getElementById("buscar");
  if (input) {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        buscarZona();
      }
    });
  }
  if (btn) btn.addEventListener("click", buscarZona);
});
