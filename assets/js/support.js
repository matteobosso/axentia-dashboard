/**
 * Support Ticket Management for Axentia Dashboard
 * Handles ticket CRUD operations and messaging
 */

const SupportManager = {
    tickets: [],
    currentTicketId: null,
    filters: {
        search: '',
        status: '',
        priority: ''
    },

    /**
     * Initialize support page
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
        this.setupEventListeners();
        this.loadTickets();
    },

    /**
     * Setup event listeners for filters and forms
     */
    setupEventListeners: function() {
        // Filter listeners
        const filterSearch = document.getElementById('filterSearch');
        const filterStatus = document.getElementById('filterStatus');
        const filterPriority = document.getElementById('filterPriority');
        const btnReset = document.getElementById('btnReset');

        if (filterSearch) {
            filterSearch.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.renderTickets();
                this.updateResetButton();
            });
        }

        if (filterStatus) {
            filterStatus.addEventListener('change', (e) => {
                this.filters.status = e.target.value;
                this.renderTickets();
                this.updateResetButton();
            });
        }

        if (filterPriority) {
            filterPriority.addEventListener('change', (e) => {
                this.filters.priority = e.target.value;
                this.renderTickets();
                this.updateResetButton();
            });
        }

        if (btnReset) {
            btnReset.addEventListener('click', () => this.resetFilters());
        }

        // New ticket form
        const newTicketForm = document.getElementById('newTicketForm');
        if (newTicketForm) {
            newTicketForm.addEventListener('submit', (e) => this.handleNewTicket(e));
        }

        // Reply form
        const replyForm = document.getElementById('ticketReplyForm');
        if (replyForm) {
            replyForm.addEventListener('submit', (e) => this.handleReply(e));
        }

        // Company filter change (admin only)
        window.addEventListener('companyFilterChanged', () => this.loadTickets());
    },

    /**
     * Update reset button visibility
     */
    updateResetButton: function() {
        const btnReset = document.getElementById('btnReset');
        if (btnReset) {
            const hasFilters = this.filters.search || this.filters.status || this.filters.priority;
            btnReset.style.display = hasFilters ? '' : 'none';
        }
    },

    /**
     * Reset all filters
     */
    resetFilters: function() {
        this.filters = { search: '', status: '', priority: '' };

        const filterSearch = document.getElementById('filterSearch');
        const filterStatus = document.getElementById('filterStatus');
        const filterPriority = document.getElementById('filterPriority');

        if (filterSearch) filterSearch.value = '';
        if (filterStatus) filterStatus.value = '';
        if (filterPriority) filterPriority.value = '';

        this.renderTickets();
        this.updateResetButton();
    },

    /**
     * Load tickets from API
     */
    loadTickets: async function() {
        const tableBody = document.getElementById('ticketsTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2rem; color: #666;">
                    Caricamento ticket...
                </td>
            </tr>
        `;

        try {
            const endpoint = AuthManager.clientEndpoint || 'https://main-n8n.axentia-automation.it';
            const token = await AuthManager.getIdToken();

            const requestBody = {
                action: 'list_tickets'
            };

            // Add company filter for admin
            const activeCompanyId = AuthManager.getActiveCompanyId();
            if (activeCompanyId) {
                requestBody.company_id = activeCompanyId;
            }

            const response = await fetch(`${endpoint}/webhook/support-api`, {
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
            this.tickets = data.tickets || [];
            this.renderTickets();

        } catch (error) {
            console.error('Error loading tickets:', error);
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #c00;">
                        Errore nel caricamento dei ticket. Riprova.
                    </td>
                </tr>
            `;
        }
    },

    /**
     * Render tickets table with filters applied
     */
    renderTickets: function() {
        const tableBody = document.getElementById('ticketsTableBody');
        if (!tableBody) return;

        // Apply filters
        const filteredTickets = this.tickets.filter(ticket => {
            if (this.filters.search) {
                const searchTerm = this.filters.search;
                const matchesId = ticket.ticket_id?.toLowerCase().includes(searchTerm);
                const matchesSubject = ticket.subject?.toLowerCase().includes(searchTerm);
                const matchesCompany = ticket.company_name?.toLowerCase().includes(searchTerm);
                if (!matchesId && !matchesSubject && !matchesCompany) return false;
            }
            if (this.filters.status && ticket.status !== this.filters.status) return false;
            if (this.filters.priority && ticket.priority !== this.filters.priority) return false;
            return true;
        });

        if (filteredTickets.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #666;">
                        ${this.tickets.length === 0 ? 'Nessun ticket trovato.' : 'Nessun ticket corrisponde ai filtri.'}
                    </td>
                </tr>
            `;
            return;
        }

        const isAdmin = AuthManager.isAdmin();

        tableBody.innerHTML = filteredTickets.map(ticket => {
            const statusBadge = this.getStatusBadge(ticket.status);
            const priorityBadge = this.getPriorityBadge(ticket.priority);
            const date = new Date(ticket.created_at).toLocaleDateString('it-IT', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            const companyCell = isAdmin
                ? `<td>${SecurityUtils.escapeHtml(ticket.company_name || '-')}</td>`
                : '';

            return `
                <tr>
                    <td><code style="font-size: 0.85em;">${SecurityUtils.escapeHtml(ticket.ticket_id?.substring(0, 8) || '-')}</code></td>
                    <td>${SecurityUtils.escapeHtml(ticket.subject)}</td>
                    ${companyCell}
                    <td>${statusBadge}</td>
                    <td>${priorityBadge}</td>
                    <td>${date}</td>
                    <td style="text-align: right;">
                        <button class="btn-action" onclick="SupportManager.viewTicket('${SecurityUtils.escapeAttribute(ticket.ticket_id)}')" title="Visualizza">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Update company column visibility
        document.querySelectorAll('[data-role="admin"]').forEach(el => {
            if (el.tagName === 'TH' || el.tagName === 'TD') {
                el.style.display = isAdmin ? '' : 'none';
            }
        });
    },

    /**
     * Get status badge HTML
     */
    getStatusBadge: function(status) {
        const labels = {
            open: 'Aperto',
            in_progress: 'In Lavorazione',
            resolved: 'Risolto',
            closed: 'Chiuso'
        };
        const classes = {
            open: 'status-open',
            in_progress: 'status-progress',
            resolved: 'status-resolved',
            closed: 'status-closed'
        };
        return `<span class="status-badge ${classes[status] || ''}">${labels[status] || status}</span>`;
    },

    /**
     * Get priority badge HTML
     */
    getPriorityBadge: function(priority) {
        const labels = {
            low: 'Bassa',
            medium: 'Media',
            high: 'Alta',
            urgent: 'Urgente'
        };
        const classes = {
            low: 'priority-low',
            medium: 'priority-medium',
            high: 'priority-high',
            urgent: 'priority-urgent'
        };
        return `<span class="priority-badge ${classes[priority] || ''}">${labels[priority] || priority}</span>`;
    },

    /**
     * View ticket details
     */
    viewTicket: async function(ticketId) {
        this.currentTicketId = ticketId;

        const modal = document.getElementById('ticketDetailModal');
        const titleEl = document.getElementById('ticketDetailTitle');
        const metaEl = document.getElementById('ticketDetailMeta');
        const messagesEl = document.getElementById('ticketMessages');

        if (!modal) return;

        // Show modal with loading state
        modal.style.display = 'flex';
        titleEl.textContent = 'Caricamento...';
        metaEl.innerHTML = '';
        messagesEl.innerHTML = '<div style="text-align: center; padding: 2rem;">Caricamento messaggi...</div>';

        try {
            const endpoint = AuthManager.clientEndpoint || 'https://main-n8n.axentia-automation.it';
            const token = await AuthManager.getIdToken();

            const response = await fetch(`${endpoint}/webhook/support-api`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'get_ticket',
                    ticket_id: ticketId
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            this.renderTicketDetail(data.ticket, data.messages);

        } catch (error) {
            console.error('Error loading ticket:', error);
            messagesEl.innerHTML = '<div style="text-align: center; padding: 2rem; color: #c00;">Errore nel caricamento del ticket.</div>';
        }
    },

    /**
     * Render ticket detail in modal
     */
    renderTicketDetail: function(ticket, messages) {
        const titleEl = document.getElementById('ticketDetailTitle');
        const metaEl = document.getElementById('ticketDetailMeta');
        const messagesEl = document.getElementById('ticketMessages');

        if (!ticket) return;

        titleEl.textContent = SecurityUtils.escapeHtml(ticket.subject);

        const statusBadge = this.getStatusBadge(ticket.status);
        const priorityBadge = this.getPriorityBadge(ticket.priority);
        const date = new Date(ticket.created_at).toLocaleDateString('it-IT', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        metaEl.innerHTML = `
            <div class="ticket-meta-row">
                <span>ID: <code>${SecurityUtils.escapeHtml(ticket.ticket_id?.substring(0, 8))}</code></span>
                <span>${statusBadge}</span>
                <span>${priorityBadge}</span>
                <span>Aperto il ${date}</span>
            </div>
        `;

        // Render messages
        if (!messages || messages.length === 0) {
            messagesEl.innerHTML = `
                <div class="ticket-message">
                    <div class="message-header">
                        <span class="message-author">${SecurityUtils.escapeHtml(ticket.created_by_name || 'Cliente')}</span>
                        <span class="message-date">${date}</span>
                    </div>
                    <div class="message-content">${SecurityUtils.escapeHtml(ticket.description)}</div>
                </div>
            `;
        } else {
            messagesEl.innerHTML = messages.map(msg => {
                const msgDate = new Date(msg.created_at).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const isInternal = msg.is_internal ? ' <span class="internal-badge">Nota Interna</span>' : '';
                const authorClass = msg.is_admin ? 'admin-message' : 'user-message';

                return `
                    <div class="ticket-message ${authorClass}">
                        <div class="message-header">
                            <span class="message-author">${SecurityUtils.escapeHtml(msg.author_name || 'Utente')}${isInternal}</span>
                            <span class="message-date">${msgDate}</span>
                        </div>
                        <div class="message-content">${SecurityUtils.escapeHtml(msg.content)}</div>
                    </div>
                `;
            }).join('');
        }

        // Scroll to bottom
        messagesEl.scrollTop = messagesEl.scrollHeight;
    },

    /**
     * Handle new ticket submission
     */
    handleNewTicket: async function(event) {
        event.preventDefault();

        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Invio in corso...';

        try {
            const formData = new FormData(form);
            const endpoint = AuthManager.clientEndpoint || 'https://main-n8n.axentia-automation.it';
            const token = await AuthManager.getIdToken();

            const requestBody = {
                action: 'create_ticket',
                subject: formData.get('subject'),
                description: formData.get('description'),
                category: formData.get('category'),
                priority: formData.get('priority')
            };

            // Validate inputs
            if (!requestBody.subject || !requestBody.description) {
                throw new Error('Compila tutti i campi obbligatori');
            }

            if (!SecurityUtils.validators.ticketPriority(requestBody.priority)) {
                throw new Error('Priorita non valida');
            }

            const response = await fetch(`${endpoint}/webhook/support-api`, {
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
            closeNewTicketModal();
            form.reset();
            this.loadTickets();
            alert('Ticket creato con successo!');

        } catch (error) {
            console.error('Error creating ticket:', error);
            alert('Errore: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    },

    /**
     * Handle ticket reply submission
     */
    handleReply: async function(event) {
        event.preventDefault();

        if (!this.currentTicketId) return;

        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        submitBtn.disabled = true;
        submitBtn.textContent = 'Invio...';

        try {
            const formData = new FormData(form);
            const endpoint = AuthManager.clientEndpoint || 'https://main-n8n.axentia-automation.it';
            const token = await AuthManager.getIdToken();

            const requestBody = {
                action: 'add_message',
                ticket_id: this.currentTicketId,
                message: formData.get('message')
            };

            // Admin-only fields
            if (AuthManager.isAdmin()) {
                const isInternal = formData.get('is_internal');
                if (isInternal) {
                    requestBody.is_internal = true;
                }

                const newStatus = formData.get('new_status');
                if (newStatus && SecurityUtils.validators.ticketStatus(newStatus)) {
                    requestBody.new_status = newStatus;
                }
            }

            if (!requestBody.message?.trim()) {
                throw new Error('Inserisci un messaggio');
            }

            const response = await fetch(`${endpoint}/webhook/support-api`, {
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

            // Clear form and reload ticket
            form.reset();
            this.viewTicket(this.currentTicketId);
            this.loadTickets(); // Refresh list in background

        } catch (error) {
            console.error('Error sending reply:', error);
            alert('Errore: ' + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    }
};

// Modal functions (global scope for onclick handlers)
function openNewTicketModal() {
    const modal = document.getElementById('newTicketModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeNewTicketModal() {
    const modal = document.getElementById('newTicketModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function closeTicketDetailModal() {
    const modal = document.getElementById('ticketDetailModal');
    if (modal) {
        modal.style.display = 'none';
    }
    SupportManager.currentTicketId = null;
}

// Close modals on overlay click
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
        if (e.target.id === 'ticketDetailModal') {
            SupportManager.currentTicketId = null;
        }
    }
});

// Close modals on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.style.display = 'none';
        });
        SupportManager.currentTicketId = null;
    }
});

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    SupportManager.init();
});
