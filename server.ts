import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cors from "cors";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MemoryStore = session.MemoryStore;

// Supabase Client
const supabaseUrl = (process.env.SUPABASE_URL || process.env.api_url || "").trim();
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
  const isServiceKey = supabaseKey.length > 100;
  console.log(`Supabase integration active (${isServiceKey ? 'Service Role' : 'Anon Key'}). URL:`, supabaseUrl.substring(0, 15) + "...");
} else {
  console.log("Supabase integration not configured or invalid.");
}

const app = express();
app.set('trust proxy', 1);

const isProduction = process.env.NODE_ENV === "production" || !!process.env.APP_URL;

// Force HTTPS headers for session security
app.use((req, res, next) => {
  if (isProduction) {
    req.headers['x-forwarded-proto'] = 'https';
    req.headers['x-forwarded-port'] = '443';
  }
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(session({
  store: new MemoryStore(),
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

// Auth Middleware
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};

const requireAdmin = async (req: any, res: any, next: any) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.session.role !== 'admin') {
    const { data: profile } = await supabase!.from("profiles").select("email, role").eq("id", req.session.userId).single();
    const mainEmail = "engemec.gabrielsilva@gmail.com";
    if (profile?.email === mainEmail || profile?.email === "admin@proteforms.com") {
      req.session.role = 'admin';
    } else if (profile?.role === 'admin') {
      req.session.role = 'admin';
    }
  }

  if (req.session?.role !== 'admin') {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
};

// Rate Limiting for Login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Muitas tentativas de login. Tente novamente em 15 minutos." },
  validate: { trustProxy: false }
});

app.post("/api/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!supabase) return res.status(500).json({ error: "Supabase não configurado" });

  try {
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      return res.status(401).json({ error: "E-mail ou senha inválidos" });
    }

    const userUuid = authData.user.id;
    let { data: profile } = await supabase.from("profiles").select("*").eq("id", userUuid).single();

    const mainEmail = "engemec.gabrielsilva@gmail.com";
    const role = (email === mainEmail || email === "admin@proteforms.com") ? "admin" : (profile?.role || "tecnico");

    if (!profile) {
      const name = authData.user.user_metadata?.full_name || email.split("@")[0];
      const { data: newProfile } = await supabase.from("profiles").insert({ id: userUuid, email, role, name }).select().single();
      profile = newProfile;
    } else if (profile.role !== role) {
      const { data: updatedProfile } = await supabase.from("profiles").update({ role }).eq("id", userUuid).select().single();
      profile = updatedProfile;
    }

    (req.session as any).userId = profile!.id;
    (req.session as any).role = profile!.role;
    (req.session as any).name = profile!.name;

    req.session.save(() => {
      res.json({ id: profile!.id, email: profile!.email, role: profile!.role, name: profile!.name });
    });
  } catch (err: any) {
    res.status(500).json({ error: "Erro interno no login" });
  }
});

app.post("/api/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!supabase) return res.status(500).json({ error: "Supabase não configurado" });

  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });

    if (authError || !authData.user) return res.status(400).json({ error: authError?.message || "Erro ao criar conta" });

    const userUuid = authData.user.id;
    const mainEmail = "engemec.gabrielsilva@gmail.com";
    const role = (email === mainEmail || email === "admin@proteforms.com") ? "admin" : "tecnico";

    await supabase.from("profiles").insert({ id: userUuid, email, role, name });

    res.json({ message: "Conta criada com sucesso!" });
  } catch (err: any) {
    res.status(500).json({ error: "Erro interno ao criar conta" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('proteforms.sid');
    res.json({ success: true });
  });
});

app.get("/api/me", (req, res) => {
  const session = req.session as any;
  if (!session?.userId) return res.status(401).json({ error: "Not logged in" });
  res.json({ id: session.userId, role: session.role, name: session.name });
});

// API Routes
app.get("/api/constructions", requireAuth, async (req, res) => {
  const { data, error } = await supabase!.from("constructions").select("*").order("name");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/constructions", requireAuth, async (req, res) => {
  const { name, photo, address, responsible, contractor, contract_number, start_date, end_date } = req.body;
  const { data, error } = await supabase!.from("constructions").insert({
    name, photo, address, responsible, contractor, contract_number, start_date, end_date
  }).select().single();
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.id });
});

app.put("/api/constructions/:id", requireAuth, async (req, res) => {
  const { name, photo, address, responsible, contractor, contract_number, start_date, end_date, status } = req.body;
  const { error } = await supabase!.from("constructions").update({
    name, photo, address, responsible, contractor, contract_number, start_date, end_date, status: status || 'em_andamento'
  }).eq("id", req.params.id);
  
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete("/api/constructions/:id", requireAuth, async (req, res) => {
  const { count } = await supabase!.from("reports").select("*", { count: 'exact', head: true }).eq("construction_id", req.params.id);
  if (count && count > 0) return res.status(400).json({ error: "Não é possível excluir uma obra que possui relatórios vinculados." });

  const { error } = await supabase!.from("constructions").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get("/api/users", requireAdmin, async (req, res) => {
  const { data, error } = await supabase!.from("profiles").select("id, email, role, name");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/users", requireAdmin, async (req, res) => {
  const { email, password, role, name } = req.body;
  if (!supabase) return res.status(500).json({ error: "Supabase não configurado" });

  try {
    const { data: adminData, error: adminError } = await supabase.auth.admin.createUser({
      email, password, email_confirm: true, user_metadata: { full_name: name }
    });

    let userUuid: string;
    if (adminError) {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email, password, options: { data: { full_name: name } }
      });
      if (signUpError || !signUpData.user) return res.status(400).json({ error: signUpError?.message || "Erro ao criar usuário" });
      userUuid = signUpData.user.id;
    } else {
      userUuid = adminData.user.id;
    }

    await supabase.from("profiles").insert({ id: userUuid, email, role, name });
    res.json({ id: userUuid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/users/:id", requireAdmin, async (req, res) => {
  const { error } = await supabase!.from("profiles").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get("/api/reports", requireAuth, async (req, res) => {
  const { data, error } = await supabase!.from("reports").select(`
    *,
    constructions:construction_id (name, contract_number)
  `).order("id", { ascending: false });
  
  if (error) return res.status(500).json({ error: error.message });
  
  // Flatten the response to match the expected format
  const formatted = data.map((r: any) => ({
    ...r,
    construction_name: r.constructions?.name,
    contract_number: r.constructions?.contract_number
  }));
  
  res.json(formatted);
});

app.get("/api/reports/:id", requireAuth, async (req, res) => {
  const { data: report, error: reportError } = await supabase!.from("reports").select(`
    *,
    constructions:construction_id (contract_number)
  `).eq("id", req.params.id).single();
  
  if (reportError || !report) return res.status(404).json({ error: "Report not found" });
  
  const { data: photos } = await supabase!.from("report_photos").select("*").eq("report_id", req.params.id).order("order_index");
  const { data: checklist } = await supabase!.from("report_checklists").select("*").eq("report_id", req.params.id);
  
  res.json({ 
    ...report, 
    contract_number: report.constructions?.contract_number,
    photos: photos || [], 
    checklist: checklist || [] 
  });
});

app.post("/api/reports", requireAuth, async (req, res) => {
  const { construction_id, inspection_date, technical_observations, photos, checklist, status } = req.body;
  
  try {
    const { data: report, error: reportError } = await supabase!.from("reports").insert({
      construction_id, inspection_date, technical_observations, status: status || 'em_preenchimento', created_by: (req.session as any).userId
    }).select().single();
    
    if (reportError) throw reportError;
    const reportId = report.id;
    
    if (photos && photos.length > 0) {
      const photosPayload = photos.map((p: any, i: number) => ({
        report_id: reportId, image_url: p.image_url, caption: p.caption, order_index: i
      }));
      await supabase!.from("report_photos").insert(photosPayload);
    }
    
    if (checklist && checklist.length > 0) {
      const checklistPayload = checklist.map((c: any) => ({
        report_id: reportId, item_name: c.item_name, status: c.status, observation: c.observation
      }));
      await supabase!.from("report_checklists").insert(checklistPayload);
    }
    
    res.json({ id: reportId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/reports/:id", requireAuth, async (req, res) => {
  const { construction_id, inspection_date, technical_observations, photos, checklist, status } = req.body;
  const reportId = req.params.id;

  try {
    const { error: reportError } = await supabase!.from("reports").update({
      construction_id, inspection_date, technical_observations, status, revision: 0 // revision logic might need adjustment if used
    }).eq("id", reportId);
    
    if (reportError) throw reportError;

    await supabase!.from("report_photos").delete().eq("report_id", reportId);
    if (photos && photos.length > 0) {
      const photosPayload = photos.map((p: any, i: number) => ({
        report_id: reportId, image_url: p.image_url, caption: p.caption, order_index: i
      }));
      await supabase!.from("report_photos").insert(photosPayload);
    }

    await supabase!.from("report_checklists").delete().eq("report_id", reportId);
    if (checklist && checklist.length > 0) {
      const checklistPayload = checklist.map((c: any) => ({
        report_id: reportId, item_name: c.item_name, status: c.status, observation: c.observation
      }));
      await supabase!.from("report_checklists").insert(checklistPayload);
    }
    
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/reports/:id", requireAuth, async (req, res) => {
  try {
    await supabase!.from("report_photos").delete().eq("report_id", req.params.id);
    await supabase!.from("report_checklists").delete().eq("report_id", req.params.id);
    const { error } = await supabase!.from("reports").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/settings", requireAuth, async (req, res) => {
  const { data, error } = await supabase!.from("company_settings").select("*").eq("id", 1).single();
  res.json(data || {});
});

app.post("/api/settings", requireAdmin, async (req, res) => {
  const { error } = await supabase!.from("company_settings").upsert({ id: 1, ...req.body });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.get("/api/analytics", requireAuth, async (req, res) => {
  try {
    const { data: reports } = await supabase!.from("reports").select("inspection_date, status, construction_id");
    const { data: constructions } = await supabase!.from("constructions").select("id, name");

    // Process analytics in JS since complex SQL is harder with basic Supabase client
    const reportsByMonth: any[] = [];
    const reportsByConstruction: any[] = [];
    const statusDistribution: any[] = [];

    const monthMap = new Map();
    const constrMap = new Map();
    const statusMap = new Map();

    reports?.forEach(r => {
      const month = r.inspection_date.substring(0, 7);
      monthMap.set(month, (monthMap.get(month) || 0) + 1);
      
      constrMap.set(r.construction_id, (constrMap.get(r.construction_id) || 0) + 1);
      statusMap.set(r.status, (statusMap.get(r.status) || 0) + 1);
    });

    monthMap.forEach((count, month) => reportsByMonth.push({ month, count }));
    statusMap.forEach((count, status) => statusDistribution.push({ status, count }));
    
    constructions?.forEach(c => {
      reportsByConstruction.push({ construction: c.name, count: constrMap.get(c.id) || 0 });
    });

    res.json({ 
      reportsByMonth: reportsByMonth.sort((a, b) => a.month.localeCompare(b.month)), 
      reportsByConstruction: reportsByConstruction.sort((a, b) => b.count - a.count), 
      statusDistribution 
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

app.get("/api/stats", requireAuth, async (req, res) => {
  const { count: totalConstructions } = await supabase!.from("constructions").select("*", { count: 'exact', head: true });
  const { count: totalReports } = await supabase!.from("reports").select("*", { count: 'exact', head: true });
  const { data: statusData } = await supabase!.from("constructions").select("status");
  
  const statusCounts: any[] = [];
  const sMap = new Map();
  statusData?.forEach(s => sMap.set(s.status, (sMap.get(s.status) || 0) + 1));
  sMap.forEach((count, status) => statusCounts.push({ status, count }));

  res.json({ totalConstructions, totalReports, statusCounts });
});

app.get("/api/checklist-templates", requireAuth, async (req, res) => {
  const { data, error } = await supabase!.from("checklist_templates").select("*");
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/checklist-templates", requireAdmin, async (req, res) => {
  const { title, items } = req.body;
  const { data, error } = await supabase!.from("checklist_templates").insert({ title, items }).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.id });
});

app.delete("/api/checklist-templates/:id", requireAdmin, async (req, res) => {
  const { error } = await supabase!.from("checklist_templates").delete().eq("id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
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
