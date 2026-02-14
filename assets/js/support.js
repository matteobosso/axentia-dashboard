/**
 * Support Ticket Management for Axentia Dashboard
 * Handles ticket CRUD operations and messaging
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
        // Attendi che AuthManager sia pronto (usando la Promise)
        const isAuthenticated = await AuthManager.waitForAuth();

        if (!isAuthenticated) {
            return; // L'utente verrà rediretto dalla pagina di login
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
            const token = await AuthManager.getIdToken();

            const requestBody = {
                action: 'list_tickets'
            };

            // Add company filter
            const activeCompanyId = AuthManager.getActiveCompanyId();
            const firebaseUid = AuthManager.currentUser?.uid;

            console.log('[Support] Debug:', {
                isAdmin: AuthManager.isAdmin(),
                companyId: AuthManager.companyId,
                activeCompanyId: activeCompanyId,
                selectedCompanyId: AuthManager.selectedCompanyId,
                firebaseUid: firebaseUid
            });

            // Always pass both params (empty string = no filter)
            requestBody.company_id = activeCompanyId || '-';
            requestBody.firebase_uid = (!AuthManager.isAdmin() && firebaseUid) ? firebaseUid : '-';

            console.log('[Support] Request body:', requestBody);

            // Support API is centralized on main-n8n
            const response = await fetch(AuthManager.getCentralizedApiUrl('support-api'), {
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
            // Filter out invalid/empty tickets (when API returns [{}, null, etc.])
            this.tickets = (data.tickets || []).filter(t => t && t.ticket_id);
            this.renderTickets();
            this.updateBadge();

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
                    <td colspan="7" style="text-align: center; padding: 2rem; color: #666; font-style: italic;">
                        ${this.tickets.length === 0 ? 'Nessun ticket trovato' : 'Nessun ticket corrisponde ai filtri'}
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
                        ${isAdmin ? `
                        <button class="btn-action btn-danger" onclick="SupportManager.confirmDeleteTicket('${SecurityUtils.escapeAttribute(ticket.ticket_id)}', '${SecurityUtils.escapeAttribute(ticket.subject)}')" title="Elimina" style="margin-left: 0.5rem;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                        ` : ''}
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
            const token = await AuthManager.getIdToken();

            // Support API is centralized on main-n8n
            const response = await fetch(AuthManager.getCentralizedApiUrl('support-api'), {
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

        // Filter out internal notes for non-admin users
        const visibleMessages = messages
            ? (AuthManager.isAdmin() ? messages : messages.filter(msg => !msg.is_internal))
            : [];

        // Render messages
        if (visibleMessages.length === 0) {
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
            messagesEl.innerHTML = visibleMessages.map(msg => {
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

        // Mark ticket as seen (save message count for badge tracking)
        // Use visible messages count so internal notes don't affect user's badge
        const messageCount = visibleMessages.length;
        this.saveLastSeen(ticket.ticket_id, messageCount);
        this.updateBadge();
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
            const token = await AuthManager.getIdToken();

            // Get user data from AuthManager
            const companyId = AuthManager.getActiveCompanyId() || AuthManager.companyId;
            const userId = AuthManager.currentUser?.uid;

            if (!companyId) {
                throw new Error('Nessuna azienda associata al tuo account');
            }

            if (!userId) {
                throw new Error('Sessione non valida. Effettua nuovamente il login');
            }

            const requestBody = {
                action: 'create_ticket',
                subject: formData.get('subject'),
                description: formData.get('description'),
                category: formData.get('category'),
                priority: formData.get('priority'),
                company_id: companyId,
                user_id: userId
            };

            // Validate inputs
            if (!requestBody.subject || !requestBody.description) {
                throw new Error('Compila tutti i campi obbligatori');
            }

            if (!SecurityUtils.validators.ticketPriority(requestBody.priority)) {
                throw new Error('Priorita non valida');
            }

            // Support API is centralized on main-n8n
            const response = await fetch(AuthManager.getCentralizedApiUrl('support-api'), {
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
            this.loadTickets();
            showModalFeedback('newTicketFeedback', 'Ticket creato con successo!', 'success');
            setTimeout(() => closeNewTicketModal(), 2000);

        } catch (error) {
            console.error('Error creating ticket:', error);
            showModalFeedback('newTicketFeedback', 'Errore: ' + error.message, 'error');
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
            const token = await AuthManager.getIdToken();

            const requestBody = {
                action: 'add_message',
                ticket_id: this.currentTicketId,
                message: formData.get('message'),
                user_id: AuthManager.currentUser?.uid,
                author_name: AuthManager.currentUser?.displayName || 'Utente'
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

            // Support API is centralized on main-n8n
            const response = await fetch(AuthManager.getCentralizedApiUrl('support-api'), {
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
    },

    /**
     * Confirm ticket deletion (admin only)
     */
    confirmDeleteTicket: function(ticketId, ticketSubject) {
        if (!AuthManager.isAdmin()) return;

        document.getElementById('deleteTicketId').value = ticketId;
        document.getElementById('deleteTicketMessage').innerHTML = `Sei sicuro di voler eliminare il ticket <strong>${SecurityUtils.escapeHtml(ticketSubject)}</strong>?<br><small style="color: #c00;">Questa azione è irreversibile e cancellerà anche tutti i messaggi associati.</small>`;
        document.getElementById('deleteTicketModal').style.display = 'flex';
    },

    /**
     * Delete ticket (admin only)
     */
    deleteTicket: async function(ticketId) {
        if (!AuthManager.isAdmin()) return;

        try {
            const token = await AuthManager.getIdToken();

            const response = await fetch(AuthManager.getCentralizedApiUrl('support-api'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'delete_ticket',
                    ticket_id: ticketId
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            // Close detail modal if open
            if (this.currentTicketId === ticketId) {
                closeTicketDetailModal();
            }

            // Reload tickets
            this.loadTickets();
            showToast('Ticket eliminato con successo!', 'success');

        } catch (error) {
            console.error('Error deleting ticket:', error);
            showToast('Errore: ' + error.message, 'error');
        }
    },

    /**
     * Save last seen message count for a ticket
     */
    saveLastSeen: function(ticketId, messageCount) {
        const uid = AuthManager.currentUser?.uid;
        if (!uid) return;
        const key = `ticket_seen_${uid}`;
        const seen = JSON.parse(localStorage.getItem(key) || '{}');
        seen[ticketId] = messageCount;
        localStorage.setItem(key, JSON.stringify(seen));
    },

    /**
     * Get count of tickets with unread messages
     */
    getUnreadCount: function() {
        const uid = AuthManager.currentUser?.uid;
        if (!uid) return 0;
        const key = `ticket_seen_${uid}`;
        const seen = JSON.parse(localStorage.getItem(key) || '{}');
        const isAdmin = AuthManager.isAdmin();
        let unread = 0;
        this.tickets.forEach(t => {
            const lastSeen = seen[t.ticket_id] || 0;
            // Admin sees all messages, users only see visible (non-internal) messages
            const currentCount = isAdmin ? (t.message_count || 0) : (t.visible_message_count || 0);
            if (currentCount > lastSeen) unread++;
        });
        return unread;
    },

    /**
     * Update the notification badge in sidebar
     */
    updateBadge: function() {
        const badge = document.getElementById('supportBadge');
        if (!badge) return;
        const count = this.getUnreadCount();
        badge.textContent = count > 0 ? (count > 9 ? '9+' : count) : '';
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

function closeDeleteTicketModal() {
    const modal = document.getElementById('deleteTicketModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function confirmDeleteTicket() {
    const ticketId = document.getElementById('deleteTicketId').value;
    closeDeleteTicketModal();
    SupportManager.deleteTicket(ticketId);
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
