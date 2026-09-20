const map = L.map('map').setView([49.95, 82.62], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

const schoolSelect = document.getElementById('schoolSelect');

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

async function testConnection() {
  let ping = 0, download = 0, upload = 0;

  const startPing = performance.now();
  try {
    await fetch("https://8.8.8.8", { mode: "no-cors" });
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
    const payload = new Uint8Array(2 * 1024 * 1024);
    const start = performance.now();
    await fetch("https://speed.cloudflare.com/__up", {
      method: "POST",
      body: payload
    });
    const timeSec = (performance.now() - start) / 1000;
    upload = (payload.length * 8 / 1_000_000) / timeSec;
  } catch { upload = 0; }

  return { ping, download, upload };
}

schoolSelect.addEventListener('change', async () => {
  const id = schoolSelect.value;
  const res = await fetch(`/api/school/${id}`);
  const data = await res.json();

  map.setView([data.latitude, data.longitude], 14);
  L.marker([data.latitude, data.longitude])
    .addTo(map)
    .bindPopup(`
      <b>${data.school}</b><br>
      ${data.city}, ${data.district}, ${data.region}<br>
      <hr>
            <b>Последние данные из БД:</b><br>
      Download: ${data.download ?? "нет данных"} Mbps<br>
      Upload: ${data.upload ?? "нет данных"} Mbps<br>
      Ping: ${data.ping ?? "нет данных"} ms
    `)
    .openPopup();

  // Автоматическое измерение качества
  const quality = await testConnection();

  // Сохраняем новые данные в БД
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

  console.log("Данные о качестве отправлены:", quality);
});

loadSchools();
