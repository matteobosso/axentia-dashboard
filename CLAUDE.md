# Axentia Automation Dashboard

## Project Overview

**Project Name:** Axentia Automation Dashboard
**Type:** Multi-tenant dashboard for n8n automation management
**Owner:** Axentia Automation
**Status:** In development - pre-scaling phase

### Admin Account
- **Primary Admin Email:** info@axentia-automation.it
- Admin users have `role: 'admin'` in Firebase custom claims
- First admin must be set up manually in Firebase Console

### Tech Stack
- **Frontend:** Vanilla JavaScript (no frameworks/libraries)
- **Backend:** n8n workflow engine (no custom API server)
- **Database:** PostgreSQL 15+ with pgvector extension
- **Auth:** Cloudflare Access (admin) + Firebase Auth (clients)
- **Storage:** File system for PDF/DOCX knowledge base
- **AI/ML:** Google Gemini API for embeddings and LLM
- **Infrastructure:** Oracle Cloud Always Free tier
- **Hosting:** GitHub Pages (static frontend)

---

## Architecture

### Frontend Structure

Main files in project root:
- [dashboard.js](assets/js/dashboard.js) - Main dashboard logic
- [index.html](index.html) - Homepage/login
- [report.html](report.html) - Report visualization
- [conoscenza.html](conoscenza.html) - Knowledge base management
- [chat.html](chat.html) - AI chat interface
- [flussi.html](flussi.html) - n8n workflow management
- [supporto.html](supporto.html) - Support tickets
- [utenti.html](utenti.html) - User management (admin only)

**Frontend Constraints:**
- ✅ Vanilla JavaScript only
- ❌ NO React, Vue, Angular, Svelte, or other frameworks
- ✅ Use Fetch API for HTTP calls
- ✅ Native DOM manipulation
- ✅ Pure CSS or lightweight CSS frameworks (e.g., Tailwind CDN)

### Backend Architecture

**n8n Workflow Engine:**
- Main endpoint: `https://main-n8n.axentia-automation.it`
- All endpoints are n8n webhooks
- No custom server (Express, FastAPI, etc.)

**Key n8n Workflows:**
1. **API Gateway** - Routing and company_id filtering
2. **Knowledge Base Upload** (`/post_knowledge`) - PDF/DOCX processing
3. **Chat Agent** - RAG with vector similarity search
4. **User Management** - User CRUD operations
5. **Support API** - Ticket management
6. **Analytics** - Data aggregation and metrics

### Database Schema

**PostgreSQL with pgvector extension**

```sql
-- Table: companies
CREATE TABLE companies (
    company_id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(255) UNIQUE,
    n8n_endpoint VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Table: users
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    company_id UUID REFERENCES companies(company_id),
    n8n_endpoint VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login_at TIMESTAMP
);

-- Table: n8n_vectors (Vector Store for RAG)
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
    created_by UUID NOT NULL REFERENCES users(user_id),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX ON n8n_vectors USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_company_id ON users(company_id);
```

**Metadata Structure:**
```json
{
  "file_name": "client_contract_x.pdf",
  "workflow_id": "wf_12345",
  "upload_date": "2026-01-15T10:30:00Z",
  "company_id": "uuid-company-123",
  "page_number": 3,
  "chunk_index": 12
}
```

---

## Data Flow

### Knowledge Base Upload Flow
```
1. Client uploads PDF on dashboard (conoscenza.html)
   ↓
2. Frontend validates file (type, size)
   ↓
3. POST request → n8n webhook /post_knowledge
   ↓
4. n8n Workflow:
   - Read PDF/DOCX
   - Text extraction
   - Chunking (500 tokens, 50 token overlap)
   - Generate embeddings with Gemini API
   - Save to Postgres (n8n_vectors table)
   ↓
5. Response → Frontend (success/error)
```

### Chat RAG Flow
```
1. User sends query on chat.html
   ↓
2. POST → n8n webhook /chat
   ↓
3. n8n Workflow:
   - Generate query embedding (Gemini)
   - Vector similarity search on Postgres (pgvector)
   - Filter by company_id (multi-tenant isolation)
   - Retrieve top-K most relevant chunks
   - Build prompt with context
   - LLM call (Gemini)
   - Return response + sources
   ↓
4. Response → Frontend (show response + citations)
```

---

## Multi-tenant Architecture

### Isolation Strategy

**Principle:** Each client sees ONLY their own data

**Company ID Filtering:**
- Every request includes `company_id` (from session/localStorage)
- n8n workflows apply WHERE filter on ALL queries:
  ```sql
  SELECT * FROM n8n_vectors
  WHERE metadata->>'company_id' = $company_id
  ```

**Infrastructure:**
- **Current:** 1 n8n VM per client (compliant with n8n Community License)
- **Estimated limit:** ~5-10 clients per Oracle Free VM (2 OCPU, 12GB RAM)
- **Scalability:** Automatic provisioning of new VMs when needed

**Session Management:**
- `company_id` saved in `localStorage` after login
- Validated server-side on every request
- JWT token (Firebase Auth) includes `company_id` in claims

### Security Concerns to Verify
⚠️ **CRITICAL:** Verify that ALL n8n workflows apply company_id filtering
⚠️ **CRITICAL:** Prevent data leakage in vector store
⚠️ **CRITICAL:** Validate company_id server-side (don't trust the client)

---

## Security & Compliance

### GDPR Compliance Requirements

**Data Processing:**
- [ ] Explicit consent for file uploads?
- [ ] Clear privacy policy
- [ ] Cookie policy (if applicable)

**User Rights:**
- [ ] Right to deletion (Art. 17) - how to delete data + embeddings?
- [ ] Right to access (Art. 15) - export user data
- [ ] Data portability (Art. 20)

**Data Retention:**
- [ ] Retention policy: how long to keep files/embeddings?
- [ ] Auto-deletion after N days?

**Cross-border Transfer:**
- [ ] Gemini API (Google US) - Transfer Impact Assessment needed?
- [ ] Standard Contractual Clauses (SCC)?

**PII Handling:**
- [ ] PII tracking (Personally Identifiable Information)
- [ ] Anonymization/pseudonymization
- [ ] Encryption at rest and in transit

### Security Checklist

**Frontend:**
- [x] XSS prevention - user input sanitization (SecurityUtils)
- [ ] CSRF protection - token validation
- [ ] Content Security Policy (CSP) headers
- [x] Client-side input validation (file size, type, etc.)

**Backend (n8n workflows):**
- [x] SQL Injection - prepared statements in Postgres nodes
- [ ] File upload validation - magic number check, not just extension
- [ ] Rate limiting - abuse protection
- [ ] ⚠️ **CRITICAL:** JWT validation in Users API (currently only checks "Bearer " prefix)
- [ ] ⚠️ **CRITICAL:** Admin role check in Manage Users workflow
- [ ] ⚠️ **CRITICAL:** Company_id filtering in Users API (returns ALL users/companies)
- [ ] Webhook authentication - secret tokens configured
- [ ] Error handling - no sensitive info leak in errors

**API Security:**
- [ ] CORS properly configured for multi-tenant
- [ ] API keys in environment variables (NOT hardcoded)
- [ ] HTTPS only (no HTTP)
- [ ] Authentication on ALL endpoints

**Session Security:**
- [ ] Secure cookies (HttpOnly, Secure, SameSite)
- [ ] Session timeout configured
- [ ] Token refresh strategy (Firebase Auth)

---

## Deployment & Hosting

### GitHub Pages

**Hosting Platform:** GitHub Pages (https://pages.github.com)
**URL Pattern:** `https://{username}.github.io/{repo-name}/` or custom domain

#### GitHub Pages Advantages
- ✅ **Free** - 100% free tier, no cost
- ✅ **Automatic HTTPS** - SSL/TLS by default
- ✅ **Automatic deploy** - git push → auto-deploy
- ✅ **Custom domain** - custom domain support
- ✅ **Global CDN** - distributed worldwide hosting
- ✅ **Excellent uptime** - 99.9%+ GitHub SLA

#### GitHub Pages Limitations
- ⚠️ **Static only** - HTML/CSS/JS only (no PHP, Node, Python)
- ⚠️ **File limit:** 1GB repository size
- ⚠️ **Bandwidth limit:** 100GB/month (soft limit)
- ⚠️ **Build limit:** 10 builds/hour
- ⚠️ **No server-side processing** - all client-side

#### Architectural Implications

**1. All processing must be client-side or delegated to n8n:**
```javascript
// ❌ NOT POSSIBLE on GitHub Pages
app.post('/api/upload', (req, res) => { ... })

// ✅ CORRECT - call to n8n webhook
fetch('https://main-n8n.axentia-automation.it/webhook/upload', {
  method: 'POST',
  body: formData
})
```

**2. Environment Variables:**
- GitHub Pages does NOT support server-side `.env`
- Solutions:
  - Hardcode public URLs in code (OK for public endpoints)
  - Firebase Remote Config for dynamic values
  - Build-time substitution with GitHub Actions

**3. CORS Configuration:**
- n8n must have CORS configured to accept requests from GitHub Pages domain
- Whitelist origins: `https://{username}.github.io`

**4. File Upload Strategy:**
- Files CANNOT be saved on GitHub Pages (read-only)
- All files go directly to n8n webhook → backend storage
- n8n saves files on Oracle Cloud VM or external storage (S3-compatible)

#### Deployment Workflow

**Initial Setup:**
```bash
# 1. Create GitHub repository (if not exists)
git remote add origin https://github.com/{username}/axentia-dashboard.git

# 2. Configure GitHub Pages
# Settings → Pages → Source: main branch / root (or /docs)

# 3. (Optional) Custom domain
# Settings → Pages → Custom domain: dashboard.axentia-automation.it
# Add DNS CNAME record: dashboard → {username}.github.io
```

**Deploy Process:**
```bash
# Every push to main branch auto-deploys
git add .
git commit -m "Update dashboard"
git push origin main

# GitHub Pages rebuilds automatically (1-2 minutes)
```

#### Security Considerations

**GitHub Pages is public:**
- ⚠️ **Never** commit API keys, secrets, passwords
- ⚠️ Use `.gitignore` for sensitive files
- ⚠️ File `.mcp.json` (with n8n API key) **MUST** be in `.gitignore`
- ✅ API keys only in environment variables (n8n side) or Firebase Remote Config

**Client-side Security:**
- ✅ Input validation always client-side (before sending to n8n)
- ✅ XSS sanitization on dynamic content
- ✅ CSP headers (configurable via meta tag)
- ✅ No hardcoded credentials in JavaScript

**CORS & API Security:**
```javascript
// n8n webhook should verify origin
if (request.headers.origin !== 'https://{username}.github.io') {
  return { error: 'Unauthorized origin' }
}
```

#### Local Testing

Before deploy, test locally with:
```bash
# Option 1: Python SimpleHTTPServer
python -m http.server 8000
# Open http://localhost:8000

# Option 2: VS Code Live Server extension
# Right-click on index.html → "Open with Live Server"

# Option 3: Node http-server
npx http-server -p 8000
```

---

## Development Constraints

### Hard Constraints
- ✅ **Frontend:** Vanilla JS only (no frameworks)
- ✅ **Backend:** n8n workflows only (no custom API server)
- ✅ **Hosting:** GitHub Pages (static hosting only)
- ✅ **Budget:** €0 (free tier services only)
- ✅ **Infrastructure:** Oracle Cloud Always Free tier (for n8n + DB)
- ✅ **License:** n8n Community Edition (1 VM = 1 client)

### Preferred Tools (Free Tier)
- **Database:** PostgreSQL (Oracle Cloud)
- **Vector DB:** pgvector extension (avoids Pinecone/Weaviate costs)
- **AI API:** Google Gemini API (generous free tier)
- **Auth:** Firebase Auth (free tier: 10k MAU)
- **CDN:** Cloudflare (free tier)
- **Monitoring:** Grafana Cloud (free tier) or UptimeRobot

---

## n8n Workflow Best Practices

### Naming Convention
- Format: `[<Area>] <Workflow Name>`
- Add a tag indicating the workflow type
- Examples:
  - `[Dashboard] User Management API` + tag: `api`
  - `[Support] Ticket Handler` + tag: `webhook`
  - `[Analytics] Daily Report Generator` + tag: `scheduled`
  - `[Knowledge] Document Processor` + tag: `processor`

### IMPORTANT: Use Explicit Nodes, Not Code Nodes

When creating n8n workflows, prefer explicit nodes over Code nodes:

✅ **DO:**
- Use Switch node for routing by action
- Use Postgres node for database queries
- Use HTTP Request node for API calls
- Use IF node for conditional logic
- Use Set node for data transformation
- Use Respond to Webhook node for responses

❌ **DON'T:**
- Use a single Code node to handle all routing logic
- Embed SQL queries in JavaScript code
- Use Code node when a native node exists

**Reasons:**
1. Explicit nodes are easier to debug visually
2. Native nodes have built-in error handling
3. Workflow structure is self-documenting
4. Better compatibility with n8n updates

**Example - Correct Approach:**
```
[Webhook] → [Switch: action]
    ├── "list_users" → [Postgres: SELECT users] → [Respond]
    ├── "create_user" → [IF: validate] → [Postgres: INSERT] → [Respond]
    ├── "update_user" → [Postgres: UPDATE] → [Respond]
    └── fallback → [Respond: Error 400]
```

### Use MCP Tools & Skills

Always use the appropriate n8n skills when building workflows:
- **n8n-mcp-tools-expert** - For tool selection and workflow management
- **n8n-node-configuration** - For understanding node parameters
- **n8n-workflow-patterns** - For architectural patterns
- **n8n-validation-expert** - For validating configurations
- **n8n-expression-syntax** - For writing expressions
- **n8n-code-javascript** / **n8n-code-python** - Only when Code node is truly necessary

---

## MCP Tools & Skills

### n8n-mcp Server
**Configuration:** [.mcp.json](.mcp.json)
**Endpoint:** https://main-n8n.axentia-automation.it
**Capabilities:**
- Read existing workflows
- Modify workflows (with caution!)
- Execute workflows
- Analyze node structure

### n8n-skills (7 skills installed)
1. **n8n-mcp-tools-expert** ⭐ (highest priority)
2. **n8n-expression-syntax** - n8n expressions
3. **n8n-workflow-patterns** - Design patterns
4. **n8n-validation-expert** - Configuration validation
5. **n8n-node-configuration** - Node setup
6. **n8n-code-javascript** - JS Code node
7. **n8n-code-python** - Python Code node

**Recommended Usage:**
- Use skills for n8n best practices
- Validate workflows before deploy
- Verify security patterns in workflows

---

## Roadmap & Features

### ✅ Implemented
- Multi-page dashboard (index, report, conoscenza, chat, flussi, supporto, utenti)
- Knowledge base upload (PDF/DOCX)
- RAG chat with vector similarity search
- Cloudflare Access authentication (admin)
- PostgreSQL with pgvector
- Firebase Auth with RBAC
- User management (admin only)
- Support ticket system

### 🚧 In Development
- **GDPR compliance assessment** (HIGH PRIORITY)
- Complete security audit
- Backup & disaster recovery strategy
- Audit logging system

### 📋 Planned

**1. Real-time Workflow Status**
- Polling vs WebSocket vs Server-Sent Events?
- Optimal polling frequency: 5-10s?
- Live n8n workflow status dashboard

**2. Advanced Analytics Dashboard**
- Time-series metrics (InfluxDB? TimescaleDB?)
- Interactive charts (Chart.js? D3.js?)
- Excel/PDF report export

**3. File Management UI**
- In-browser PDF preview
- Document versioning (v1, v2, v3)
- Bulk upload (multiple drag & drop)
- File compression pre-upload

**4. Monitoring & Alerts**
- n8n health check endpoint
- Uptime monitoring (UptimeRobot)
- Email/Telegram alerts on failures
- Usage metrics dashboard

---

## Current Issues to Address

### 🔴 Critical Priority
1. **GDPR Compliance Audit**
   - Verify consent management
   - Implement right to deletion
   - Data retention policy
   - Cross-border transfer assessment

2. **Security Vulnerabilities**
   - SQL injection in Postgres workflows
   - Robust file upload validation
   - Session hijacking prevention

3. **Multi-tenant Data Isolation**
   - Audit company_id filters in ALL workflows
   - Test vector store data leakage
   - Server-side company_id validation

### 🟡 High Priority
4. **Backup & Disaster Recovery**
   - Automatic Postgres backup (Oracle Cloud)
   - Test restore procedure
   - RPO/RTO target: 24h / 4h?
   - Backup embeddings (expensive to regenerate)

5. **Audit Logging**
   - Log user actions (who, what, when)
   - Log unauthorized access attempts
   - Log retention: 90 days? 1 year?
   - ISO 27001 / SOC 2 compliance

### 🟢 Medium Priority
6. **Performance Optimization**
   - Caching (Redis? localStorage?)
   - Vector index optimization (HNSW vs IVFFlat)
   - Lazy loading for long lists
   - CDN for static assets

7. **Scalability Planning**
   - Client limit per VM (stress test)
   - Database sharding strategy
   - Alternative vector store (Pinecone/Weaviate) when?

---

## Useful Commands

### n8n API (with API key)
```bash
# List workflows
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://main-n8n.axentia-automation.it/api/v1/workflows

# Get workflow by ID
curl -H "X-N8N-API-KEY: $N8N_API_KEY" \
  https://main-n8n.axentia-automation.it/api/v1/workflows/{id}

# Execute workflow
curl -X POST -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"param": "value"}' \
  https://main-n8n.axentia-automation.it/api/v1/workflows/{id}/execute
```

### PostgreSQL (example queries)
```sql
-- Check vector store size
SELECT COUNT(*),
       pg_size_pretty(pg_total_relation_size('n8n_vectors')) as size
FROM n8n_vectors;

-- Check company_id distribution
SELECT metadata->>'company_id' as company, COUNT(*)
FROM n8n_vectors
GROUP BY company;

-- Vector similarity search (example)
SELECT text, metadata,
       1 - (embedding <=> '[0.1, 0.2, ...]'::vector) AS similarity
FROM n8n_vectors
WHERE metadata->>'company_id' = 'uuid-123'
ORDER BY embedding <=> '[0.1, 0.2, ...]'::vector
LIMIT 5;
```

---

## Notes for Claude

### When Working on This Project
1. **Always respect frontend constraint:** Vanilla JS only, no frameworks
2. **Always respect backend constraint:** n8n workflows only, no custom API
3. **Always respect hosting constraint:** GitHub Pages static only - no server-side code
4. **Always consider multi-tenant isolation:** company_id filtering everywhere
5. **Always check security:** XSS, injection, file validation, no secrets in code
6. **Always consider GDPR:** consent, deletion, retention, PII
7. **Always use explicit n8n nodes:** Prefer native nodes over Code nodes

### GitHub Pages Important Notes
⚠️ **Repository is PUBLIC** - Never commit:
- API keys, tokens, secrets
- `.mcp.json` (contains n8n API key)
- `.env` files with credentials
- Customer data or PII

✅ **Always remember:**
- All processing must be client-side OR via n8n webhooks
- File uploads go directly to n8n (not saved on GitHub Pages)
- CORS must be configured on n8n side
- Test locally before git push (auto-deploys to production)

### Before Modifying n8n Workflows
⚠️ **NEVER edit production workflows directly**
- Always test in development environment first
- Use n8n-skills for best practices validation
- Backup workflow JSON before modifying
- Test with mock data, not real customer data

### Code Style Preferences
- **JavaScript:** ES6+ syntax, async/await (not .then() chains)
- **Comments:** Only where logic isn't self-evident (no over-commenting)
- **Error handling:** Try-catch for async operations, user-friendly messages
- **Variable naming:** camelCase, descriptive (no obscure abbreviations)

---

## Known Issues & Debugging

### AuthManager Property Names
⚠️ **IMPORTANT:** Use correct property names when accessing AuthManager:

| Correct | Incorrect |
|---------|-----------|
| `AuthManager.clientEndpoint` | `AuthManager.n8nEndpoint` |
| `AuthManager.getIdToken()` | `AuthManager.idToken` (direct access) |
| `AuthManager.getWebhookUrl(path)` | Building URLs manually |

### Firebase Custom Claims Structure
Custom claims are stored in `tokenResult.claims` and include:
```json
{
  "role": "admin|user",
  "company_id": "uuid-string or null",
  "n8n_endpoint": "https://main-n8n.axentia-automation.it"
}
```

**Admin user (info@axentia-automation.it):**
```json
{
  "role": "admin",
  "company_id": null,
  "n8n_endpoint": "https://main-n8n.axentia-automation.it"
}
```

**Regular user:**
```json
{
  "role": "user",
  "company_id": "<company-uuid>",
  "n8n_endpoint": "https://main-n8n.axentia-automation.it"
}
```

### Debug Role Detection
Open browser DevTools Console and look for:
- `[AuthManager] Token claims: {...}` - Shows extracted claims from Firebase
- `[AuthManager] updateUIForRole: {...}` - Shows role being applied to UI

**Manual debugging in console:**
```javascript
// Check current role
console.log('Role:', AuthManager.userRole);
console.log('Is Admin:', AuthManager.isAdmin());

// Check admin elements
document.querySelectorAll('[data-role="admin"]').forEach(el => {
    console.log(el.tagName, el.style.display, el.textContent.substring(0, 50));
});
```

### Backend Security Gaps (To Address)
⚠️ **CRITICAL:** The following n8n workflows need security improvements:

1. **[Service] Users API** (`yUGfj1SPnlV5ghc3`)
   - [ ] Add Firebase JWT validation (not just "Bearer " prefix check)
   - [ ] Add admin role check before returning user/company lists
   - [ ] Filter users by company_id for non-admin requests

2. **[Dashboard] Manage Users** (`gp4LSpM60id6cRt2`)
   - [ ] Add authentication to webhook
   - [ ] Add admin role verification before CRUD operations
   - [ ] Return 401/403 for unauthorized requests

3. **[Dashboard] Manage Companies** (`NWl8vhus7fvuOD2K`)
   - [ ] Add authentication and admin role check

4. **All Workflows**
   - [ ] Validate company_id server-side (don't trust client)
   - [ ] Add audit logging for sensitive operations

---

## Contacts & Resources

**n8n Instance:** https://main-n8n.axentia-automation.it
**Documentation:** https://docs.n8n.io
**pgvector Docs:** https://github.com/pgvector/pgvector
**Gemini API:** https://ai.google.dev/docs

**Issue Tracking:** TBD (GitHub Issues?)
**Team Chat:** TBD (Slack? Discord?)

---

*Last updated: 2026-02-05*
*Document version: 2.1*
