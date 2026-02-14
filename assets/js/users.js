/**
 * User Management for Axentia Dashboard
 * Admin-only functionality for managing users
 */

/**
 * Helper functions for modal feedback
 */
function showModalFeedback(feedbackId, message, type = 'success') {
    const feedbackEl = document.getElementById(feedbackId);
    if (!feedbackEl) return;

    feedbackEl.className = `feedback-message ${type}`;
    feedbackEl.textContent = message;
    feedbackEl.style.display = 'block';

    // Auto-hide success messages after 4 seconds
    if (type === 'success') {
        setTimeout(() => hideModalFeedback(feedbackId), 4000);
    }
}

function hideModalFeedback(feedbackId) {
    const feedbackEl = document.getElementById(feedbackId);
    if (feedbackEl) {
        feedbackEl.style.display = 'none';
    }
}

/**
 * Show global toast notification
 */
function showToast(message, type = 'success') {
    // Create or reuse toast element
    let toast = document.getElementById('globalToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'globalToast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 350px;
            padding: 15px 20px;
            border-radius: 4px;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: opacity 0.3s, transform 0.3s;
            opacity: 0;
            transform: translateY(-10px);
        `;
        document.body.appendChild(toast);
    }

    // Set message and style
    toast.className = `feedback-message ${type}`;
    toast.textContent = message;
    toast.style.display = 'block';

    // Trigger animation
    setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    }, 10);

    // Auto-hide after 4 seconds
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 4000);
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        obj.textContent = value.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

const UsersManager = {
    users: [],
    companies: [],
    filters: {
        search: '',
        role: '',
        status: ''
    },

    /**
     * Initialize users page
     */
    init: async function() {
        // Attendi che AuthManager sia pronto (usando la Promise)
        const isAuthenticated = await AuthManager.waitForAuth();

        if (!isAuthenticated) {
            this.showAccessDenied();
            return;
        }

        // Controllo ruolo admin dopo aver garantito l'auth
        if (!AuthManager.isAdmin()) {
            this.showAccessDenied();
            return;
        }

        this.showAdminContent();
        this.setupEventListeners();
        
        // Ora siamo sicuri che token e URL saranno disponibili
        this.loadCompanies();
        this.loadUsers();
    },

    initAfterAuth: function() {
        // Check admin access
        if (!AuthManager.isAdmin()) {
            this.showAccessDenied();
            return;
        }

        this.showAdminContent();
        this.setupEventListeners();
        this.loadCompanies();
        this.loadUsers();
    },

    /**
     * Show access denied message
     */
    showAccessDenied: function() {
        const accessDenied = document.getElementById('accessDenied');
        const adminContent = document.getElementById('adminContent');

        if (accessDenied) accessDenied.style.display = 'block';
        if (adminContent) adminContent.style.display = 'none';
    },

    /**
     * Show admin content
     */
    showAdminContent: function() {
        const accessDenied = document.getElementById('accessDenied');
        const adminContent = document.getElementById('adminContent');

        if (accessDenied) accessDenied.style.display = 'none';
        if (adminContent) adminContent.style.display = 'block';
    },

    /**
     * Setup event listeners
     */
    setupEventListeners: function() {
        // Filter listeners
        const filterSearch = document.getElementById('filterSearch');
        const filterRole = document.getElementById('filterRole');
        const filterStatus = document.getElementById('filterStatus');
        const btnReset = document.getElementById('btnReset');

        if (filterSearch) {
            filterSearch.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.renderUsers();
                this.updateResetButton();
            });
        }

        if (filterRole) {
            filterRole.addEventListener('change', (e) => {
                this.filters.role = e.target.value;
                this.renderUsers();
                this.updateResetButton();
            });
        }

        if (filterStatus) {
            filterStatus.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.renderUsers();
                this.updateResetButton();
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', () => this.resetFilters());
        }

        // Listen for company filter changes from AuthManager
        window.addEventListener('companyFilterChanged', () => {
            this.renderUsers();
            this.updateResetButton();
        });

        // Invite form
        const inviteForm = document.getElementById('inviteForm');
        if (inviteForm) {
            inviteForm.addEventListener('submit', (e) => this.handleInvite(e));
        }

        // Edit form
        const editForm = document.getElementById('editUserForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.handleEdit(e));
        }

        // Company filter change
        window.addEventListener('companyFilterChanged', () => this.loadUsers());
    },

    /**
     * Update reset button visibility
     */
    updateResetButton: function() {
        const btnReset = document.getElementById('btnReset');
        if (btnReset) {
            const hasFilters = this.filters.search || this.filters.role || this.filters.status;
            btnReset.style.display = hasFilters ? '' : 'none';
        }
    },

    /**
     * Reset all filters
     */
    resetFilters: function() {
        this.filters = { search: '', role: '', status: '' };

        const filterSearch = document.getElementById('filterSearch');
        const filterRole = document.getElementById('filterRole');
        const filterStatus = document.getElementById('filterStatus');

        if (filterSearch) filterSearch.value = '';
        if (filterRole) filterRole.value = '';
        if (filterStatus) filterStatus.value = '';

        this.renderUsers();
        this.updateResetButton();
    },

    /**
     * Load companies for dropdowns
     * Reuses AuthManager.allCompanies if already loaded to reduce API calls
     */
    loadCompanies: async function() {
        try {
            // First check if AuthManager already has companies loaded
            if (typeof AuthManager !== 'undefined' && AuthManager.allCompanies && AuthManager.allCompanies.length > 0) {
                console.log('[UsersManager] Using companies from AuthManager cache');
                this.companies = AuthManager.allCompanies;
                this.populateCompanyDropdowns();
                if (this.updateStats) this.updateStats();
                return;
            }

            const token = await AuthManager.getIdToken();

            // Usa il metodo centralizzato per ottenere l'URL corretto
            const url = AuthManager.getCentralizedApiUrl('user-management');

            if (!token || !url) {
                console.error("Dati Auth o URL mancanti durante loadCompanies");
                return;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'list_companies' })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            this.companies = data.companies || [];
            this.populateCompanyDropdowns();

            // Sync with AuthManager for consistent company names across the app
            if (typeof AuthManager !== 'undefined') {
                AuthManager.allCompanies = this.companies;
                sessionStorage.setItem('admin_companies', JSON.stringify(this.companies));
            }

            // Aggiorna le statistiche se il metodo esiste
            if (this.updateStats) this.updateStats();

        } catch (error) {
            console.error('Errore caricamento aziende:', error);
        }
    },

    /**
     * Populate company dropdowns in modals
     */
    populateCompanyDropdowns: function() {
        const inviteSelect = document.getElementById('inviteCompanySelect');
        const editSelect = document.getElementById('editCompanySelect');

        const options = this.companies.map(company =>
            `<option value="${SecurityUtils.escapeAttribute(company.company_id)}">${SecurityUtils.escapeHtml(company.name)}</option>`
        ).join('');

        if (inviteSelect) {
            inviteSelect.innerHTML = '<option value="">Seleziona azienda...</option>' + options;
        }

        if (editSelect) {
            editSelect.innerHTML = '<option value="">Seleziona azienda...</option>' + options;
        }
    },

    /**
     * Load users from API
     */
    loadUsers: async function() {
        const tableBody = document.getElementById('usersTableBody');
        if (!tableBody) return;

        try {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;">Caricamento...</td></tr>';

            const token = await AuthManager.getIdToken();
            const url = AuthManager.getCentralizedApiUrl('user-management');

            if (!token || !url) {
                console.error("Impossibile caricare utenti: Auth incompleta.");
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Errore Auth</td></tr>';
                return;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'list_users' })
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const data = await response.json();
            this.users = data.users || [];
            console.log('[UsersManager] Utenti caricati:', this.users);
            this.renderUsers();
            this.updateStats();

        } catch (error) {
            console.error('Errore caricamento utenti:', error);
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; color:red;">Errore: ${error.message}</td></tr>`;
        }
    },

    /**
     * Render users table
     */
    renderUsers: function() {
        const tableBody = document.getElementById('usersTableBody');
        if (!tableBody) return;

        // Apply filters
        const filteredUsers = this.users.filter(user => {
            // Filter by selected company (admin feature)
            if (AuthManager.selectedCompanyId && user.company_id !== AuthManager.selectedCompanyId) {
                return false;
            }
            if (this.filters.search) {
                const searchTerm = this.filters.search;
                const matchesEmail = user.email?.toLowerCase().includes(searchTerm);
                const matchesName = user.display_name?.toLowerCase().includes(searchTerm);
                const matchesCompany = user.company_name?.toLowerCase().includes(searchTerm);
                if (!matchesEmail && !matchesName && !matchesCompany) return false;
            }
            if (this.filters.role && user.role !== this.filters.role) return false;
            if (this.filters.status) {
                const isActive = user.is_active !== false;
                if (this.filters.status === 'active' && !isActive) return false;
                if (this.filters.status === 'inactive' && isActive) return false;
            }
            return true;
        });

        if (filteredUsers.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #666;">
                        ${this.users.length === 0 ? 'Nessun utente trovato.' : 'Nessun utente corrisponde ai filtri.'}
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filteredUsers.map(user => {
            const roleBadge = this.getRoleBadge(user.role);
            const statusBadge = this.getStatusBadge(user.is_active);
            const lastLogin = user.last_login_at
                ? new Date(user.last_login_at).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })
                : 'Mai';

            return `
                <tr>
                    <td>${SecurityUtils.escapeHtml(user.email)}</td>
                    <td>${SecurityUtils.escapeHtml(user.display_name || '-')}</td>
                    <td>${SecurityUtils.escapeHtml(AuthManager.getCompanyName(user.company_id) || '-')}</td>
                    <td>${roleBadge}</td>
                    <td>${statusBadge}</td>
                    <td>${lastLogin}</td>
                    <td style="text-align: right;">
                        <button class="btn-action" onclick="UsersManager.editUser('${SecurityUtils.escapeAttribute(user.user_id)}')" title="Modifica">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-action btn-danger" onclick="UsersManager.confirmDeleteUser('${SecurityUtils.escapeAttribute(user.user_id)}', '${SecurityUtils.escapeAttribute(user.email)}')" title="Elimina" style="margin-left: 0.5rem;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    /**
     * Get role badge HTML
     */
    getRoleBadge: function(role) {
        const labels = {
            admin: 'Admin',
            user: 'Utente'
        };
        const classes = {
            admin: 'role-admin',
            user: 'role-user'
        };
        return `<span class="role-badge ${classes[role] || ''}">${labels[role] || role}</span>`;
    },

    /**
     * Get status badge HTML
     */
    getStatusBadge: function(isActive) {
        if (isActive === false) {
            return '<span class="status-badge status-inactive">Disattivato</span>';
        }
        return '<span class="status-badge status-active">Attivo</span>';
    },

    /**
     * Update stats cards
     */
    
    updateStats: function() {
        const totalEl = document.getElementById('statTotalUsers');
        const companiesEl = document.getElementById('statCompanies');

        if (totalEl) {
            const currentTotal = parseInt(totalEl.textContent) || 0;
            // Chiama la funzione locale
            animateValue('statTotalUsers', currentTotal, this.users.length, 300);
        }
        
        if (companiesEl) {
            const currentCompanies = parseInt(companiesEl.textContent) || 0;
            animateValue('statCompanies', currentCompanies, this.companies.length, 300);
        }
    },

    /**
     * Handle invite user form submission
     */
    handleInvite: async function(event) {
        event.preventDefault();

        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Invio in corso...';

        try {
            const formData = new FormData(form);
            const email = formData.get('email');
            const displayName = formData.get('display_name');
            const companyId = formData.get('company_id');
            const role = formData.get('role');

            // Validate inputs
            if (!SecurityUtils.validators.email(email)) {
                throw new Error('Email non valida');
            }

            if (!companyId) {
                throw new Error('Seleziona un\'azienda');
            }

            if (!SecurityUtils.validators.role(role)) {
                throw new Error('Ruolo non valido');
            }

            if (displayName && !SecurityUtils.validators.displayName(displayName)) {
                throw new Error('Nome non valido (usa solo lettere, spazi e trattini)');
            }

            const token = await AuthManager.getIdToken();

            // n8n_endpoint is derived from company_id on the server side
            const requestBody = {
                action: 'create_user',
                email: email,
                company_id: companyId,
                role: role
            };

            if (displayName) {
                requestBody.display_name = displayName;
            }

            // User Management API is centralized on main-n8n
            const response = await fetch(AuthManager.getCentralizedApiUrl('user-management'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            // Success
            form.reset();
            this.loadUsers();
            showModalFeedback('inviteFeedback', 'Invito inviato con successo! L\'utente riceverà un\'email per impostare la password.', 'success');
            setTimeout(() => closeInviteModal(), 2000);

        } catch (error) {
            console.error('Error inviting user:', error);
            showModalFeedback('inviteFeedback', 'Errore: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    },

    /**
     * Open edit modal with user data
     */
    editUser: function(userId) {
        const user = this.users.find(u => u.user_id === userId);
        if (!user) return;

        const modal = document.getElementById('editUserModal');
        if (!modal) return;

        // Populate form fields
        document.getElementById('editUserId').value = user.user_id;
        document.getElementById('editUserEmail').value = user.email || '';
        document.getElementById('editUserName').value = user.display_name || '';
        document.getElementById('editCompanySelect').value = user.company_id || '';
        document.getElementById('editUserRole').value = user.role || 'user';
        document.getElementById('editUserStatus').value = user.is_active !== false ? 'true' : 'false';

        modal.style.display = 'flex';
    },

    /**
     * Handle edit user form submission
     */
    handleEdit: async function(event) {
        event.preventDefault();

        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvataggio...';

        try {
            const formData = new FormData(form);
            const userId = formData.get('user_id');
            const displayName = formData.get('display_name');
            const companyId = formData.get('company_id');
            const role = formData.get('role');
            const isActive = formData.get('is_active') === 'true';

            // Validate inputs
            if (!SecurityUtils.validators.role(role)) {
                throw new Error('Ruolo non valido');
            }

            if (displayName && !SecurityUtils.validators.displayName(displayName)) {
                throw new Error('Nome non valido');
            }

            const token = await AuthManager.getIdToken();

            // n8n_endpoint is derived from company_id on the server side
            const requestBody = {
                action: 'update_user',
                user_id: userId,
                display_name: displayName || null,
                company_id: companyId || null,
                role: role,
                is_active: isActive
            };

            // User Management API is centralized on main-n8n
            const response = await fetch(AuthManager.getCentralizedApiUrl('user-management'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            // Success
            this.loadUsers();
            showModalFeedback('editUserFeedback', 'Utente aggiornato con successo!', 'success');
            setTimeout(() => closeEditModal(), 2000);

        } catch (error) {
            console.error('Error updating user:', error);
            showModalFeedback('editUserFeedback', 'Errore: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
};

/**
 * Companies Manager for company CRUD operations
 */
const CompaniesManager = {
    companies: [],
    filters: {
        search: ''
    },

    init: async function() {
        // 1. Aspetta che AuthManager abbia finito di caricare
        const isAuthenticated = await AuthManager.waitForAuth();

        // 2. Se non è loggato o non è admin, fermati
        if (!isAuthenticated || !AuthManager.isAdmin()) {
            return; 
        }

        // 3. Ora è sicuro procedere
        this.setupEventListeners();
        this.loadCompanies();
    },

    setupEventListeners: function() {
        const filterSearch = document.getElementById('filterCompanySearch');
        const btnReset = document.getElementById('btnResetCompanies');

        if (filterSearch) {
            filterSearch.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.renderCompanies();
                this.updateResetButton();
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', () => this.resetFilters());
        }

        // Form listeners
        const createForm = document.getElementById('createCompanyForm');
        if (createForm) {
            createForm.addEventListener('submit', (e) => this.handleCreate(e));
        }

        const editForm = document.getElementById('editCompanyForm');
        if (editForm) {
            editForm.addEventListener('submit', (e) => this.handleEdit(e));
        }
    },

    updateResetButton: function() {
        const btnReset = document.getElementById('btnResetCompanies');
        if (btnReset) {
            btnReset.style.display = this.filters.search ? '' : 'none';
        }
    },

    resetFilters: function() {
        this.filters.search = '';
        const filterSearch = document.getElementById('filterCompanySearch');
        if (filterSearch) filterSearch.value = '';
        this.renderCompanies();
        this.updateResetButton();
    },

    loadCompanies: async function() {
        const tableBody = document.getElementById('companiesTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">
                    Caricamento aziende...
                </td>
            </tr>
        `;

        try {
            // First check if AuthManager or UsersManager already has companies loaded
            if (typeof AuthManager !== 'undefined' && AuthManager.allCompanies && AuthManager.allCompanies.length > 0) {
                console.log('[CompaniesManager] Using companies from AuthManager cache');
                this.companies = AuthManager.allCompanies;
                this.renderCompanies();
                this.updateStats();
                return;
            }

            // 1. Ottieni token e URL in modo sicuro
            const token = await AuthManager.getIdToken();
            const url = AuthManager.getCentralizedApiUrl('user-management');

            // 2. Stop se mancano i dati fondamentali
            if (!token || !url) {
                console.warn("Auth non pronta per CompaniesManager");
                return;
            }

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action: 'list_companies' })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.companies = data.companies || [];

            // Sync with AuthManager
            if (typeof AuthManager !== 'undefined') {
                AuthManager.allCompanies = this.companies;
                sessionStorage.setItem('admin_companies', JSON.stringify(this.companies));
            }

            this.renderCompanies();
            this.updateStats();

        } catch (error) {
            console.error('Error loading companies:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #c00;">
                        Errore nel caricamento delle aziende.
                    </td>
                </tr>
            `;
        }
    },

    renderCompanies: function() {
        const tableBody = document.getElementById('companiesTableBody');
        if (!tableBody) return;

        const filtered = this.companies.filter(company => {
            if (this.filters.search) {
                const searchTerm = this.filters.search;
                const matchesName = company.name?.toLowerCase().includes(searchTerm);
                if (!matchesName) return false;
            }
            return true;
        });

        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">
                        ${this.companies.length === 0 ? 'Nessuna azienda registrata.' : 'Nessuna azienda corrisponde ai filtri.'}
                    </td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = filtered.map(company => {
            const createdAt = company.created_at
                ? new Date(company.created_at).toLocaleDateString('it-IT')
                : '-';

            return `
                <tr>
                    <td><strong>${SecurityUtils.escapeHtml(company.name)}</strong></td>
                    <td style="font-size: 0.85em; color: #666;">${SecurityUtils.escapeHtml(company.n8n_endpoint || '-')}</td>
                    <td>${createdAt}</td>
                    <td style="text-align: right;">
                        <button class="btn-action" onclick="CompaniesManager.editCompany('${SecurityUtils.escapeAttribute(company.company_id)}')" title="Modifica">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="btn-action btn-danger" onclick="CompaniesManager.confirmDeleteCompany('${SecurityUtils.escapeAttribute(company.company_id)}', '${SecurityUtils.escapeAttribute(company.name)}')" title="Elimina" style="margin-left: 0.5rem;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    updateStats: function() {
        const totalEl = document.getElementById('statTotalCompanies');
        if (totalEl) {
            totalEl.textContent = this.companies.length;
        }
        // Also update the companies count in the users tab
        const companiesEl = document.getElementById('statCompanies');
        if (companiesEl) {
            companiesEl.textContent = this.companies.length;
        }
    },

    handleCreate: async function(event) {
        event.preventDefault();

        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Creazione...';

        try {
            const formData = new FormData(form);
            const name = formData.get('name');
            const n8nEndpoint = formData.get('n8n_endpoint');

            if (!name || name.trim() === '') {
                throw new Error('Il nome azienda è obbligatorio');
            }

            const token = await AuthManager.getIdToken();

            const requestBody = {
                action: 'create_company',
                name: name.trim()
            };

            if (n8nEndpoint) requestBody.n8n_endpoint = n8nEndpoint.trim();

            // User Management API is centralized on main-n8n
            const response = await fetch(AuthManager.getCentralizedApiUrl('user-management'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            form.reset();
            this.loadCompanies();
            // Also reload companies in UsersManager for dropdowns
            UsersManager.loadCompanies();
            showModalFeedback('createCompanyFeedback', 'Azienda creata con successo!', 'success');
            setTimeout(() => closeCreateCompanyModal(), 2000);

        } catch (error) {
            console.error('Error creating company:', error);
            showModalFeedback('createCompanyFeedback', 'Errore: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    },

    editCompany: function(companyId) {
        const company = this.companies.find(c => c.company_id === companyId);
        if (!company) return;

        const modal = document.getElementById('editCompanyModal');
        if (!modal) return;

        document.getElementById('editCompanyId').value = company.company_id;
        document.getElementById('editCompanyName').value = company.name || '';
        document.getElementById('editCompanyEndpoint').value = company.n8n_endpoint || '';

        modal.style.display = 'flex';
    },

    handleEdit: async function(event) {
        event.preventDefault();

        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Salvataggio...';

        try {
            const formData = new FormData(form);
            const companyId = formData.get('company_id');
            const name = formData.get('name');
            const n8nEndpoint = formData.get('n8n_endpoint');

            if (!name || name.trim() === '') {
                throw new Error('Il nome azienda è obbligatorio');
            }

            const token = await AuthManager.getIdToken();

            const requestBody = {
                action: 'update_company',
                company_id: companyId,
                name: name.trim(),
                n8n_endpoint: n8nEndpoint ? n8nEndpoint.trim() : null
            };

            // User Management API is centralized on main-n8n
            const response = await fetch(AuthManager.getCentralizedApiUrl('user-management'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            this.loadCompanies();
            UsersManager.loadCompanies();
            showModalFeedback('editCompanyFeedback', 'Azienda aggiornata con successo!', 'success');
            setTimeout(() => closeEditCompanyModal(), 2000);

        } catch (error) {
            console.error('Error updating company:', error);
            showModalFeedback('editCompanyFeedback', 'Errore: ' + error.message, 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    },

    confirmDeleteCompany: function(companyId, companyName) {
        document.getElementById('deleteTargetId').value = companyId;
        document.getElementById('deleteTargetType').value = 'company';
        document.getElementById('deleteConfirmTitle').textContent = 'Elimina Azienda';
        document.getElementById('deleteConfirmMessage').innerHTML = `Sei sicuro di voler eliminare <strong>${SecurityUtils.escapeHtml(companyName)}</strong>?<br><small style="color: #c00;">Questa azione è irreversibile.</small>`;
        document.getElementById('deleteConfirmModal').style.display = 'flex';
    },

    deleteCompany: async function(companyId) {
        try {
            const token = await AuthManager.getIdToken();

            // User Management API is centralized on main-n8n
            const response = await fetch(AuthManager.getCentralizedApiUrl('user-management'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'delete_company',
                    company_id: companyId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            this.loadCompanies();
            UsersManager.loadCompanies();
            showToast('Azienda eliminata con successo!', 'success');

        } catch (error) {
            console.error('Error deleting company:', error);
            showToast('Errore: ' + error.message, 'error');
        }
    }
};

// Tab switching
function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const isActive = btn.getAttribute('data-tab') === tabName;
        btn.classList.toggle('active', isActive);
        btn.style.color = isActive ? '#ff524f' : '#666';
        btn.style.borderBottomColor = isActive ? '#ff524f' : 'transparent';
    });

    // Update tab content
    document.getElementById('usersTab').style.display = tabName === 'users' ? 'block' : 'none';
    document.getElementById('companiesTab').style.display = tabName === 'companies' ? 'block' : 'none';

    // Load companies data if switching to companies tab
    if (tabName === 'companies' && CompaniesManager.companies.length === 0) {
        CompaniesManager.loadCompanies();
    }
}

// Delete user functionality
UsersManager.confirmDeleteUser = function(userId, userEmail) {
    document.getElementById('deleteTargetId').value = userId;
    document.getElementById('deleteTargetType').value = 'user';
    document.getElementById('deleteConfirmTitle').textContent = 'Elimina Utente';
    document.getElementById('deleteConfirmMessage').innerHTML = `Sei sicuro di voler eliminare <strong>${SecurityUtils.escapeHtml(userEmail)}</strong>?<br><small style="color: #c00;">L'utente non potrà più accedere al sistema.</small>`;
    document.getElementById('deleteConfirmModal').style.display = 'flex';
};

UsersManager.deleteUser = async function(userId) {
    try {
        const token = await AuthManager.getIdToken();

        // User Management API is centralized on main-n8n
        const response = await fetch(AuthManager.getCentralizedApiUrl('user-management'), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                action: 'delete_user',
                user_id: userId
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        this.loadUsers();
        showToast('Utente eliminato con successo!', 'success');

    } catch (error) {
        console.error('Error deleting user:', error);
        showToast('Errore: ' + error.message, 'error');
    }
};

// Confirm delete handler
function confirmDelete() {
    const targetId = document.getElementById('deleteTargetId').value;
    const targetType = document.getElementById('deleteTargetType').value;

    closeDeleteConfirmModal();

    if (targetType === 'user') {
        UsersManager.deleteUser(targetId);
    } else if (targetType === 'company') {
        CompaniesManager.deleteCompany(targetId);
    }
}

// Modal functions (global scope for onclick handlers)
function openInviteModal() {
    const modal = document.getElementById('inviteModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeInviteModal() {
    const modal = document.getElementById('inviteModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function closeEditModal() {
    const modal = document.getElementById('editUserModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function openCreateCompanyModal() {
    const modal = document.getElementById('createCompanyModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeCreateCompanyModal() {
    const modal = document.getElementById('createCompanyModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function closeEditCompanyModal() {
    const modal = document.getElementById('editCompanyModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function closeDeleteConfirmModal() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.style.display = 'none';
        });
    }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    UsersManager.init();
    CompaniesManager.init();
});
