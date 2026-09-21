async function testConnection() {
  let ping = 0, download = 0, upload = 0;

  // Ping
  const startPing = performance.now();
  try {
    await fetch("/api/test-upload", { method: "POST" });
    ping = performance.now() - startPing;
  } catch { ping = performance.now() - startPing; }

  // Download
  try {
    const start = performance.now();
    const data = await fetch("https://speed.cloudflare.com/__down");
    const blob = await data.blob();
    const sizeMB = blob.size / 1_000_000;
    const timeSec = (performance.now() - start) / 1000;
    download = (sizeMB * 8) / timeSec;
  } catch { download = 0; }

  // Upload
  try {
    const payload = new Uint8Array(5 * 1024 * 1024); // 5 МБ
    const start = performance.now();
    await fetch("/api/test-upload", {
      method: "POST",
      body: payload
    });
    const timeSec = (performance.now() - start) / 1000;
    upload = (payload.length * 8 / 1_000_000) / timeSec;
  } catch { upload = 0; }

  return { ping, download, upload };
}

function formatAIResponse(data) {
  return `
    📡 Ping: ${data.ping?.toFixed(0) ?? "нет данных"} мс
    ⬇️ Download: ${data.download?.toFixed(1) ?? "нет данных"} Mbps
    ⬆️ Upload: ${(data.upload ?? 0).toFixed(1)} Mbps
  `;
}

async function showSchoolData(id) {
  const res = await fetch(`/api/school/${id}`);
  const data = await res.json();

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

  // 🔁 Повторный запрос для получения обновлённых данных
  const updated = await fetch(`/api/school/${id}`);
  const updatedData = await updated.json();

  document.getElementById("qualityReport").innerHTML = formatAIResponse(updatedData);
}
