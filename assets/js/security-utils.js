/**
 * Security Utilities for Axentia Dashboard
 * Provides XSS prevention and input validation functions
 */

const SecurityUtils = {
    /**
     * Escape HTML to prevent XSS attacks
     * Use for inserting text content into HTML
     * @param {*} str - String to escape
     * @returns {string} - Escaped string safe for innerHTML
     */
    escapeHtml: (str) => {
        if (str === null || str === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    },

    /**
     * Escape string for use in HTML attributes
     * More restrictive than escapeHtml - also escapes quotes
     * @param {*} str - String to escape
     * @returns {string} - Escaped string safe for attributes
     */
    escapeAttribute: (str) => {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    /**
     * Generate cryptographically secure session ID
     * Replaces Math.random() which is not secure
     * @returns {string} - Secure session ID
     */
    generateSecureId: () => {
        if (crypto && crypto.randomUUID) {
            return 'sess_' + crypto.randomUUID();
        }
        // Fallback for older browsers
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return 'sess_' + Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    },

    /**
     * Input validators for common fields
     * Use before sending data to backend
     */
    validators: {
        /**
         * Validate period parameter (24h, 7d, 30d, 90d, 365d)
         */
        period: (val) => ['24h', '7d', '30d', '90d', '365d'].includes(val),

        /**
         * Validate file name (alphanumeric, dots, dashes, underscores, spaces + extension)
         */
        fileName: (val) => /^[\w\-. ]+\.(pdf|docx|txt|csv|xlsx)$/i.test(val),

        /**
         * Validate workflow ID (alphanumeric, dashes, underscores)
         */
        workflowId: (val) => /^[a-zA-Z0-9_-]+$/.test(val),

        /**
         * Validate UUID format
         */
        uuid: (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val),

        /**
         * Validate email format
         */
        email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),

        /**
         * Validate user role
         */
        role: (val) => ['admin', 'user'].includes(val),

        /**
         * Validate ticket status
         */
        ticketStatus: (val) => ['open', 'in_progress', 'resolved', 'closed'].includes(val),

        /**
         * Validate ticket priority
         */
        ticketPriority: (val) => ['low', 'medium', 'high', 'urgent'].includes(val),

        /**
         * Validate display name (letters, spaces, hyphens, apostrophes)
         */
        displayName: (val) => /^[\p{L}\s\-'.]{1,100}$/u.test(val)
    },

    /**
     * Sanitize object values recursively
     * @param {Object} obj - Object to sanitize
     * @returns {Object} - Sanitized object
     */
    sanitizeObject: (obj) => {
        if (typeof obj !== 'object' || obj === null) {
            return typeof obj === 'string' ? SecurityUtils.escapeHtml(obj) : obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => SecurityUtils.sanitizeObject(item));
        }

        const sanitized = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = SecurityUtils.sanitizeObject(value);
        }
        return sanitized;
    }
};

// Freeze to prevent modification
Object.freeze(SecurityUtils);
Object.freeze(SecurityUtils.validators);
