/**
 * User Management for Axentia Dashboard
 * Admin-only functionality for managing users
 */

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
        // Wait for auth to be ready
        if (!AuthManager.isAuthenticated) {
            window.addEventListener('authReady', () => this.initAfterAuth());
            return;
        }
        this.initAfterAuth();
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
     */
    loadCompanies: async function() {
        try {
            const endpoint = AuthManager.clientEndpoint || 'https://main-n8n.axentia-automation.it';
            const token = await AuthManager.getIdToken();

            const response = await fetch(`${endpoint}/webhook/user-management`, {
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
            this.populateCompanyDropdowns();
            this.updateStats();

        } catch (error) {
            console.error('Error loading companies:', error);
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

        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #666;">
                    Caricamento utenti...
                </td>
            </tr>
        `;

        try {
            const endpoint = AuthManager.clientEndpoint || 'https://main-n8n.axentia-automation.it';
            const token = await AuthManager.getIdToken();

            const requestBody = {
                action: 'list_users'
            };

            // Add company filter if selected
            const activeCompanyId = AuthManager.getActiveCompanyId();
            if (activeCompanyId) {
                requestBody.company_id = activeCompanyId;
            }

            const response = await fetch(`${endpoint}/webhook/user-management`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.users = data.users || [];
            this.renderUsers();
            this.updateStats();

        } catch (error) {
            console.error('Error loading users:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #c00;">
                        Errore nel caricamento degli utenti. Riprova.
                    </td>
                </tr>
            `;
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
                    <td>${SecurityUtils.escapeHtml(user.company_name || '-')}</td>
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
        const activeEl = document.getElementById('statActiveUsers');
        const companiesEl = document.getElementById('statCompanies');

        if (totalEl) {
            totalEl.textContent = this.users.length;
        }

        if (activeEl) {
            const activeCount = this.users.filter(u => u.is_active !== false).length;
            activeEl.textContent = activeCount;
        }

        if (companiesEl) {
            companiesEl.textContent = this.companies.length;
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
            const n8nEndpoint = formData.get('n8n_endpoint');

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

            const endpoint = AuthManager.clientEndpoint || 'https://main-n8n.axentia-automation.it';
            const token = await AuthManager.getIdToken();

            const requestBody = {
                action: 'create_user',
                email: email,
                company_id: companyId,
                role: role
            };

            if (displayName) {
                requestBody.display_name = displayName;
            }

            if (n8nEndpoint) {
                requestBody.n8n_endpoint = n8nEndpoint;
            }

            const response = await fetch(`${endpoint}/webhook/user-management`, {
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
            closeInviteModal();
            form.reset();
            this.loadUsers();
            alert('Invito inviato con successo! L\'utente ricevera un\'email per impostare la password.');

        } catch (error) {
            console.error('Error inviting user:', error);
            alert('Errore: ' + error.message);
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
        document.getElementById('editUserEndpoint').value = user.n8n_endpoint || '';

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
            const n8nEndpoint = formData.get('n8n_endpoint');

            // Validate inputs
            if (!SecurityUtils.validators.role(role)) {
                throw new Error('Ruolo non valido');
            }

            if (displayName && !SecurityUtils.validators.displayName(displayName)) {
                throw new Error('Nome non valido');
            }

            const endpoint = AuthManager.clientEndpoint || 'https://main-n8n.axentia-automation.it';
            const token = await AuthManager.getIdToken();

            const requestBody = {
                action: 'update_user',
                user_id: userId,
                display_name: displayName || null,
                company_id: companyId || null,
                role: role,
                is_active: isActive,
                n8n_endpoint: n8nEndpoint || null
            };

            const response = await fetch(`${endpoint}/webhook/user-management`, {
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
            closeEditModal();
            this.loadUsers();
            alert('Utente aggiornato con successo!');

        } catch (error) {
            console.error('Error updating user:', error);
            alert('Errore: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
};

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
});
