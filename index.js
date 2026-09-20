import express from "express";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(express.json());
app.use(cors());

// Настройка статической папки
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

const db = await open({
  filename: "./database.db",
  driver: sqlite3.Database
});

// Создание таблиц
await db.exec(`
CREATE TABLE IF NOT EXISTS schools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT NOT NULL,
  district TEXT NOT NULL,
  city TEXT NOT NULL,
  school TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS geo_location (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  FOREIGN KEY (school_id) REFERENCES schools(id)
);
CREATE TABLE IF NOT EXISTS quality (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_id INTEGER NOT NULL,
  download REAL NOT NULL,
  upload REAL NOT NULL,
  ping REAL NOT NULL,
  FOREIGN KEY (school_id) REFERENCES schools(id)
);
`);

// POST: сохранить школу и координаты
app.post("/api/data", async (req, res) => {
  const { region, district, city, school, latitude, longitude } = req.body;
  try {
    const schoolResult = await db.run(
      "INSERT INTO schools (region, district, city, school) VALUES (?, ?, ?, ?)",
      [region, district, city, school]
    );
    const schoolId = schoolResult.lastID;
    await db.run(
      "INSERT INTO geo_location (school_id, latitude, longitude) VALUES (?, ?, ?)",
      [schoolId, latitude, longitude]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST: сохранить качество интернета
app.post("/api/quality", async (req, res) => {
  const { region, district, city, school, download, upload, ping } = req.body;
  try {
    const schoolRow = await db.get(
      "SELECT id FROM schools WHERE region=? AND district=? AND city=? AND school=?",
      [region, district, city, school]
    );
    if (!schoolRow) return res.status(404).json({ error: "School not found" });
    await db.run(
      "INSERT INTO quality (school_id, download, upload, ping) VALUES (?, ?, ?, ?)",
      [schoolRow.id, download, upload, ping]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET: список всех школ
app.get("/api/schools", async (req, res) => {
  const rows = await db.all("SELECT id, region, district, city, school FROM schools");
  res.json(rows);
});

// GET: данные по конкретной школе (с координатами и качеством)
app.get("/api/school/:id", async (req, res) => {
  const id = req.params.id;
  const school = await db.get("SELECT * FROM schools WHERE id=?", [id]);
  if (!school) return res.status(404).json({ error: "School not found" });

  const geo = await db.get("SELECT latitude, longitude FROM geo_location WHERE school_id=?", [id]);
  const quality = await db.get(
    "SELECT download, upload, ping FROM quality WHERE school_id=? ORDER BY id DESC LIMIT 1",
    [id]
  );

  res.json({ ...school, ...geo, ...quality });
});

const PORT = process.env.PORT || 5500;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
