import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("construction.db");

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT,
    name TEXT
  );

  CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT,
    cnpj TEXT,
    logo TEXT,
    technical_responsible TEXT,
    email TEXT,
    phone TEXT,
    default_checklist TEXT
  );

  CREATE TABLE IF NOT EXISTS constructions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    photo TEXT,
    address TEXT,
    responsible TEXT,
    contractor TEXT,
    contract_number TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'em_andamento'
  );

  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    construction_id INTEGER,
    date TEXT,
    technical_observations TEXT,
    status TEXT DEFAULT 'em_preenchimento',
    created_by INTEGER,
    revision INTEGER DEFAULT 0,
    FOREIGN KEY (construction_id) REFERENCES constructions(id)
  );

  CREATE TABLE IF NOT EXISTS report_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER,
    image_data TEXT,
    caption TEXT,
    order_index INTEGER,
    FOREIGN KEY (report_id) REFERENCES reports(id)
  );

  CREATE TABLE IF NOT EXISTS report_checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER,
    item_name TEXT,
    status INTEGER, -- 0 or 1
    observation TEXT,
    FOREIGN KEY (report_id) REFERENCES reports(id)
  );
`);

// Seed initial admin if not exists
const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
if (!adminExists) {
  db.prepare("INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)").run(
    "admin@proteforms.com",
    "admin123",
    "admin",
    "Administrador"
  );
}

const app = express();
app.use(express.json({ limit: '50mb' }));

// API Routes
app.get("/api/constructions", (req, res) => {
  const constructions = db.prepare("SELECT * FROM constructions").all();
  res.json(constructions);
});

app.post("/api/constructions", (req, res) => {
  const { name, photo, address, responsible, contractor, contract_number, start_date, end_date } = req.body;
  const result = db.prepare(`
    INSERT INTO constructions (name, photo, address, responsible, contractor, contract_number, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, photo, address, responsible, contractor, contract_number, start_date, end_date);
  res.json({ id: result.lastInsertRowid });
});

app.get("/api/reports", (req, res) => {
  const reports = db.prepare(`
    SELECT r.*, c.name as construction_name 
    FROM reports r 
    JOIN constructions c ON r.construction_id = c.id
    ORDER BY r.date DESC
  `).all();
  res.json(reports);
});

app.get("/api/reports/:id", (req, res) => {
  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(req.params.id);
  if (!report) return res.status(404).json({ error: "Report not found" });
  
  const photos = db.prepare("SELECT * FROM report_photos WHERE report_id = ? ORDER BY order_index").all(req.params.id);
  const checklist = db.prepare("SELECT * FROM report_checklists WHERE report_id = ?").all(req.params.id);
  
  res.json({ ...report, photos, checklist });
});

app.post("/api/reports", (req, res) => {
  const { construction_id, date, technical_observations, photos, checklist, status } = req.body;
  
  const transaction = db.transaction(() => {
    const result = db.prepare(`
      INSERT INTO reports (construction_id, date, technical_observations, status)
      VALUES (?, ?, ?, ?)
    `).run(construction_id, date, technical_observations, status || 'em_preenchimento');
    
    const reportId = result.lastInsertRowid;
    
    if (photos) {
      const insertPhoto = db.prepare("INSERT INTO report_photos (report_id, image_data, caption, order_index) VALUES (?, ?, ?, ?)");
      photos.forEach((p: any, i: number) => insertPhoto.run(reportId, p.image_data, p.caption, i));
    }
    
    if (checklist) {
      const insertCheck = db.prepare("INSERT INTO report_checklists (report_id, item_name, status, observation) VALUES (?, ?, ?, ?)");
      checklist.forEach((c: any) => insertCheck.run(reportId, c.item_name, c.status ? 1 : 0, c.observation));
    }
    
    return reportId;
  });
  
  const id = transaction();
  res.json({ id });
});

app.get("/api/settings", (req, res) => {
  const settings = db.prepare("SELECT * FROM company_settings WHERE id = 1").get();
  res.json(settings || {});
});

app.post("/api/settings", (req, res) => {
  const { name, cnpj, logo, technical_responsible, email, phone, default_checklist } = req.body;
  const exists = db.prepare("SELECT id FROM company_settings WHERE id = 1").get();
  
  if (exists) {
    db.prepare(`
      UPDATE company_settings 
      SET name = ?, cnpj = ?, logo = ?, technical_responsible = ?, email = ?, phone = ?, default_checklist = ?
      WHERE id = 1
    `).run(name, cnpj, logo, technical_responsible, email, phone, default_checklist);
  } else {
    db.prepare(`
      INSERT INTO company_settings (id, name, cnpj, logo, technical_responsible, email, phone, default_checklist)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, cnpj, logo, technical_responsible, email, phone, default_checklist);
  }
  res.json({ success: true });
});

app.get("/api/stats", (req, res) => {
  const totalConstructions = db.prepare("SELECT COUNT(*) as count FROM constructions").get().count;
  const totalReports = db.prepare("SELECT COUNT(*) as count FROM reports").get().count;
  const statusCounts = db.prepare("SELECT status, COUNT(*) as count FROM constructions GROUP BY status").all();
  
  res.json({ totalConstructions, totalReports, statusCounts });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const PORT = 3000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
