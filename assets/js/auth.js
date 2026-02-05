/**
 * Firebase Authentication Manager for Axentia Dashboard
 * Handles user authentication, token management, endpoint routing, and RBAC
 */

// Firebase configuration (same as main website)
const firebaseConfig = {
    apiKey: "AIzaSyD7fdNXUgSw4VX8lN9bvbt34htyaxu5pPs",
    authDomain: "axentia-website.firebaseapp.com",
    projectId: "axentia-website",
    storageBucket: "axentia-website.firebasestorage.app",
    messagingSenderId: "315615355298",
    appId: "1:315615355298:web:f7092567187e3fb69b92fb"
};

const AuthManager = {
    // Core auth state
    currentUser: null,
    idToken: null,
    clientEndpoint: null,
    initialized: false,
    authReadyPromise: null,
    authReadyResolve: null,

    // RBAC properties
    userRole: null,           // 'admin' | 'user'
    companyId: null,          // User's company UUID
    companyName: null,        // User's company name
    allCompanies: [],         // For admin: list of all companies
    selectedCompanyId: null,  // For admin: currently selected company filter

    /**
     * Initialize Firebase Auth and set up auth state listener
     */
    init: function() {
        if (this.initialized) return this.authReadyPromise;

        // Create promise that resolves when auth state is determined
        this.authReadyPromise = new Promise((resolve) => {
            this.authReadyResolve = resolve;
        });

        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        // Check for token in URL (cross-domain auth)
        this.handleCrossDomainAuth();

        // Listen for auth state changes
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.refreshToken();
                await this.loadCompaniesIfAdmin();
                this.onAuthSuccess();
                this.authReadyResolve(true);
            } else {
                this.clearAuthState();
                this.redirectToLogin();
                this.authReadyResolve(false);
            }
        });

        this.initialized = true;
        return this.authReadyPromise;
    },

    /**
     * Handle cross-domain authentication via URL token
     */
    handleCrossDomainAuth: async function() {
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        if (token) {
            try {
                // Sign in with the custom token passed from main website
                await firebase.auth().signInWithCustomToken(token);

                // Clean up URL (remove token parameter)
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);

                console.log('[AuthManager] Cross-domain auth successful');
            } catch (error) {
                console.error('[AuthManager] Cross-domain auth failed:', error);
                // Token might be an ID token, not custom token - try different approach
                // For now, clear the URL parameter
                const cleanUrl = window.location.origin + window.location.pathname;
                window.history.replaceState({}, document.title, cleanUrl);
            }
        }
    },

    /**
     * Clear all auth-related state
     */
    clearAuthState: function() {
        this.currentUser = null;
        this.idToken = null;
        this.clientEndpoint = null;
        this.userRole = null;
        this.companyId = null;
        this.companyName = null;
        this.allCompanies = [];
        this.selectedCompanyId = null;
        sessionStorage.removeItem('n8n_endpoint');
        sessionStorage.removeItem('user_role');
        sessionStorage.removeItem('company_id');
        sessionStorage.removeItem('selected_company_id');
    },

    /**
     * Refresh the ID token and extract custom claims
     */
    refreshToken: async function() {
        if (!this.currentUser) return;

        try {
            const tokenResult = await this.currentUser.getIdTokenResult(true);
            this.idToken = tokenResult.token;

            // Extract custom claims
            const claims = tokenResult.claims;

            // Get n8n endpoint from custom claims, fallback to main demo instance
            this.clientEndpoint = claims.n8n_endpoint
                || 'https://main-n8n.axentia-automation.it';

            // Extract role (default to 'user' if not set)
            this.userRole = claims.role || 'user';

            // Extract company ID
            this.companyId = claims.company_id || null;

            // Debug logging for role detection
            console.log('[AuthManager] Token claims:', {
                role: this.userRole,
                company_id: this.companyId,
                n8n_endpoint: this.clientEndpoint,
                email: this.currentUser?.email
            });

            // Store in sessionStorage for quick access
            sessionStorage.setItem('n8n_endpoint', this.clientEndpoint);
            sessionStorage.setItem('user_role', this.userRole);
            if (this.companyId) {
                sessionStorage.setItem('company_id', this.companyId);
            }

            // For admins, restore selected company from session or default to null (all)
            // For users, selected company is always their own
            if (this.isAdmin()) {
                const savedSelection = sessionStorage.getItem('selected_company_id');
                this.selectedCompanyId = savedSelection || null;
            } else {
                this.selectedCompanyId = this.companyId;
            }

        } catch (error) {
            console.error('Error refreshing token:', error);
            this.redirectToLogin();
        }
    },

    /**
     * Load all companies for admin users
     */
    loadCompaniesIfAdmin: async function() {
        if (!this.isAdmin()) return;

        try {
            const response = await fetch(this.getWebhookUrl('dashboard-api'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.idToken}`
                },
                body: JSON.stringify({ action: 'list_companies' })
            });

            if (response.ok) {
                const data = await response.json();
                this.allCompanies = Array.isArray(data) ? data : [];
            }
        } catch (error) {
            console.error('Error loading companies:', error);
            this.allCompanies = [];
        }
    },

    /**
     * Check if current user is admin
     * @returns {boolean}
     */
    isAdmin: function() {
        return this.userRole === 'admin';
    },

    /**
     * Get the company ID to use for data filtering
     * For admins: returns selected company or null (all companies)
     * For users: always returns their own company
     * @returns {string|null}
     */
    getActiveCompanyId: function() {
        if (this.isAdmin()) {
            return this.selectedCompanyId; // null means "all companies"
        }
        return this.companyId;
    },

    /**
     * Set the active company filter (admin only)
     * @param {string|null} companyId - Company to filter by, or null for all
     */
    setActiveCompany: function(companyId) {
        if (!this.isAdmin()) return;

        this.selectedCompanyId = companyId;
        if (companyId) {
            sessionStorage.setItem('selected_company_id', companyId);
        } else {
            sessionStorage.removeItem('selected_company_id');
        }

        // Dispatch event for other components to react
        window.dispatchEvent(new CustomEvent('companyFilterChanged', {
            detail: { companyId }
        }));
    },

    /**
     * Get company name by ID
     * @param {string} companyId
     * @returns {string}
     */
    getCompanyName: function(companyId) {
        if (!companyId) return 'Tutte le aziende';
        const company = this.allCompanies.find(c => c.company_id === companyId);
        return company ? company.name : 'Sconosciuta';
    },

    /**
     * Get the full webhook URL for a given path
     * @param {string} path - The webhook path (e.g., 'dashboard-api', 'chat')
     * @returns {string} Full webhook URL
     */
    getWebhookUrl: function(path) {
        const endpoint = this.clientEndpoint
            || sessionStorage.getItem('n8n_endpoint')
            || 'https://main-n8n.axentia-automation.it';
        return `${endpoint}/webhook/${path}`;
    },

    /**
     * Make an authenticated fetch request
     * @param {string} url - The URL to fetch
     * @param {object} options - Fetch options
     * @returns {Promise<Response>} Fetch response
     */
    fetchWithAuth: async function(url, options = {}) {
        // Ensure we have a fresh token
        await this.refreshToken();

        if (!this.idToken) {
            throw new Error('Not authenticated');
        }

        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${this.idToken}`
        };

        return fetch(url, {
            ...options,
            headers
        });
    },

    /**
     * Called when user is successfully authenticated
     */
    onAuthSuccess: function() {
        // Update user badge in sidebar with role indicator
        const userBadge = document.querySelector('.user-badge');
        if (userBadge && this.currentUser) {
            const displayName = this.currentUser.displayName
                || this.currentUser.email
                || 'Utente';
            const roleLabel = this.isAdmin() ? 'Admin' : 'Cliente';
            const roleClass = this.isAdmin() ? 'admin' : 'user';

            userBadge.innerHTML = `
                <span class="status-dot green"></span>
                <span class="user-name">${SecurityUtils.escapeHtml(displayName)}</span>
                <span class="role-badge ${roleClass}">${roleLabel}</span>
            `;
        }

        // Show/hide admin-only elements
        this.updateUIForRole();

        // Initialize company filter for admins
        if (this.isAdmin()) {
            this.initCompanyFilter();
        }

        // Trigger dashboard initialization if functions exist
        if (typeof initDashboard === 'function') {
            initDashboard();
        }
        if (typeof initReport === 'function') {
            initReport();
        }

        // Dispatch custom event for other scripts to listen to
        window.dispatchEvent(new CustomEvent('authReady', {
            detail: {
                user: this.currentUser,
                endpoint: this.clientEndpoint,
                role: this.userRole,
                companyId: this.companyId,
                isAdmin: this.isAdmin()
            }
        }));
    },

    /**
     * Show/hide UI elements based on user role
     */
    updateUIForRole: function() {
        // Debug logging for UI role updates
        console.log('[AuthManager] updateUIForRole:', {
            role: this.userRole,
            isAdmin: this.isAdmin(),
            adminElements: document.querySelectorAll('[data-role="admin"]').length
        });

        // Show admin-only elements
        document.querySelectorAll('[data-role="admin"]').forEach(el => {
            el.style.display = this.isAdmin() ? '' : 'none';
        });

        // Show user-only elements
        document.querySelectorAll('[data-role="user"]').forEach(el => {
            el.style.display = !this.isAdmin() ? '' : 'none';
        });

        // Show elements for any authenticated user
        document.querySelectorAll('[data-role="any"]').forEach(el => {
            el.style.display = '';
        });
    },

    /**
     * Initialize the company filter dropdown (admin only)
     */
    initCompanyFilter: function() {
        const filterWrapper = document.getElementById('companyFilterWrapper');
        if (!filterWrapper) return;

        // Show the filter for admins
        filterWrapper.style.display = '';

        const trigger = filterWrapper.querySelector('.dropdown-trigger');
        const currentName = document.getElementById('currentCompanyName');
        const optionsMenu = document.getElementById('companyOptions');

        if (!trigger || !currentName || !optionsMenu) return;

        // Build options HTML
        let optionsHtml = `
            <div class="company-option" data-id="">Tutte le aziende</div>
        `;

        this.allCompanies.forEach(company => {
            optionsHtml += `
                <div class="company-option" data-id="${SecurityUtils.escapeAttribute(company.company_id)}">
                    ${SecurityUtils.escapeHtml(company.name)}
                </div>
            `;
        });

        optionsMenu.innerHTML = optionsHtml;

        // Set initial selection
        currentName.textContent = this.getCompanyName(this.selectedCompanyId);

        // Toggle dropdown
        trigger.onclick = (e) => {
            e.stopPropagation();
            filterWrapper.classList.toggle('open');
        };

        // Handle option selection
        optionsMenu.querySelectorAll('.company-option').forEach(opt => {
            opt.onclick = (e) => {
                e.stopPropagation();
                const companyId = opt.getAttribute('data-id') || null;
                this.setActiveCompany(companyId);
                currentName.textContent = opt.textContent.trim();
                filterWrapper.classList.remove('open');
            };
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!filterWrapper.contains(e.target)) {
                filterWrapper.classList.remove('open');
            }
        });
    },

    /**
     * Redirect to login page
     */
    redirectToLogin: function() {
        // Don't redirect if already on login page
        if (window.location.pathname.includes('login.html')) {
            return;
        }
        // Redirect to local login page
        window.location.href = 'login.html';
    },

    /**
     * Sign out the current user
     */
    signOut: async function() {
        try {
            await firebase.auth().signOut();
            this.clearAuthState();
            this.redirectToLogin();
        } catch (error) {
            console.error('Error signing out:', error);
        }
    },

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated: function() {
        return this.currentUser !== null && this.idToken !== null;
    },

    /**
     * Wait for auth to be ready
     * @returns {Promise<boolean>} True if authenticated, false otherwise
     */
    waitForAuth: function() {
        if (this.authReadyPromise) {
            return this.authReadyPromise;
        }
        return this.init();
    },

    /**
     * Get current user's email
     * @returns {string|null}
     */
    getUserEmail: function() {
        return this.currentUser ? this.currentUser.email : null;
    },

    /**
     * Get current user's display name
     * @returns {string|null}
     */
    getUserDisplayName: function() {
        return this.currentUser ? (this.currentUser.displayName || this.currentUser.email) : null;
    },

    /**
     * Get current ID token (refreshes if needed)
     * @returns {Promise<string|null>}
     */
    getIdToken: async function() {
        if (!this.currentUser) return null;

        try {
            await this.refreshToken();
            return this.idToken;
        } catch (error) {
            console.error('Error getting ID token:', error);
            return null;
        }
    }
};

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AuthManager.init();
});
