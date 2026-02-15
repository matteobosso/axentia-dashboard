# Axentia Automation Dashboard

## Project Overview

**Project Name:** Axentia Automation Dashboard
**Type:** Multi-tenant dashboard for n8n automation management
**Owner:** Axentia Automation
**Status:** In development - pre-scaling phase
**Custom Domain:** `dash.axentia-automation.it`

### Admin Account
- **Primary Admin Email:** info@axentia-automation.it
- Admin users have `role: 'admin'` in Firebase custom claims
- Admin has `company_id: null` (non è legato a un'azienda)
- First admin must be set up manually in Firebase Console

### Tech Stack
- **Frontend:** Vanilla JavaScript ES6+ (no frameworks)
- **CSS:** Custom CSS con CSS Variables (no Tailwind, Bootstrap, etc.)
- **Backend:** n8n workflow engine (no custom API server)
- **Database:** PostgreSQL 15+ with pgvector extension
- **Auth:** Firebase Auth (email/password) con custom claims per RBAC
- **Storage:** File system on Oracle Cloud VM per knowledge base
- **AI/ML:** Google Gemini API for embeddings and LLM
- **Infrastructure:** Oracle Cloud Always Free tier
- **Hosting:** GitHub Pages (static frontend)
- **Analytics:** Google Analytics (`G-X6MMD9Q21B`)
- **CDN:** Cloudflare (free tier)

---

## Frontend

### Pagine HTML

| File | Scopo | Script dedicato |
|------|-------|-----------------|
| [login.html](login.html) | Login email/password (Firebase Auth) | Inline script |
| [index.html](index.html) | Dashboard KPI: ore risparmiate, esecuzioni, ROI, grafici | [dashboard.js](assets/js/dashboard.js) |
| [report.html](report.html) | Tabella report con metriche per automazione | [dashboard.js](assets/js/dashboard.js) |
| [flussi.html](flussi.html) | Griglia workflow con esecuzione manuale e parametri | [dashboard.js](assets/js/dashboard.js) |
| [conoscenza.html](conoscenza.html) | Upload e gestione documenti knowledge base | [dashboard.js](assets/js/dashboard.js) |
| [chat.html](chat.html) | Chat AI con RAG, selezione agente, upload file | [chat.js](assets/js/chat.js) |
| [supporto.html](supporto.html) | Sistema ticket di supporto con messaggistica | [support.js](assets/js/support.js) |
| [utenti.html](utenti.html) | Gestione utenti e aziende (solo admin) | [users.js](assets/js/users.js) |

### File JavaScript

| File | Righe | Ruolo |
|------|-------|-------|
| [auth.js](assets/js/auth.js) | ~670 | **Core:** Firebase Auth, AuthManager singleton, token management, RBAC, endpoint routing |
| [dashboard.js](assets/js/dashboard.js) | ~1110 | Dashboard KPI, report, workflow, knowledge base, Chart.js, filtri |
| [users.js](assets/js/users.js) | ~1185 | UsersManager + CompaniesManager: CRUD utenti/aziende (admin only) |
| [support.js](assets/js/support.js) | ~815 | SupportManager: ticket CRUD, messaggi, badge notifiche |
| [chat.js](assets/js/chat.js) | ~190 | Chat AI: invio messaggi, upload file, rendering markdown/LaTeX |
| [security-utils.js](assets/js/security-utils.js) | ~127 | `SecurityUtils`: escapeHtml, escapeAttribute, validators, generateSecureId |
| [custom.js](assets/js/custom.js) | ~715 | UI generica: tabs, accordion, menu mobile, animazioni scroll (IntersectionObserver) |
| [form.js](assets/js/form.js) | ~127 | Form contatto website (Pristine.js validation + n8n webhook) |
| [cookie-config.js](assets/js/cookie-config.js) | ~58 | Configurazione CookieConsent: categorie necessary + analytics, lingua IT |
| [cookieconsent.js](assets/js/cookieconsent.js) | ~6 | Loader libreria CookieConsent |

**Dipendenze tra file:**
```
auth.js (core - caricato su tutte le pagine)
├── security-utils.js (usato da tutti)
├── dashboard.js (index, report, flussi, conoscenza)
├── chat.js (chat.html)
├── support.js (supporto.html)
└── users.js (utenti.html)
```

### Librerie Esterne & CDN

| Libreria | Versione | Usata in | Scopo |
|----------|----------|----------|-------|
| Firebase Auth | 10.7.0 | Tutte le pagine | Autenticazione |
| Chart.js | latest | index.html, report.html | Grafici KPI (bar + pie chart) |
| marked.js | latest | chat.html | Rendering Markdown nelle risposte AI |
| KaTeX | 0.16.9 | chat.html | Rendering equazioni LaTeX |
| Prism.js | 1.29.0 | chat.html | Syntax highlighting nel codice |
| CookieConsent | - | Tutte le pagine | Banner cookie GDPR (IT) |
| lozad.js | - | index.html | Lazy loading immagini |

**Librerie locali in `assets/libs/`:**
- `highlight/` - Highlight.js con 140+ linguaggi (per website, non dashboard)
- `lozad/` - Image lazy loading
- `pristine/` - Form validation (per form.js)

### CSS & Styling

- **File unico:** [style.css](assets/css/style.css) (~6235 righe)
- **Nessun framework CSS** - tutto custom
- **CSS Variables** per tema:
  - Accent: `#ff524f`
  - Background: `#ffffff`
  - Text: `#151515`
- **Font (WOFF2, preloaded):**
  - Source Sans Pro (body)
  - Montserrat (headings)
  - Playfair Display (decorativo)
- **Cookie consent:** [cookieconsent.css](assets/css/cookieconsent.css)
- **Responsive:** Media queries + hamburger menu mobile

### Autenticazione (Firebase Auth)

**Flusso login:**
```
1. login.html → email/password → Firebase signInWithEmailAndPassword
2. Firebase ritorna user + JWT token
3. auth.js estrae custom claims: { role, company_id }
4. loadClientEndpointFromCompany() → fetch endpoint n8n dell'azienda
5. loadCompaniesIfAdmin() → carica lista aziende (se admin)
6. Redirect a index.html
7. Evento 'authReady' dispatched
```

**AuthManager - Metodi principali:**

| Metodo | Scopo |
|--------|-------|
| `init()` | Inizializza Firebase e listener auth state |
| `waitForAuth()` | Promise che risolve quando auth è determinato |
| `isAdmin()` | Ritorna true se `userRole === 'admin'` |
| `getActiveCompanyId()` | Company ID attiva (admin: selezionata, utente: sua) |
| `getWebhookUrl(path)` | URL endpoint DINAMICO (client endpoint) |
| `getCentralizedApiUrl(path)` | URL endpoint STATICO (main-n8n) |
| `getCompanyEndpoint(companyId)` | Endpoint n8n di una specifica azienda |
| `fetchWithAuth(url, options)` | Fetch con Bearer token automatico |
| `setActiveCompany(companyId)` | Admin: cambia azienda filtrata (fire `companyFilterChanged`) |
| `updateUIForRole()` | Mostra/nascondi elementi con `[data-role="admin\|user"]` |
| `signOut()` | Logout e redirect a login.html |

**Firebase Config (hardcoded, pubblico - OK per frontend):**
- Project: `axentia-website`
- Auth Domain: `axentia-website.firebaseapp.com`

### Differenze Admin vs Utente

| Pagina | Admin | Utente |
|--------|-------|--------|
| **login.html** | Stesso form | Stesso form |
| **index.html** | Vede dropdown filtro azienda, può switchare tra aziende | Vede solo i propri KPI |
| **report.html** | Filtro azienda per vedere report di qualsiasi cliente | Solo i propri report |
| **flussi.html** | Filtro azienda, esegue workflow su endpoint del cliente scelto | Esegue workflow sul proprio endpoint |
| **conoscenza.html** | Filtro azienda, gestisce knowledge base di qualsiasi cliente | Solo la propria knowledge base |
| **chat.html** | Seleziona azienda → chat usa endpoint del cliente scelto | Chat usa il proprio endpoint |
| **supporto.html** | Vede tutti i ticket, colonna "Azienda", note interne, cambio stato, elimina | Vede solo i propri ticket, nessuna nota interna |
| **utenti.html** | Accesso completo: CRUD utenti e aziende | **Accesso negato** - pagina nascosta |

**Implementazione UI:**
- Elementi admin hanno attributo `data-role="admin"` con `style="display: none"`
- `AuthManager.updateUIForRole()` li rende visibili solo per admin
- `utenti.html` mostra messaggio "Accesso Negato" se non admin

### Pattern di Inizializzazione

Ogni pagina segue lo stesso flusso:
```javascript
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Applica UI dalla cache (evita flash)
  initUIFromCache()

  // 2. Inizializza auth
  await AuthManager.init()

  // 3. Attendi che auth sia pronto
  await AuthManager.waitForAuth()

  // 4. Inizializzazione pagina-specifica
  initReport()     // oppure initDashboard(), SupportManager.init(), etc.

  // 5. Listener per cambio azienda (admin)
  window.addEventListener('companyFilterChanged', () => {
    // Ricarica dati con nuova azienda
  })
})
```

### Session & Storage Management

| Storage | Chiave | Scopo |
|---------|--------|-------|
| **sessionStorage** | `n8n_endpoint` | Endpoint n8n del cliente |
| **sessionStorage** | `user_role` | Ruolo utente (admin/user) |
| **sessionStorage** | `company_id` | Company UUID dell'utente |
| **sessionStorage** | `selected_company_id` | Azienda selezionata dall'admin |
| **sessionStorage** | `admin_companies` | JSON array di tutte le aziende (cache admin) |
| **localStorage** | `chat_session_id` | ID sessione chat persistente |
| **localStorage** | `ticket_seen_{uid}` | Tracking ticket letti per badge notifiche |
| **Memory** | `AuthManager.currentUser` | Oggetto utente Firebase |
| **Memory** | `AuthManager.idToken` | JWT token corrente |

---

## Backend (n8n Workflows)

### Architettura: Statico vs Dinamico

Il backend è composto da workflow n8n esposti come webhook. Si dividono in due categorie:

#### Endpoint STATICI (sempre su `main-n8n.axentia-automation.it`)
Gestiscono dati globali che devono essere centralizzati:

| Workflow | Endpoint | ID | Nodi |
|----------|----------|----|------|
| User Management API | `/webhook/user-management` | `yUGfj1SPnlV5ghc3` | 42 |
| Support API | `/webhook/support-api` | `EmrSglbOTyyDDRCP` | 31 |

**Frontend chiama con:** `AuthManager.getCentralizedApiUrl('user-management')`

**Perché centralizzati:**
- Single source of truth per utenti/aziende/ticket
- Dati condivisi tra tutti i clienti
- Manutenzione in un solo punto

#### Endpoint DINAMICI (diversi per ogni cliente)
Ogni cliente ha la propria istanza n8n con questi workflow:

| Workflow | Endpoint | ID (main) | Nodi |
|----------|----------|-----------|------|
| Frontend API | `/webhook/dashboard-api` | `G4CWLAYZUXDVdjxG` | 23 |
| Agent Chat | `/webhook/{agent-path}` | `TvuhroJo6leA84vp` | 7 |

**Frontend chiama con:** `AuthManager.getWebhookUrl('dashboard-api')`
**Admin chiama con:** `AuthManager.getCompanyEndpoint(companyId) + '/webhook/dashboard-api'`

**Perché distribuiti:**
- Ogni cliente ha workflow e dati propri
- Isolamento: dati del cliente restano sulla sua VM
- Performance: query eseguiti sull'istanza dedicata

### [Service] Frontend API (`G4CWLAYZUXDVdjxG`)

**Disponibilità:** Su TUTTI gli endpoint n8n (main + ogni cliente)
**Webhook:** POST `/webhook/dashboard-api`
**Tag:** Dashboard | **Nodi:** 23

Questo è il workflow principale della dashboard. Gestisce KPI, workflow, e knowledge base.

**Flusso completo:**
```
Webhook Gateway → Validate Input (Code) → Switch Action
  │
  ├── "get_workflows" → SQL: Get Workflows → Respond Workflows
  │
  ├── "get_executions" → SQL: Get Executions → Respond Executions
  │
  ├── "get_agents" → SQL: Get Agents → Respond Agents
  │
  ├── "run_workflow" → HTTP Request: Run workflow → Respond Result
  │
  └── "knowledge_base" → Switch sub action
        │
        ├── "list" → SQL: Get KBs → Respond KB
        │
        ├── "delete" → GET Workflow Id (Postgres)
        │   → SQL: Delete KBs → Respond Deleted
        │
        └── "upload" → GET Workflow Id (Postgres)
            → Code in JavaScript (prepare chunks)
            → Postgres PGVector Store
                ├── Embeddings Google Gemini (ai_embedding)
                └── Default Data Loader (ai_document)
            → Respond Done
```

**Actions disponibili:**

| Action | Descrizione | Usata da |
|--------|-------------|----------|
| `get_workflows` | Lista workflow disponibili con metadati | flussi.html |
| `get_executions` | Dati esecuzioni per KPI e grafici | index.html, report.html |
| `get_agents` | Lista agenti AI disponibili | chat.html, conoscenza.html |
| `run_workflow` | Esecuzione manuale workflow con parametri | flussi.html |
| `knowledge_base` (list) | Lista documenti caricati | conoscenza.html |
| `knowledge_base` (delete) | Elimina documento e relativi vector | conoscenza.html |
| `knowledge_base` (upload) | Upload file → chunking → embedding → PGVector | conoscenza.html |

### [Service] User Management API (`yUGfj1SPnlV5ghc3`)

**Disponibilità:** SOLO su main-n8n
**Webhook:** POST `/webhook/user-management`
**Tag:** Dashboard | **Nodi:** 42

Gestisce utenti (su Firebase) e aziende (su PostgreSQL). Ha validazione JWT completa.

**Flusso di sicurezza:**
```
Webhook → Extract Request Data (Set)
  → Has Bearer Token? (IF)
    ├── NO → Respond 401 No Token
    └── YES → Fetch Firebase Public Keys (HTTP Request)
        → Verify JWT (Code: verifica firma con chiave pubblica)
        → Token Valid? (IF)
          ├── NO → Respond 401 Invalid Token
          └── YES → Route by Action (Switch, 10 routes)
```

**Actions disponibili:**

| Action | Admin required | Descrizione |
|--------|:-------------:|-------------|
| `list_users` | No | Lista utenti da Firebase → Transform & Filter |
| `list_companies` | No | Lista aziende da PostgreSQL → Filter |
| `get_company` | No | Singola azienda da PostgreSQL |
| `create_user` | **Si** | Crea utente Firebase → Set Claims → Send Reset Email |
| `update_user` | **Si** | Get Current User → Merge Claims → Update Firebase User |
| `delete_user` | **Si** | Elimina utente da Firebase |
| `create_company` | **Si** | INSERT in PostgreSQL |
| `update_company` | **Si** | UPDATE in PostgreSQL |
| `delete_company` | **Si** | DELETE da PostgreSQL |

**Nota:** Le operazioni di scrittura passano per un nodo "Check Admin" (IF) che verifica il ruolo dal JWT. Se non admin → Respond 403 Forbidden.

**Nota:** Alla creazione utente, viene inviata una email di reset password automaticamente.

### [Service] Support API (`EmrSglbOTyyDDRCP`)

**Disponibilità:** SOLO su main-n8n
**Webhook:** POST `/webhook/support-api`
**Tag:** Dashboard | **Nodi:** 31

Gestisce il sistema ticket di supporto con messaggistica.

**Flusso:**
```
Webhook → Validate Auth (IF: Bearer token)
  ├── NO → Respond 401
  └── YES → Route by Action (Switch, 7 routes)
      ├── list_tickets → Postgres: List Tickets → Respond
      ├── get_ticket → Validate (IF) → Postgres: Get Ticket → Respond
      ├── create_ticket → Validate (IF) → Postgres: Create Ticket → Respond
      ├── add_message → Validate (IF) → Postgres: Add Message
      │   → Check New Status? (IF)
      │     ├── YES → Update Status Inline → Respond
      │     └── NO → Respond
      ├── update_status → Validate (IF) → Postgres: Update Status → Respond
      ├── delete_ticket → Validate (IF) → Delete Messages → Delete Ticket → Respond
      └── fallback → Respond 400 Unknown
```

**Actions disponibili:**

| Action | Body fields | Descrizione |
|--------|-------------|-------------|
| `list_tickets` | `company_id`, `firebase_uid` | Lista ticket (filtrati per azienda/utente) |
| `get_ticket` | `ticket_id` | Dettaglio ticket con messaggi |
| `create_ticket` | `subject`, `description`, `category`, `priority`, `company_id`, `user_id` | Crea nuovo ticket |
| `add_message` | `ticket_id`, `message`, `user_id`, `author_name`, `is_internal`, `new_status` | Aggiunge messaggio (opzionale: cambia stato) |
| `update_status` | `ticket_id`, `status` | Aggiorna stato ticket |
| `delete_ticket` | `ticket_id` | Elimina messaggi + ticket (admin only, FK constraint) |

**Validazione:** Ogni action ha un nodo IF dedicato che valida i campi richiesti prima di eseguire la query.

### Altri Workflow su main-n8n

| Workflow | ID | Nodi | Scopo |
|----------|----|------|-------|
| [Support] Agent Chat | `TvuhroJo6leA84vp` | 7 | Chat AI conversazionale (RAG) |
| [Service] Send email message for new contact | `bBKfC3M4IUNhAheK` | 4 | Email automatica da form contatto website |

### Modificare il Backend con MCP Tools & Skills

Il backend n8n è **completamente accessibile e modificabile** tramite gli strumenti configurati:

**n8n MCP Tools** (configurati in `.mcp.json`):
- `n8n_list_workflows` / `n8n_get_workflow` - Leggere workflow esistenti
- `n8n_create_workflow` / `n8n_update_full_workflow` / `n8n_update_partial_workflow` - Modificare workflow
- `n8n_validate_workflow` / `n8n_autofix_workflow` - Validare e correggere
- `n8n_test_workflow` - Eseguire workflow
- `n8n_workflow_versions` - Gestione versioni e rollback
- `search_nodes` / `get_node` / `validate_node` - Esplorare nodi disponibili
- `search_templates` / `get_template` / `n8n_deploy_template` - Template pronti

**7 n8n Skills installate:**
1. **n8n-mcp-tools-expert** - Guida alla selezione dei tool giusti
2. **n8n-workflow-patterns** - Pattern architetturali comprovati
3. **n8n-node-configuration** - Configurazione nodi con parametri
4. **n8n-validation-expert** - Interpretare errori di validazione
5. **n8n-expression-syntax** - Sintassi espressioni n8n `{{ }}`
6. **n8n-code-javascript** - Codice JS nei Code node
7. **n8n-code-python** - Codice Python nei Code node

**IMPORTANTE - Best practice per modifiche:**
- Mai modificare workflow in produzione senza backup (`n8n_workflow_versions`)
- Usare nodi espliciti (Switch, Postgres, IF, Set) invece di Code node quando possibile
- Validare sempre con `n8n_validate_workflow` prima di salvare
- Testare con dati mock, non dati reali dei clienti

---

## Database Schema

**PostgreSQL con pgvector extension**

```sql
-- Table: companies
CREATE TABLE companies (
    company_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    n8n_endpoint VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table: n8n_vectors (Vector Store per RAG)
CREATE TABLE n8n_vectors (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    metadata JSONB, -- { file_name, workflow_id, upload_date, company_id }
    embedding VECTOR(768) -- Gemini embeddings dimension
);

-- Table: support_tickets
CREATE TABLE support_tickets (
    ticket_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(company_id),
    created_by UUID NOT NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX ON n8n_vectors USING ivfflat (embedding vector_cosine_ops);
```

**Nota:** Gli utenti NON sono in PostgreSQL. Sono gestiti interamente su Firebase Auth con custom claims.

---

## Multi-tenant Architecture

### Principio
Ogni cliente vede SOLO i propri dati. L'isolamento avviene a due livelli:

**1. Livello infrastruttura:** Ogni cliente ha la propria istanza n8n su VM dedicata (licenza n8n Community: 1 VM = 1 istanza).

**2. Livello dati:** `company_id` filtra ogni query:
```sql
SELECT * FROM n8n_vectors
WHERE metadata->>'company_id' = $company_id
```

### Come funziona nel frontend

```javascript
// Utente normale: usa il proprio endpoint
const url = AuthManager.getWebhookUrl('dashboard-api')
// → https://cliente-n8n.example.com/webhook/dashboard-api

// Admin: usa l'endpoint dell'azienda selezionata
const url = AuthManager.getCompanyEndpoint(selectedCompanyId) + '/webhook/dashboard-api'
// → https://azienda-scelta-n8n.example.com/webhook/dashboard-api

// API centralizzate: sempre main-n8n
const url = AuthManager.getCentralizedApiUrl('support-api')
// → https://main-n8n.axentia-automation.it/webhook/support-api
```

### Custom Claims Firebase
```json
// Admin (info@axentia-automation.it)
{ "role": "admin", "company_id": null }

// Utente normale
{ "role": "user", "company_id": "<company-uuid>" }
```

**NOTA:** `n8n_endpoint` NON è nei claims. Viene recuperato dalla tabella companies via `company_id` con la chiamata `AuthManager.loadClientEndpointFromCompany()`.

---

## Security & GDPR

### Frontend Security
- [x] XSS prevention - `SecurityUtils.escapeHtml()` e `escapeAttribute()` su ogni input utente
- [x] Input validation client-side (file size, type, UUID, email)
- [x] Secure session ID con `crypto.randomUUID()`
- [x] Cookie consent GDPR con CookieConsent.js (categorie: necessary + analytics)
- [x] Google Analytics condizionale (solo con consenso)
- [ ] Content Security Policy (CSP) headers
- [ ] CSRF protection

### Backend Security (n8n)
- [x] JWT validation completa in User Management API (Firebase public keys + signature verify)
- [x] Admin role check su operazioni di scrittura (Check Admin → 403)
- [x] Input validation con nodi IF dedicati in Support API
- [ ] JWT validation in Support API (attualmente solo check "Bearer " prefix)
- [ ] JWT validation in Frontend API (attualmente solo Validate Input generico)
- [ ] Rate limiting
- [ ] File upload validation con magic numbers
- [ ] Audit logging

### Validators disponibili (security-utils.js)
```javascript
SecurityUtils.validators = {
  period: ['24h', '7d', '30d', '90d', '365d'],
  fileName: /^[\w\-. ]+\.(pdf|docx|txt|csv|xlsx)$/i,
  workflowId: /^[a-zA-Z0-9_-]+$/,
  uuid: /^[0-9a-f]{8}-...-[0-9a-f]{12}$/i,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  role: ['admin', 'user'],
  ticketStatus: ['open', 'in_progress', 'resolved', 'closed'],
  ticketPriority: ['low', 'medium', 'high', 'urgent'],
  displayName: /^[\p{L}\s\-'.]{1,100}$/u
}
```

### GDPR Compliance
- [x] Cookie consent con opt-in analytics
- [ ] Right to deletion (Art. 17) - come eliminare dati + embeddings?
- [ ] Right to access (Art. 15) - export dati utente
- [ ] Data retention policy
- [ ] Cross-border transfer assessment (Gemini API → Google US)
- [ ] Privacy policy

---

## Deployment & Hosting

### GitHub Pages
- **Domain:** `dash.axentia-automation.it` (CNAME file)
- **Deploy:** git push to main → auto-deploy (1-2 min)
- **HTTPS:** Automatico
- **robots.txt:** `Disallow: /` (dashboard privata, non indicizzata)

### Vincoli GitHub Pages
- Solo file statici (HTML/CSS/JS)
- Nessun server-side processing → tutto via n8n webhooks
- File uploads vanno direttamente a n8n (non salvati su GitHub Pages)
- CORS deve essere configurato su n8n

### Local Testing
```bash
# VS Code Live Server (porta 5501 configurata in .vscode/settings.json)
# Oppure:
python -m http.server 8000
npx http-server -p 8000
```

### Repository Security
**Repository PUBBLICO** - Mai committare:
- `.mcp.json` (contiene API key n8n)
- `.env` files
- API keys, tokens, secrets
- Dati clienti o PII

---

## Development Constraints & Code Style

### Vincoli
- **Frontend:** Vanilla JS only (NO React, Vue, Angular, Svelte)
- **Backend:** n8n workflows only (NO Express, FastAPI, custom API)
- **Hosting:** GitHub Pages static only
- **Budget:** €0 (free tier only)
- **n8n License:** Community Edition (1 VM = 1 istanza per cliente)
- **CSS:** Custom CSS only (NO framework CSS)

### Code Style
- **JavaScript:** ES6+, async/await (no .then() chains)
- **Naming:** camelCase, descriptivo
- **Error handling:** try-catch per async, messaggi user-friendly
- **Comments:** Solo dove la logica non è self-evident
- **Security:** Sempre `SecurityUtils.escapeHtml()` per input utente in innerHTML

### n8n Workflow Best Practices
- **Naming:** `[<Area>] <Workflow Name>` + tag tipo
- **Preferire nodi espliciti** (Switch, Postgres, IF, Set, HTTP Request) invece di Code node
- **Validare sempre** con n8n MCP tools prima del deploy
- **Mai editare produzione** senza backup versione

### Mantenimento Documentazione
**OBBLIGATORIO:** Dopo ogni modifica significativa al progetto, aggiornare questo CLAUDE.md:
- **Nuovo file/pagina HTML** → Aggiornare tabella "Pagine HTML" e sezione pertinente
- **Nuovo file JS o modifica strutturale** → Aggiornare tabella "File JavaScript" e dipendenze
- **Modifica workflow n8n** (nuova action, nuovo nodo, cambio flusso) → Aggiornare la sezione del workflow interessato (Frontend API / User Management / Support API)
- **Nuovo workflow n8n** → Aggiungere sezione dedicata con flusso e actions
- **Cambio schema DB** → Aggiornare sezione "Database Schema"
- **Nuova libreria/CDN** → Aggiornare tabella "Librerie Esterne & CDN"
- **Feature completata** → Spostare da "In Sviluppo"/"Pianificato" a "Implementato"
- **Nuovo security fix** → Aggiornare checklist in "Security & GDPR"
- Aggiornare sempre `Last updated` e incrementare la versione in fondo al documento

---

## Known Issues & Debugging

### AuthManager - Property Names Corretti

| Corretto | Sbagliato |
|----------|-----------|
| `AuthManager.clientEndpoint` | `AuthManager.n8nEndpoint` |
| `AuthManager.getIdToken()` | `AuthManager.idToken` (accesso diretto) |
| `AuthManager.getWebhookUrl(path)` | Costruire URL manualmente |
| `AuthManager.getCentralizedApiUrl(path)` | Hardcodare URL main-n8n |

### Debug in Console
```javascript
// Verifica ruolo
console.log('Role:', AuthManager.userRole)
console.log('Is Admin:', AuthManager.isAdmin())
console.log('Company:', AuthManager.companyId)
console.log('Endpoint:', AuthManager.clientEndpoint)

// Verifica elementi admin
document.querySelectorAll('[data-role="admin"]').forEach(el => {
    console.log(el.tagName, el.style.display)
})
```

### Log da cercare in DevTools
- `[AuthManager] Token claims: {...}` - Claims estratti dal token
- `[AuthManager] updateUIForRole: {...}` - Ruolo applicato alla UI

### Security Gaps da Risolvere

1. **Support API** (`EmrSglbOTyyDDRCP`) - Validate Auth controlla solo presenza "Bearer", non valida il JWT
2. **Frontend API** (`G4CWLAYZUXDVdjxG`) - Validate Input è un Code node generico, non valida JWT
3. **Tutti i workflow** - Aggiungere audit logging per operazioni sensibili

---

## Roadmap

### Implementato
- Multi-page dashboard (8 pagine)
- Firebase Auth con RBAC (admin/user)
- Dashboard KPI con Chart.js (bar + pie chart)
- Knowledge base upload (PDF, DOCX, TXT, CSV, XLSX - max 10MB)
- RAG chat con vector similarity search (Gemini + pgvector)
- Selezione agente AI nel chat
- Upload file nel chat
- Rendering Markdown, LaTeX, syntax highlighting nel chat
- User management (admin only) con invito email
- Company management (admin only)
- Support ticket system con messaggistica e note interne
- Badge notifiche ticket non letti
- Cookie consent GDPR (CookieConsent.js)
- Esecuzione manuale workflow con parametri dinamici
- Filtro azienda per admin su tutte le pagine
- robots.txt (Disallow: /)

### In Sviluppo
- GDPR compliance assessment completo
- Security audit backend (JWT validation su tutti i workflow)
- Audit logging system

### Pianificato
- Real-time workflow status (polling/SSE)
- Export report Excel/PDF
- File preview in-browser
- Document versioning
- Monitoring & alerts (UptimeRobot)
- Backup & disaster recovery strategy

---

## Contacts & Resources

**n8n Instance:** https://main-n8n.axentia-automation.it
**Dashboard:** https://dash.axentia-automation.it
**n8n Docs:** https://docs.n8n.io
**pgvector:** https://github.com/pgvector/pgvector
**Gemini API:** https://ai.google.dev/docs

---

*Last updated: 2026-02-14*
*Document version: 3.0*
