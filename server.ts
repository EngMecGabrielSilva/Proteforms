import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";
import SQLiteStoreFactory from "connect-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("construction.db");
const SQLiteStore = SQLiteStoreFactory(session);

// Supabase Client
// Support multiple naming conventions for keys
const supabaseUrl = (process.env.SUPABASE_URL || process.env.api_url || "").trim();
// For backend sync, we prefer the service role key to bypass RLS
const supabaseKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY || 
  process.env.service_role || 
  process.env.SERVICE_ROLE || 
  process.env.SUPABASE_ANON_KEY || 
  process.env.anon_public || 
  process.env.ANON_PUBLIC || 
  process.env["anon public"] || 
  ""
).trim();

const isValidUrl = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:";
  } catch {
    return false;
  }
};

const supabase = (supabaseUrl && isValidUrl(supabaseUrl) && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

if (supabase) {
  const isServiceKey = supabaseKey.length > 100; // Service keys are usually longer
  if (!isServiceKey) {
    console.warn("AVISO: Você está usando a 'anon' key do Supabase. A sincronização do backend falhará se o RLS estiver ativo.");
    console.warn("DICA: Use a 'service_role' key no painel de Secrets para permitir que o backend ignore o RLS.");
  }
  console.log(`Supabase integration active (${isServiceKey ? 'Service Role' : 'Anon Key'}). URL:`, supabaseUrl.substring(0, 15) + "...");
} else {
  console.log("Supabase integration not configured or invalid (missing URL/Key or invalid URL).");
  console.log("Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Secrets panel.");
  if (supabaseUrl && !isValidUrl(supabaseUrl)) {
    console.log("Error: SUPABASE_URL must start with https://. Current value:", supabaseUrl);
  }
}

// Automatic Sync Helper
const syncToSupabase = async (table: string, data: any) => {
  if (!supabase) return;
  try {
    let payload = Array.isArray(data) ? data : [data];
    
    // Handle JSONB fields for Supabase
    if (table === 'checklist_templates') {
      payload = payload.map(t => ({ ...t, items: typeof t.items === 'string' ? JSON.parse(t.items) : t.items }));
    } else if (table === 'company_settings') {
      payload = payload.map(s => ({ ...s, default_checklist: typeof s.default_checklist === 'string' ? JSON.parse(s.default_checklist || '[]') : s.default_checklist }));
    } else if (table === 'profiles') {
      payload = payload.map(({ email, ...rest }: any) => rest);
    }

    const { error } = await supabase.from(table).upsert(payload);
    if (error) {
      if (error.message.includes("row-level security policy") || error.code === '42501') {
        console.error(`Supabase Sync Error [${table}]: RLS Policy Violation (Erro 42501).`);
        console.error(`  -> CAUSA: O backend não tem permissão para escrever na tabela '${table}'.`);
        console.error(`  -> SOLUÇÃO 1: Adicione a 'SUPABASE_SERVICE_ROLE_KEY' no painel de Secrets.`);
        console.error(`  -> SOLUÇÃO 2: Desabilite o RLS para a tabela '${table}' no dashboard do Supabase.`);
      } else {
        console.error(`Supabase Sync Error [${table}]:`, error.message, `(Code: ${error.code})`);
      }
    } else {
      console.log(`Supabase Sync Success [${table}]`);
    }
  } catch (err: any) {
    console.error(`Supabase Sync Exception [${table}]:`, err.message);
  }
};

const deleteFromSupabase = async (table: string, id: any) => {
  if (!supabase) return;
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) console.error(`Supabase Delete Error [${table}]:`, error.message);
    else console.log(`Supabase Delete Success [${table}]`);
  } catch (err: any) {
    console.error(`Supabase Delete Exception [${table}]:`, err.message);
  }
};

const app = express();
// AI Studio is always behind a proxy
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === "production" || !!process.env.APP_URL;
console.log("Environment - isProduction:", isProduction, "APP_URL:", process.env.APP_URL);

// Force HTTPS headers for session security in production/AI Studio
app.use((req, res, next) => {
  if (isProduction) {
    req.headers['x-forwarded-proto'] = 'https';
    req.headers['x-forwarded-port'] = '443';
  }
  next();
});

// Enable CORS for the frontend
app.use(cors({
  origin: true,
  credentials: true
}));

app.use((req, res, next) => {
  const oldWriteHead = res.writeHead;
  res.writeHead = function(statusCode, ...args) {
    const setCookie = res.getHeader('Set-Cookie');
    if (setCookie) {
      console.log(`[Response] ${req.method} ${req.url} - Status: ${statusCode} - Set-Cookie: ${JSON.stringify(setCookie)}`);
    }
    return oldWriteHead.apply(this, [statusCode, ...args]);
  };
  
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const secure = req.secure || proto === 'https';
  console.log(`[${req.method}] ${req.url} - Secure: ${secure} (req.secure: ${req.secure}, proto: ${proto}) - Cookies: ${req.headers.cookie || 'None'}`);
  if (!(req.session as any)?.userId && req.url.startsWith('/api/')) {
    console.log(`All Headers: ${JSON.stringify(req.headers, null, 2)}`);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for dev/iframe compatibility
  crossOriginEmbedderPolicy: false
}));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: './' }),
  secret: process.env.SESSION_SECRET || "proteforms-secret-key",
  resave: false,
  saveUninitialized: false,
  rolling: true,
  name: 'proteforms.sid',
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: true,
    sameSite: "none",
    httpOnly: true,
    path: '/'
  },
  proxy: true
}));

// Rate Limiting for Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 login requests per windowMs
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  validate: { trustProxy: false }
});

// Auth Middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session) {
    console.error("Auth Failed: Session middleware not initialized");
    return res.status(500).json({ error: "Internal Server Error: Session missing" });
  }
  if (!req.session.userId) {
    const proto = req.get('x-forwarded-proto') || req.protocol;
    console.log(`Auth Failed: No session userId found for ${req.method} ${req.url}. Cookies: ${req.headers.cookie ? 'Present' : 'None'}. Proto: ${proto}. Secure: ${req.secure}. SessionID: ${req.sessionID}`);
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Auto-promote if main email (safety measure)
  if (req.session.role !== 'admin') {
    const profile = db.prepare("SELECT email FROM profiles WHERE id = ?").get(req.session.userId) as any;
    const mainEmail = "engemec.gabrielsilva@gmail.com";
    if (profile?.email === mainEmail || profile?.email === "admin@proteforms.com") {
      console.log("Auto-promoting user to admin in session:", profile.email);
      req.session.role = 'admin';
    }
  }

  if (req.session?.role !== 'admin') {
    console.log(`Admin access denied for user ${req.session.userId} (Role: ${req.session.role})`);
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

// Initialize Database Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY, -- UUID from Supabase
    email TEXT UNIQUE,
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
    default_checklist TEXT, -- JSON string
    resp1_name TEXT,
    resp1_reg_name TEXT,
    resp1_reg_num TEXT,
    resp1_title TEXT,
    resp1_signature TEXT,
    resp2_name TEXT,
    resp2_reg_name TEXT,
    resp2_reg_num TEXT,
    resp2_title TEXT,
    resp2_signature TEXT,
    primary_resp TEXT
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
    inspection_date TEXT,
    technical_observations TEXT,
    status TEXT DEFAULT 'em_preenchimento',
    created_by TEXT, -- UUID
    revision INTEGER DEFAULT 0,
    FOREIGN KEY (construction_id) REFERENCES constructions(id)
  );

  CREATE TABLE IF NOT EXISTS report_photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER,
    image_url TEXT,
    caption TEXT,
    order_index INTEGER,
    FOREIGN KEY (report_id) REFERENCES reports(id)
  );

  CREATE TABLE IF NOT EXISTS checklist_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    items TEXT NOT NULL -- JSON array of strings
  );

  CREATE TABLE IF NOT EXISTS report_checklists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER,
    item_name TEXT,
    status TEXT, -- 'C', 'NC', 'NA'
    observation TEXT,
    FOREIGN KEY (report_id) REFERENCES reports(id)
  );
`);

// Migrations for existing databases
const migrate = () => {
  // Check if users table exists and rename to profiles if needed
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t: any) => t.name);
  if (tables.includes('users') && !tables.includes('profiles')) {
    db.prepare("ALTER TABLE users RENAME TO profiles").run();
  }

  // reports columns
  const reportCols = db.prepare("PRAGMA table_info(reports)").all().map((c: any) => c.name);
  if (reportCols.includes('date') && !reportCols.includes('inspection_date')) {
    db.prepare("ALTER TABLE reports RENAME COLUMN date TO inspection_date").run();
  }

  // report_photos columns
  const photoCols = db.prepare("PRAGMA table_info(report_photos)").all().map((c: any) => c.name);
  if (photoCols.includes('image_data') && !photoCols.includes('image_url')) {
    db.prepare("ALTER TABLE report_photos RENAME COLUMN image_data TO image_url").run();
  }

  // company_settings columns
  const settingsCols = db.prepare("PRAGMA table_info(company_settings)").all().map((c: any) => c.name);
  const newSettingsCols = [
    'resp1_name', 'resp1_reg_name', 'resp1_reg_num', 'resp1_title', 'resp1_signature',
    'resp2_name', 'resp2_reg_name', 'resp2_reg_num', 'resp2_title', 'resp2_signature',
    'primary_resp'
  ];
  newSettingsCols.forEach(col => {
    if (!settingsCols.includes(col)) {
      db.prepare(`ALTER TABLE company_settings ADD COLUMN ${col} TEXT`).run();
    }
  });

  // constructions columns
  const constructionCols = db.prepare("PRAGMA table_info(constructions)").all().map((c: any) => c.name);
  if (!constructionCols.includes('contract_number')) {
    db.prepare("ALTER TABLE constructions ADD COLUMN contract_number TEXT").run();
  }
};
migrate();

app.post("/api/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "E-mail e senha são obrigatórios" });
  }

  if (!supabase) {
    return res.status(500).json({ error: "Supabase não configurado no servidor" });
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (authError || !authData.user) {
      console.error("Supabase Auth Error:", authError?.message || "Usuário não autenticado");
      
      // Check if user exists locally but login failed
      const localUser = db.prepare("SELECT * FROM profiles WHERE email = ?").get(email);
      
      if (authError?.message?.toLowerCase().includes("invalid login credentials")) {
        if (localUser) {
          return res.status(401).json({ 
            error: "Senha incorreta para este e-mail.",
            detail: "Se você esqueceu sua senha, tente criar uma nova conta ou redefinir no Supabase."
          });
        } else {
          return res.status(401).json({ 
            error: "E-mail não encontrado.",
            detail: "Clique em 'Crie uma agora' para se cadastrar."
          });
        }
      }
      
      // If the error message is about API keys, return a more descriptive error
      if (authError?.message?.toLowerCase().includes("api key") || 
          authError?.message?.toLowerCase().includes("invalid url")) {
        return res.status(500).json({ error: "Erro de configuração no Supabase. Verifique as chaves (URL/Key) no painel de segredos." });
      }
      
      return res.status(401).json({ error: "E-mail ou senha inválidos" });
    }

    const userUuid = authData.user.id;

    // Buscar perfil local
    let profile = db.prepare("SELECT * FROM profiles WHERE id = ?").get(userUuid) as any;

    // Definir role
    const mainEmail = "engemec.gabrielsilva@gmail.com";
    const role =
      email === mainEmail || email === "admin@proteforms.com"
        ? "admin"
        : "tecnico";

    if (!profile) {
      // Tentar buscar nome no Supabase
      const { data: sbProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userUuid)
        .single();

      const name =
        sbProfile?.name ||
        authData.user.user_metadata?.full_name ||
        email.split("@")[0];

      db.prepare("INSERT INTO profiles (id, email, role, name) VALUES (?, ?, ?, ?)")
        .run(userUuid, email, role, name);

      profile = { id: userUuid, email, role, name };
    } else if (profile.role !== role) {
      db.prepare("UPDATE profiles SET role = ? WHERE id = ?").run(role, userUuid);
      profile.role = role;
    }

    // Sincronizar perfil com Supabase imediatamente após login/atualização
    await syncToSupabase('profiles', profile);

    (req.session as any).userId = profile.id;
    (req.session as any).role = profile.role;
    (req.session as any).name = profile.name;

    console.log("Session set for user:", profile.id, "Role:", profile.role);

    req.session.save((err) => {
      if (err) {
        console.error("Session Save Error:", err);
        return res.status(500).json({ error: "Erro ao salvar sessão" });
      }

      console.log("Session saved successfully. Cookie will be sent.");
      return res.json({
        id: profile.id,
        email: profile.email,
        role: profile.role,
        name: profile.name
      });
    });
  } catch (err: any) {
    console.error("Login Exception:", err.message);
    return res.status(500).json({ error: "Erro interno no login" });
  }
});

app.post("/api/signup", async (req, res) => {
  const { email, password, name } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: "E-mail, senha e nome são obrigatórios" });
  }

  if (!supabase) {
    return res.status(500).json({ error: "Supabase não configurado no servidor" });
  }

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name
        }
      }
    });

    if (authError || !authData.user) {
      return res.status(400).json({ error: authError?.message || "Erro ao criar conta" });
    }

    const userUuid = authData.user.id;

    // Create local profile
    const mainEmail = "engemec.gabrielsilva@gmail.com";
    const role = email === mainEmail || email === "admin@proteforms.com" ? "admin" : "tecnico";

    db.prepare("INSERT INTO profiles (id, email, role, name) VALUES (?, ?, ?, ?)")
      .run(userUuid, email, role, name);

    // Sync to Supabase profiles table if it exists
    syncToSupabase('profiles', { id: userUuid, role, name });

    return res.json({ message: "Conta criada com sucesso! Verifique seu e-mail se necessário ou faça login." });
  } catch (err: any) {
    console.error("Signup Error:", err);
    return res.status(500).json({ error: "Erro interno ao criar conta" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error("Logout Error:", err);
    res.clearCookie('proteforms.sid');
    res.json({ success: true });
  });
});

app.get("/api/me", (req, res) => {
  const session = req.session as any;
  console.log("Session Check - UserID:", session?.userId);
  if (!session?.userId) {
    return res.status(401).json({ error: "Not logged in" });
  }
  res.json({ 
    id: session.userId, 
    role: session.role, 
    name: session.name 
  });
});

app.get("/api/session-test", (req, res) => {
  const session = req.session as any;
  res.json({
    sessionExists: !!session,
    userId: session?.userId || null,
    role: session?.role || null,
    name: session?.name || null
  });
});

// API Routes
app.get("/api/constructions", requireAuth, (req, res) => {
  const constructions = db.prepare("SELECT * FROM constructions").all();
  res.json(constructions);
});

app.post("/api/constructions", requireAuth, async (req, res) => {
  console.log("Creating construction:", req.body);
  const { name, photo, address, responsible, contractor, contract_number, start_date, end_date } = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO constructions (name, photo, address, responsible, contractor, contract_number, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, photo, address, responsible, contractor, contract_number, start_date, end_date);
    
    const newId = result.lastInsertRowid;
    const newConstruction = db.prepare("SELECT * FROM constructions WHERE id = ?").get(newId);
    console.log("Construction created locally:", newId);
    await syncToSupabase('constructions', newConstruction);
    
    res.json({ id: newId });
  } catch (error: any) {
    console.error("Error creating construction:", error);
    res.status(500).json({ error: "Erro ao criar obra no banco de dados local" });
  }
});

app.put("/api/constructions/:id", requireAuth, async (req, res) => {
  const { name, photo, address, responsible, contractor, contract_number, start_date, end_date, status } = req.body;
  try {
    db.prepare(`
      UPDATE constructions 
      SET name = ?, photo = ?, address = ?, responsible = ?, contractor = ?, contract_number = ?, start_date = ?, end_date = ?, status = ?
      WHERE id = ?
    `).run(name, photo, address, responsible, contractor, contract_number, start_date, end_date, status || 'em_andamento', req.params.id);
    
    const updatedConstruction = db.prepare("SELECT * FROM constructions WHERE id = ?").get(req.params.id);
    await syncToSupabase('constructions', updatedConstruction);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating construction:", error);
    res.status(500).json({ error: "Failed to update construction" });
  }
});

app.delete("/api/constructions/:id", requireAuth, async (req, res) => {
  try {
    // Check if there are reports linked to this construction
    const reportsCount = db.prepare("SELECT COUNT(*) as count FROM reports WHERE construction_id = ?").get(req.params.id) as any;
    if (reportsCount.count > 0) {
      return res.status(400).json({ error: "Não é possível excluir uma obra que possui relatórios vinculados." });
    }

    db.prepare("DELETE FROM constructions WHERE id = ?").run(req.params.id);
    deleteFromSupabase('constructions', req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting construction:", error);
    res.status(500).json({ error: "Erro ao excluir obra" });
  }
});

app.get("/api/users", requireAdmin, (req, res) => {
  const users = db.prepare("SELECT id, email, role, name FROM profiles").all();
  res.json(users);
});

app.post("/api/users", requireAdmin, async (req, res) => {
  const { email, password, role, name } = req.body;
  
  if (!supabase) {
    return res.status(500).json({ error: "Supabase não configurado" });
  }

  try {
    let userUuid: string;
    
    // Tentar criar via Admin API (melhor pois confirma e-mail automaticamente)
    // Isso requer a SUPABASE_SERVICE_ROLE_KEY
    const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name }
    });

    if (adminError) {
      console.warn("Admin createUser failed, falling back to signUp:", adminError.message);
      
      // Fallback para signUp comum se não tiver service role key
      // Nota: Isso pode exigir confirmação de e-mail dependendo das configs do Supabase
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name }
        }
      });

      if (signUpError) {
        console.error("SignUp fallback failed:", signUpError.message);
        return res.status(400).json({ error: signUpError.message });
      }
      
      if (!signUpData.user) {
        return res.status(400).json({ error: "Falha ao criar usuário no Supabase Auth" });
      }
      
      userUuid = signUpData.user.id;
    } else {
      userUuid = adminData.user.id;
    }

    // Criar perfil local
    db.prepare("INSERT INTO profiles (id, email, role, name) VALUES (?, ?, ?, ?)").run(userUuid, email, role, name);
    
    // Sincronizar com Supabase
    const profile = { id: userUuid, email, role, name };
    await syncToSupabase('profiles', profile);

    res.json({ id: userUuid });
  } catch (error: any) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/users/:id", requireAdmin, (req, res) => {
  try {
    db.prepare("DELETE FROM profiles WHERE id = ?").run(req.params.id);
    deleteFromSupabase('profiles', req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

app.get("/api/reports", requireAuth, (req, res) => {
  const reports = db.prepare(`
    SELECT r.*, c.name as construction_name, c.contract_number,
           (SELECT COUNT(*) FROM reports r2 WHERE r2.construction_id = r.construction_id AND r2.id <= r.id) as sequence_number
    FROM reports r 
    JOIN constructions c ON r.construction_id = c.id
    ORDER BY r.id DESC
  `).all();
  res.json(reports);
});

app.get("/api/reports/:id", requireAuth, (req, res) => {
  const report = db.prepare(`
    SELECT r.*, c.contract_number,
           (SELECT COUNT(*) FROM reports r2 WHERE r2.construction_id = r.construction_id AND r2.id <= r.id) as sequence_number
    FROM reports r
    JOIN constructions c ON r.construction_id = c.id
    WHERE r.id = ?
  `).get(req.params.id);
  
  if (!report) return res.status(404).json({ error: "Report not found" });
  
  const photos = db.prepare("SELECT * FROM report_photos WHERE report_id = ? ORDER BY order_index").all(req.params.id);
  const checklist = db.prepare("SELECT * FROM report_checklists WHERE report_id = ?").all(req.params.id);
  
  res.json({ ...report, photos, checklist });
});

app.post("/api/reports", requireAuth, async (req, res) => {
  const { construction_id, inspection_date, technical_observations, photos, checklist, status } = req.body;
  
  try {
    const transaction = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO reports (construction_id, inspection_date, technical_observations, status, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(construction_id, inspection_date, technical_observations, status || 'em_preenchimento', (req.session as any).userId);
      
      const reportId = result.lastInsertRowid;
      
      if (photos) {
        const insertPhoto = db.prepare("INSERT INTO report_photos (report_id, image_url, caption, order_index) VALUES (?, ?, ?, ?)");
        photos.forEach((p: any, i: number) => insertPhoto.run(reportId, p.image_url, p.caption, i));
      }
      
      if (checklist) {
        const insertCheck = db.prepare("INSERT INTO report_checklists (report_id, item_name, status, observation) VALUES (?, ?, ?, ?)");
        checklist.forEach((c: any) => insertCheck.run(reportId, c.item_name, c.status, c.observation));
      }
      
      return reportId;
    });
    
    const id = transaction();
    
    // Sync to Supabase - Ensure parent records exist first
    // 1. Sync Creator Profile
    const creatorProfile = db.prepare("SELECT * FROM profiles WHERE id = ?").get((req.session as any).userId);
    if (creatorProfile) {
      await syncToSupabase('profiles', creatorProfile);
    }

    // 2. Sync Construction
    const construction = db.prepare("SELECT * FROM constructions WHERE id = ?").get(construction_id);
    if (construction) {
      await syncToSupabase('constructions', construction);
    }

    // 3. Sync Report
    const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(id);
    await syncToSupabase('reports', report);

    // 4. Sync Children
    const reportPhotos = db.prepare("SELECT * FROM report_photos WHERE report_id = ?").all(id);
    const reportChecklists = db.prepare("SELECT * FROM report_checklists WHERE report_id = ?").all(id);
    
    await syncToSupabase('report_photos', reportPhotos);
    await syncToSupabase('report_checklists', reportChecklists);
    
    res.json({ id });
  } catch (error: any) {
    console.error("Error creating report:", error);
    res.status(500).json({ error: "Failed to create report" });
  }
});

app.put("/api/reports/:id", requireAuth, async (req, res) => {
  const { construction_id, inspection_date, technical_observations, photos, checklist, status } = req.body;
  const reportId = req.params.id;

  try {
    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE reports 
        SET construction_id = ?, inspection_date = ?, technical_observations = ?, status = ?, revision = revision + 1
        WHERE id = ?
      `).run(construction_id, inspection_date, technical_observations, status, reportId);

      // Refresh photos
      db.prepare("DELETE FROM report_photos WHERE report_id = ?").run(reportId);
      if (photos) {
        const insertPhoto = db.prepare("INSERT INTO report_photos (report_id, image_url, caption, order_index) VALUES (?, ?, ?, ?)");
        photos.forEach((p: any, i: number) => insertPhoto.run(reportId, p.image_url, p.caption, i));
      }

      // Refresh checklist
      db.prepare("DELETE FROM report_checklists WHERE report_id = ?").run(reportId);
      if (checklist) {
        const insertCheck = db.prepare("INSERT INTO report_checklists (report_id, item_name, status, observation) VALUES (?, ?, ?, ?)");
        checklist.forEach((c: any) => insertCheck.run(reportId, c.item_name, c.status, c.observation));
      }

      return reportId;
    });

    transaction();
    
    // Sync to Supabase - Ensure parent records exist first
    // 1. Sync Creator Profile (the one who is editing might be different or not synced)
    const creatorProfile = db.prepare("SELECT * FROM profiles WHERE id = ?").get((req.session as any).userId);
    if (creatorProfile) {
      await syncToSupabase('profiles', creatorProfile);
    }

    // 2. Sync Construction
    const construction = db.prepare("SELECT * FROM constructions WHERE id = ?").get(construction_id);
    if (construction) {
      await syncToSupabase('constructions', construction);
    }

    // 3. Sync Report
    const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(reportId);
    await syncToSupabase('reports', report);

    // 4. Sync Children
    const reportPhotos = db.prepare("SELECT * FROM report_photos WHERE report_id = ?").all(reportId);
    const reportChecklists = db.prepare("SELECT * FROM report_checklists WHERE report_id = ?").all(reportId);
    
    await syncToSupabase('report_photos', reportPhotos);
    await syncToSupabase('report_checklists', reportChecklists);
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating report:", error);
    res.status(500).json({ error: "Failed to update report" });
  }
});

app.delete("/api/reports/:id", requireAuth, async (req, res) => {
  try {
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM report_photos WHERE report_id = ?").run(req.params.id);
      db.prepare("DELETE FROM report_checklists WHERE report_id = ?").run(req.params.id);
      db.prepare("DELETE FROM reports WHERE id = ?").run(req.params.id);
    });
    
    transaction();
    
    // Delete from Supabase (photos and checklists might not have IDs in syncToSupabase, but reports definitely does)
    deleteFromSupabase('reports', req.params.id);
    // Note: Supabase RLS or Cascade Delete should handle child tables if configured, 
    // but here we just delete the main record.
    
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting report:", error);
    res.status(500).json({ error: "Erro ao excluir relatório" });
  }
});

app.get("/api/settings", requireAuth, (req, res) => {
  const settings = db.prepare("SELECT * FROM company_settings WHERE id = 1").get();
  res.json(settings || {});
});

app.post("/api/settings", requireAdmin, async (req, res) => {
  console.log("Saving settings:", req.body);
  const { 
    name, cnpj, logo, technical_responsible, email, phone, default_checklist,
    resp1_name, resp1_reg_name, resp1_reg_num, resp1_title, resp1_signature,
    resp2_name, resp2_reg_name, resp2_reg_num, resp2_title, resp2_signature,
    primary_resp
  } = req.body;
  const exists = db.prepare("SELECT id FROM company_settings WHERE id = 1").get();
  
  try {
    if (exists) {
      db.prepare(`
        UPDATE company_settings 
        SET name = ?, cnpj = ?, logo = ?, technical_responsible = ?, email = ?, phone = ?, default_checklist = ?,
            resp1_name = ?, resp1_reg_name = ?, resp1_reg_num = ?, resp1_title = ?, resp1_signature = ?,
            resp2_name = ?, resp2_reg_name = ?, resp2_reg_num = ?, resp2_title = ?, resp2_signature = ?,
            primary_resp = ?
        WHERE id = 1
      `).run(
        name, cnpj, logo, technical_responsible, email, phone, default_checklist,
        resp1_name, resp1_reg_name, resp1_reg_num, resp1_title, resp1_signature,
        resp2_name, resp2_reg_name, resp2_reg_num, resp2_title, resp2_signature,
        primary_resp
      );
    } else {
      db.prepare(`
        INSERT INTO company_settings (
          id, name, cnpj, logo, technical_responsible, email, phone, default_checklist,
          resp1_name, resp1_reg_name, resp1_reg_num, resp1_title, resp1_signature,
          resp2_name, resp2_reg_name, resp2_reg_num, resp2_title, resp2_signature,
          primary_resp
        )
        VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name, cnpj, logo, technical_responsible, email, phone, default_checklist,
        resp1_name, resp1_reg_name, resp1_reg_num, resp1_title, resp1_signature,
        resp2_name, resp2_reg_name, resp2_reg_num, resp2_title, resp2_signature,
        primary_resp
      );
    }
    
    const updatedSettings = db.prepare("SELECT * FROM company_settings WHERE id = 1").get();
    syncToSupabase('company_settings', updatedSettings);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving settings:", error);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

app.get("/api/analytics", requireAuth, (req, res) => {
  try {
    // Reports by Month
    const reportsByMonth = db.prepare(`
      SELECT strftime('%Y-%m', inspection_date) as month, COUNT(*) as count 
      FROM reports 
      GROUP BY month 
      ORDER BY month ASC
    `).all();

    // Reports by Construction
    const reportsByConstruction = db.prepare(`
      SELECT c.name as construction, COUNT(r.id) as count 
      FROM constructions c
      LEFT JOIN reports r ON c.id = r.construction_id
      GROUP BY c.id
      ORDER BY count DESC
    `).all();

    // Status Distribution
    const statusDistribution = db.prepare(`
      SELECT status, COUNT(*) as count 
      FROM reports 
      GROUP BY status
    `).all();

    res.json({ reportsByMonth, reportsByConstruction, statusDistribution });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

app.post("/api/supabase/sync", requireAdmin, async (req, res) => {
  if (!supabase) {
    return res.status(400).json({ error: "Supabase not configured" });
  }

  try {
    const profiles = db.prepare("SELECT * FROM profiles").all();
    const constructions = db.prepare("SELECT * FROM constructions").all();
    const reports = db.prepare("SELECT * FROM reports").all();
    const reportPhotos = db.prepare("SELECT * FROM report_photos").all();
    const reportChecklists = db.prepare("SELECT * FROM report_checklists").all();
    const checklistTemplates = db.prepare("SELECT * FROM checklist_templates").all();
    const settings = db.prepare("SELECT * FROM company_settings WHERE id = 1").get();

    // Upsert all data to Supabase
    if (profiles.length > 0) await supabase.from('profiles').upsert(profiles);
    if (constructions.length > 0) await supabase.from('constructions').upsert(constructions);
    
    // For JSONB fields, ensure they are sent as objects
    const formattedTemplates = checklistTemplates.map((t: any) => ({ ...t, items: JSON.parse(t.items) }));
    const formattedSettings = settings ? { ...settings, default_checklist: JSON.parse(settings.default_checklist || '[]') } : null;

    if (reports.length > 0) await supabase.from('reports').upsert(reports);
    if (reportPhotos.length > 0) await supabase.from('report_photos').upsert(reportPhotos);
    if (reportChecklists.length > 0) await supabase.from('report_checklists').upsert(reportChecklists);
    if (formattedTemplates.length > 0) await supabase.from('checklist_templates').upsert(formattedTemplates);
    if (formattedSettings) await supabase.from('company_settings').upsert([formattedSettings]);

    res.json({ success: true, message: "Sincronização completa realizada com sucesso!" });
  } catch (error: any) {
    console.error("Supabase sync error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/stats", requireAuth, (req, res) => {
  const totalConstructions = db.prepare("SELECT COUNT(*) as count FROM constructions").get().count;
  const totalReports = db.prepare("SELECT COUNT(*) as count FROM reports").get().count;
  const statusCounts = db.prepare("SELECT status, COUNT(*) as count FROM constructions GROUP BY status").all();
  
  res.json({ totalConstructions, totalReports, statusCounts });
});

app.get("/api/checklist-templates", requireAuth, (req, res) => {
  const templates = db.prepare("SELECT * FROM checklist_templates").all();
  const parsedTemplates = templates.map((t: any) => ({
    ...t,
    items: JSON.parse(t.items)
  }));
  res.json(parsedTemplates);
});

app.post("/api/checklist-templates", requireAdmin, async (req, res) => {
  const { title, items } = req.body;
  try {
    const result = db.prepare("INSERT INTO checklist_templates (title, items) VALUES (?, ?)").run(title, JSON.stringify(items));
    const newId = result.lastInsertRowid;
    
    const newTemplate = db.prepare("SELECT * FROM checklist_templates WHERE id = ?").get(newId);
    syncToSupabase('checklist_templates', newTemplate);
    
    res.json({ id: newId });
  } catch (error: any) {
    console.error("Error creating checklist template:", error);
    res.status(500).json({ error: "Failed to create checklist template" });
  }
});

app.delete("/api/checklist-templates/:id", requireAdmin, (req, res) => {
  try {
    db.prepare("DELETE FROM checklist_templates WHERE id = ?").run(req.params.id);
    deleteFromSupabase('checklist_templates', req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting checklist template:", error);
    res.status(500).json({ error: "Failed to delete checklist template" });
  }
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
