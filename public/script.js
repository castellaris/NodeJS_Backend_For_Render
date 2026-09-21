const schoolSelect = document.getElementById('schoolSelect');
const qualityDiv = document.getElementById('qualityReport');
const map = L.map('map').setView([49.95, 82.62], 10);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

function formatAIResponse(data) {
  return `
    📡 Ping: ${data.ping?.toFixed(0) ?? "нет данных"} мс
    ⬇️ Download: ${data.download?.toFixed(1) ?? "нет данных"} Mbps
    ⬆️ Upload: ${(data.upload ?? 0).toFixed(1)} Mbps
  `;
}

async function testConnection() {
  let ping = 0, download = 0, upload = 0;

  const startPing = performance.now();
  try {
    await fetch("/api/test-upload", { method: "POST" });
    ping = performance.now() - startPing;
  } catch { ping = performance.now() - startPing; }

  try {
    const start = performance.now();
    const data = await fetch("https://speed.cloudflare.com/__down");
    const blob = await data.blob();
    const sizeMB = blob.size / 1_000_000;
    const timeSec = (performance.now() - start) / 1000;
    download = (sizeMB * 8) / timeSec;
  } catch { download = 0; }

  try {
    const payload = new Uint8Array(5 * 1024 * 1024);
    const start = performance.now();
    await fetch("/api/test-upload", { method: "POST", body: payload });
    const timeSec = (performance.now() - start) / 1000;
    upload = (payload.length * 8 / 1_000_000) / timeSec;
  } catch { upload = 0; }

  return { ping, download, upload };
}

async function loadSchools() {
  const res = await fetch('/api/schools');
  const schools = await res.json();
  schools.forEach(s => {
    const option = document.createElement('option');
    option.value = s.id;
    option.textContent = `${s.school} (${s.city})`;
    schoolSelect.appendChild(option);
  });
}

async function showSchoolData(id) {
  const res = await fetch(`/api/school/${id}`);
  const data = await res.json();

  map.setView([data.latitude, data.longitude], 14);
  L.marker([data.latitude, data.longitude])
    .addTo(map)
    .bindPopup(`${data.school} (${data.city})`)
    .openPopup();

  const quality = await testConnection();

  await fetch("/api/quality", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      region: data.region,
      district: data.district,
      city: data.city,
      school: data.school,
      download: quality.download,
      upload: quality.upload,
      ping: quality.ping
    })
  });

  const updated = await fetch(`/api/school/${id}`);
  const updatedData = await updated.json();

  qualityDiv.innerHTML = formatAIResponse(updatedData);
}

schoolSelect.addEventListener('change', async () => {
  const id = schoolSelect.value;
  await showSchoolData(id);
});

loadSchools();
