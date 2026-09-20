// Читаем параметры из URL (если они есть)
const params = new URLSearchParams(window.location.search);
const latParam = parseFloat(params.get("lat"));
const lonParam = parseFloat(params.get("lon"));
const schoolParam = params.get("school");

// Создаём карту: если есть параметры — используем их, иначе координаты по умолчанию
const map = L.map('map').setView(
  [latParam || 49.95, lonParam || 82.62],
  latParam && lonParam ? 14 : 10
);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

const schoolSelect = document.getElementById('schoolSelect');
const qualityDiv = document.getElementById('qualityReport'); // блок под картой

// Функция «нейросетевой генерации» текста (эффект печати)
function typeWriter(element, text, speed = 40) {
  element.innerHTML = ""; // очищаем блок
  let i = 0;
  const interval = setInterval(() => {
    element.innerHTML = text.slice(0, i);
    i++;
    if (i > text.length) clearInterval(interval);
  }, speed);
}

// Функция генерации «нейросетевого» ответа
function formatAIResponse(data) {
  if (!data.download && !data.upload && !data.ping) {
    return "⚠️ Пока нет данных о качестве интернет‑соединения для этой школы.";
  }
  return `
    🤖 Я проанализировал подключение в "${data.school}" (${data.city}):  
    • 📡 Ping: ${data.ping ?? "нет данных"} мс — отклик сети.  
    • ⬇️ Download: ${data.download?.toFixed(1) ?? "нет данных"} Mbps — скорость загрузки.  
    • ⬆️ Upload: ${data.upload?.toFixed(1) ?? "нет данных"} Mbps — скорость отправки.  

    В целом соединение оценивается как ${
      data.download > 50 ? "стабильное и быстрое 🚀" :
      data.download > 10 ? "среднее ⚖️" :
      "слабое 🐢"
    }.
  `;
}

// Функция измерения качества соединения
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

// Загрузка списка школ
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

// Отображение школы и нейросетевого отчёта
async function showSchoolData(id) {
  const res = await fetch(`/api/school/${id}`);
  const data = await res.json();

  map.setView([data.latitude, data.longitude], 14);
  L.marker([data.latitude, data.longitude])
    .addTo(map)
    .bindPopup(formatAIResponse(data))
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

  // Отображаем нейросетевой отчёт под картой с эффектом печати
  typeWriter(qualityDiv, formatAIResponse({
    school: data.school,
    city: data.city,
    ping: quality.ping,
    download: quality.download,
    upload: quality.upload
  }));

  console.log("Данные о качестве отправлены:", quality);
}

// Если переданы параметры — сразу ставим маркер выбранной школы
if (latParam && lonParam && schoolParam) {
  L.marker([latParam, lonParam])
    .addTo(map)
    .bindPopup(`📍 ${schoolParam}`)
    .openPopup();

  // Автоматически измеряем качество и выводим отчёт
  (async () => {
    const quality = await testConnection();

    await fetch("/api/quality", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        region: "—",
        district: "—",
        city: "—",
        school: schoolParam,
        download: quality.download,
        upload: quality.upload,
        ping: quality.ping
      })
    });

    typeWriter(qualityDiv, formatAIResponse({
      school: schoolParam,
      city: "—",
      ping: quality.ping,
      download: quality.download,
      upload: quality.upload
    }));
  })();
}

// Обработка выбора школы из списка
schoolSelect.addEventListener('change', async () => {
  const id = schoolSelect.value;
  await showSchoolData(id);
});

loadSchools();
