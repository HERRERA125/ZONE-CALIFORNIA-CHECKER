async function buscarZona() {
  const direccion = document.getElementById("direccion").value;
  const zonaDiv = document.getElementById("zona");
  const mapaDiv = document.getElementById("mapa");

  if (!direccion) {
    zonaDiv.innerHTML = "<p>Por favor ingresa una dirección.</p>";
    mapaDiv.innerHTML = "";
    return;
  }

  const apiKey = "49ee6b24d22e47af9c8fea54e56ac89b";
  const url = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
    direccion
  )}&key=${apiKey}&language=es`;

  try {
    const respuesta = await fetch(url);
    const datos = await respuesta.json();

    if (datos.results.length > 0) {
      const { lat, lng } = datos.results[0].geometry;
      const componentes = datos.results[0].components;

      const ciudad =
        componentes.town ||
        componentes.city ||
        componentes.village ||
        "No disponible";
      const estado = componentes.state || "No disponible";
      const codigoPostal = componentes.postcode || "No disponible";
      const condado = componentes.county || "No disponible";

      const zona = determinarZona(lat, ciudad);

      zonaDiv.classList.remove("hidden");
      mapaDiv.classList.remove("hidden");

      zonaDiv.innerHTML = `
        <table style="margin: auto; border-collapse: collapse;">
          <tr><td><strong>📍 Dirección:</strong></td><td>${direccion}</td></tr>
          <tr><td><strong>🌎 Latitud:</strong></td><td>${lat.toFixed(
            4
          )}</td></tr>
          <tr><td><strong>🗺️ Ciudad:</strong></td><td>${ciudad}</td></tr>
          <tr><td><strong>📫 Código Postal:</strong></td><td>${codigoPostal}</td></tr>
          <tr><td><strong>🏞️ Condado:</strong></td><td>${condado}</td></tr>
          <tr><td><strong>📌 Estado:</strong></td><td>${estado}</td></tr>
          <tr><td><strong>🧭 Zona Detectada:</strong></td><td><strong>${zona}</strong></td></tr>
        </table>
      `;

      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}&hl=es&z=16&output=embed`;
      mapaDiv.innerHTML = `
        <iframe
          width="100%"
          height="450"
          frameborder="0"
          style="border:0; margin-top: 20px;"
          referrerpolicy="no-referrer-when-downgrade"
          src="${mapsUrl}"
          allowfullscreen>
        </iframe>
      `;
    } else {
      zonaDiv.innerHTML = "<p>Dirección no encontrada.</p>";
      mapaDiv.innerHTML = "";
    }
  } catch (error) {
    zonaDiv.innerHTML = "<p>Error al obtener la ubicación.</p>";
    mapaDiv.innerHTML = "";
    console.error(error);
  }
}

function determinarZona(lat, ciudad) {
  const ciudadLower = ciudad.toLowerCase();

  const zonaNorte = [
    "sacramento", "redding", "chico", "eureka", "santa rosa", "vallejo", "napa",
    "yuba city", "woodland", "roseville", "arcata", "red bluff", "weaverville",
    "alturas", "crescent city"
  ];

  const zonaCentral = [
    "fresno", "modesto", "stockton", "merced", "madera", "visalia", "hanford",
    "tulare", "turlock", "clovis", "delano", "porterville", "selma"
  ];

  const zonaSur = [
    "los angeles", "san diego", "long beach", "anaheim", "irvine", "santa ana",
    "chula vista", "bakersfield", "riverside", "oxnard", "escondido", "ontario",
    "temecula", "el cajon", "san bernardino", "calexico", "el centro", "fontana",
    "oceanside", "palm springs", "garden grove", "glendale", "huntington beach"
  ];

  const zonaCostera = [
    "san francisco", "oakland", "san jose", "monterey", "santa cruz", "pismo beach",
    "san luis obispo", "santa barbara", "ventura", "malibu", "santa monica",
    "carpinteria", "san mateo", "daly city", "pacifica"
  ];

  if (zonaNorte.includes(ciudadLower)) {
    return "Zona Norte";
  } else if (zonaCentral.includes(ciudadLower)) {
    return "Zona Central";
  } else if (zonaSur.includes(ciudadLower)) {
    return "Zona Sur";
  } else if (zonaCostera.includes(ciudadLower)) {
    return "Zona Costera";
  } else {

    if (lat > 37.6) return "Zona Norte (latitud)";
    else if (lat >= 36.0 && lat <= 37.6) return "Zona Central (latitud)";
    else return "Zona Sur (latitud)";
  }
}
