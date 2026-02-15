/**
 * Axentia Dashboard Core JS
 * Gestisce Index, Report e Flussi in un unico file
 */

// Dynamic webhook URL based on company endpoint
// For admins: uses selected company's endpoint
// For users: uses their company's endpoint
const getWebhookUrl = () => {
    if (typeof AuthManager !== 'undefined') {
        // For admin with selected company, get that company's endpoint
        if (AuthManager.isAdmin && AuthManager.isAdmin()) {
            const selectedCompanyId = AuthManager.getActiveCompanyId();
            if (selectedCompanyId && AuthManager.getCompanyEndpoint) {
                const companyEndpoint = AuthManager.getCompanyEndpoint(selectedCompanyId);
                return `${companyEndpoint}/webhook/dashboard-api`;
            }
        }
        // For regular users, use their assigned endpoint
        if (AuthManager.clientEndpoint) {
            return `${AuthManager.clientEndpoint}/webhook/dashboard-api`;
        }
    }
    // Fallback for development or when AuthManager not ready
    return sessionStorage.getItem('n8n_endpoint')
        ? `${sessionStorage.getItem('n8n_endpoint')}/webhook/dashboard-api`
        : 'https://main-n8n.axentia-automation.it/webhook/dashboard-api';
};

/**
 * Build request body with company filter for admin
 * @param {Object} baseBody - Base request body
 * @returns {Object} - Request body with company_id if applicable
 */
const buildRequestBody = (baseBody) => {
    const body = { ...baseBody };

    // Add company filter if admin has selected one
    if (typeof AuthManager !== 'undefined' && AuthManager.isAdmin && AuthManager.isAdmin()) {
        const activeCompanyId = AuthManager.getActiveCompanyId();
        if (activeCompanyId) {
            body.company_id = activeCompanyId;
        }
    }

    return body;
};

const COSTO_ORARIO_MEDIO = 25; 

let allData = []; 
let barChartInstance = null;
let pieChartInstance = null;


/**
 * Modal overlay epr esecuzioni flussi
 */
window.prepareModal = function(workflowId) {
    console.log("prepareModal chiamato per:", workflowId);
    const workflow = allData.find(w => w.id === workflowId);
    
    if (workflow) {
        openWorkflowModal(workflow.id, workflow.display_name, workflow.full_schema);
    } else {
        console.error("Workflow non trovato in allData:", workflowId);
    }
};

window.openWorkflowModal = function(workflowId, displayName, schema) {
    const modal = document.getElementById('modalOverlay');
    const container = document.getElementById('dynamicInputsContainer');
    const form = document.getElementById('dynamicWorkflowForm');
    const submitBtn = form.querySelector('.btn-execute');

    // RESET STATO PULSANTE E MODAL
    submitBtn.disabled = false;
    submitBtn.textContent = 'Esegui';
    
    // Rimuovi vecchio feedback se esiste
    const oldFeedback = document.getElementById('workflowFeedback');
    if (oldFeedback) oldFeedback.remove();

    document.getElementById('modalTitle').textContent = displayName;
    container.innerHTML = ''; 

    let tooltip = document.getElementById('workflow-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'workflow-tooltip';
        tooltip.className = 'workflow-tooltip';
        document.body.appendChild(tooltip);
    }

    const cleanSchema = schema ? schema.filter(f => f.id !== 'dummy') : [];

    cleanSchema.forEach(field => {
        const parts = field.id.split(':');
        const techId = parts[0].trim();
        const description = parts[1] ? parts[1].trim() : null;

        const fieldWrapper = document.createElement('div');
        fieldWrapper.className = field.type === 'boolean' ? 'field-group field-group-boolean' : 'field-group';

        let labelHtml = `
            <div class="label-wrapper">
                <label>${techId}${field.required ? '*' : ''}</label>
                ${description ? `<span class="info-icon" data-info="${SecurityUtils.escapeAttribute(description)}">i</span>` : ''}
            </div>`;

        let inputHtml = '';
        if (field.type === 'file' || field.type === 'object') {
            inputHtml = `
                <div class="file-input-wrapper">
                    <span class="file-label">Scegli file</span>
                    <input type="file" name="${techId}" class="workflow-input file-trigger" ${field.required ? 'required' : ''}>
                    <div class="file-name-preview" id="preview-${techId}"></div>
                </div>`;
        } else if (field.type === 'boolean') {
            const toggleId = `toggle-${techId}-${Date.now()}`;
            inputHtml = `
                <div class="boolean-toggle">
                    <input type="checkbox" name="${techId}" class="workflow-input boolean-input" id="${toggleId}">
                    <label for="${toggleId}" class="toggle-switch">
                        <span class="toggle-slider"></span>
                    </label>
                </div>`;
        } else {
            inputHtml = `<input type="${field.type === 'number' ? 'number' : 'text'}" name="${techId}" ${field.required ? 'required' : ''} class="workflow-input">`;
        }

        fieldWrapper.innerHTML = labelHtml + inputHtml;
        container.appendChild(fieldWrapper);

        // Feedback nome file
        const fileTrigger = fieldWrapper.querySelector('.file-trigger');
        if (fileTrigger) {
            fileTrigger.onchange = function() {
                const preview = document.getElementById(`preview-${techId}`);
                preview.textContent = this.files[0] ? this.files[0].name : '';
            };
        }

        const infoIcon = fieldWrapper.querySelector('.info-icon');
        if (infoIcon) {
            infoIcon.onmouseenter = (e) => {
                tooltip.textContent = infoIcon.getAttribute('data-info');
                tooltip.classList.add('visible');
            };
            infoIcon.onmousemove = (e) => {
                tooltip.style.top = (e.pageY + 15) + 'px';
                tooltip.style.left = (e.pageX + 15) + 'px';
            };
            infoIcon.onmouseleave = () => tooltip.classList.remove('visible');
        }
    });

    modal.style.display = 'flex';

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const submitBtn = form.querySelector('.btn-execute');
        const container = document.getElementById('dynamicInputsContainer');
        const originalText = submitBtn.textContent;
        
        // 1. UI Loading State
        submitBtn.disabled = true;
        submitBtn.textContent = 'Elaborazione...';
        
        // Creiamo o resettiamo un box per i messaggi
        let feedbackBox = document.getElementById('workflowFeedback');
        if (!feedbackBox) {
            feedbackBox = document.createElement('div');
            feedbackBox.id = 'workflowFeedback';
            container.prepend(feedbackBox); // Lo mettiamo in cima agli input
        }
        feedbackBox.className = 'feedback-message info';
        feedbackBox.textContent = 'Il workflow è in esecuzione, attendi...';

        try {
            const formData = new FormData();
            formData.append('action', 'run_manual_workflow');
            formData.append('workflow_id', workflowId);

            const inputs = {};
            form.querySelectorAll('.workflow-input').forEach(input => {
                const techId = input.name; 
                if (input.type === 'file') {
                    if (input.files[0]) formData.append(techId, input.files[0]);
                } else if (input.type === 'checkbox') {
                    inputs[techId] = input.checked;
                } else {
                    inputs[techId] = input.value;
                }
            });
            formData.append('inputs', JSON.stringify(inputs));

            const response = await fetch(getWebhookUrl(), { method: 'POST', body: formData });
            const result = await response.json();

            if (!response.ok) throw new Error(result.message || "Errore durante l'esecuzione");

            // 2. GESTIONE OUTPUT (Cosa succede se il flusso ritorna dati)
            feedbackBox.className = 'feedback-message success';
            
            if (result.output_display) {
                feedbackBox.innerHTML = `<strong>RISULTATO:</strong><br>${SecurityUtils.escapeHtml(result.output_display)}`;
                submitBtn.textContent = 'COMPLETATO';
                // Non chiudere se c'è un output da leggere!
            } else {
                feedbackBox.className = 'feedback-message success';
                feedbackBox.textContent = 'Workflow completato con successo!';
                
                // Chiudi solo se non c'è output informativo
                setTimeout(() => {
                    closeWorkflowModal();
                    // Opzionale: ricarica i dati per vedere i nuovi KPI
                    if (typeof initReport === 'function') initReport();
                    if (typeof initDashboard === 'function') initDashboard();
                }, 1500);
            }

        } catch (error) {
            // 3. GESTIONE ERRORI
            console.error("Workflow Error:", error);
            feedbackBox.className = 'feedback-message error';
            feedbackBox.textContent = "Errore: " + error.message;
            submitBtn.disabled = false;
            submitBtn.textContent = 'RIPROVA ESECUZIONE';
        }
    };
};

window.closeWorkflowModal = function() {
    document.getElementById('modalOverlay').style.display = 'none';
};

document.addEventListener('DOMContentLoaded', async () => {
    // Rilevamento elementi DOM
    const kpiContainer = document.getElementById('kpiOre');
    const reportTable = document.getElementById('reportTableBody');
    const workflowGrid = document.getElementById('workflowContainer');
    const filterPeriod = document.getElementById('filterPeriod');
    const agentSelect = document.getElementById('agentSelect');

    // BUGFIX: Wait for auth to be ready before loading data
    // This ensures AuthManager.selectedCompanyId is properly initialized from sessionStorage
    // Otherwise, getActiveCompanyId() defaults to first company (Axentia) while dropdown shows cached selection
    if (typeof AuthManager !== 'undefined') {
        await AuthManager.waitForAuth();
    }

    // 1. Inizializzazione dati
    if (kpiContainer || reportTable) {
        // Se siamo in Index o Report, carichiamo i dati delle performance
        initReport();
    } else if (workflowGrid) {
        // Se siamo in Flussi, carichiamo le card dei workflow
        initDashboard();
    } else if (document.getElementById('kbTableBody')) {
        // Se siamo in Conoscenza, carichiamo la knowledge base
        loadKnowledgeBase();
    }
    if (agentSelect) {
        initAgents();
    }

    // 2. Event Listeners Universali
    document.getElementById('filterSearch')?.addEventListener('input', applyUniversalFilters);
    document.getElementById('filterArea')?.addEventListener('change', applyUniversalFilters);
    filterPeriod?.addEventListener('change', initReport);
    document.getElementById('btnReset')?.addEventListener('click', resetAllFilters);

    // 3. Company filter change listener (RBAC)
    window.addEventListener('companyFilterChanged', () => {
        // Reload data when admin changes company filter
        if (document.getElementById('reportTableBody') || document.getElementById('kpiOre')) {
            initReport();
        } else if (document.getElementById('workflowContainer')) {
            initDashboard();
        }
        // Knowledge base page
        if (document.getElementById('kbTableBody') && typeof loadKnowledgeBase === 'function') {
            loadKnowledgeBase();
        }
        // Chat page - reload agents for selected company
        if (document.getElementById('agentSelect')) {
            initAgents();
        }
    });
});

/**
 * Carica la lista degli agenti AI disponibili
 */
async function initAgents() {
    const wrapper = document.getElementById('customAgentWrapper');
    
    // Se non siamo in una pagina con il dropdown, esci
    if (!wrapper) return;

    const trigger = wrapper.querySelector('.dropdown-trigger');
    const triggerName = document.getElementById('currentAgentName');
    const optionsMenu = document.getElementById('agentOptions');
    const hiddenInput = document.getElementById('agentSelect');

    // 1. LOGICA UI: Gestione Click (Immediata, non aspetta il server)
    trigger.onclick = (e) => {
        e.stopPropagation();
        // Chiudi altri eventuali dropdown aperti
        document.querySelectorAll('.custom-agent-dropdown').forEach(el => {
            if (el !== wrapper) el.classList.remove('open');
        });
        // Toggle corrente
        wrapper.classList.toggle('open');
    };

    // Chiudi cliccando fuori
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            wrapper.classList.remove('open');
        }
    });

    // 2. LOGICA DATI: Recupero agenti dal server
    const token = await AuthManager.getIdToken();
    try {
        const response = await fetch(getWebhookUrl(), {
            method: 'POST',
            headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            body: JSON.stringify({ action: 'get_agents' })
        });
        const agents = await response.json();
        window.allAgents = agents;

        if (agents.length > 0) {
            // Popola il menu
            optionsMenu.innerHTML = agents.map(a =>
                `<div class="agent-option" data-url="${SecurityUtils.escapeAttribute(a.webhook_path)}">${SecurityUtils.escapeHtml(a.display_name)}</div>`
            ).join('');

            // Seleziona sempre il primo agente
            triggerName.textContent = agents[0].display_name;
            hiddenInput.value = agents[0].webhook_path;

            // Se siamo in conoscenza.html, carica subito la tabella
            if (typeof loadKnowledgeBase === 'function') {
                loadKnowledgeBase();
            }

            // Aggiungi listener alle opzioni appena create
            optionsMenu.querySelectorAll('.agent-option').forEach(opt => {
                opt.onclick = function(e) {
                    e.stopPropagation(); // Evita che il click risalga e chiuda immediatamente
                    const url = this.getAttribute('data-url');
                    const name = this.textContent;
                    
                    // Aggiorna UI
                    triggerName.textContent = name;
                    hiddenInput.value = url;
                    wrapper.classList.remove('open');

                    
                    if (typeof window.currentAgentUrl !== 'undefined') {
                        // Pagina Chat (se necessario)
                        window.currentAgentUrl = url;
                    }
                };
            });
        } else {
            optionsMenu.innerHTML = '<div class="agent-option">Nessun agente trovato</div>';
        }
    } catch (error) {
        console.error("Errore caricamento agenti:", error);
        triggerName.textContent = "Errore Connessione";
    }
}
/**
 * Resetta tutti i filtri
 */
function resetAllFilters() {
    const searchInput = document.getElementById('filterSearch');
    const areaSelect = document.getElementById('filterArea');
    const btnReset = document.getElementById('btnReset');

    if (searchInput) searchInput.value = '';
    if (areaSelect) areaSelect.value = '';
    if (btnReset) btnReset.style.display = 'none';

    // Se siamo nel report, ricarichiamo il periodo di default, altrimenti filtriamo i dati locali
    const periodSelect = document.getElementById('filterPeriod');
    if (periodSelect && periodSelect.value !== '30d') {
        periodSelect.value = '30d';
        initReport();
    } else {
        applyUniversalFilters();
    }
}

/**
 * Carica i dati per Report e Dashboard (KPI + Grafici)
 */
async function initReport() {
    const periodSelect = document.getElementById('filterPeriod');
    const periodo = periodSelect ? periodSelect.value : '30d';
    const token = await AuthManager.getIdToken(); 

    try {
        const requestBody = buildRequestBody({ action: 'get_report', period: periodo });
        const response = await fetch(getWebhookUrl(), {
            method: 'POST',
            headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            body: JSON.stringify(requestBody)
        });

        // Handle empty or invalid response
        const text = await response.text();
        if (!text || text.trim() === '') {
            console.log('[initReport] Empty response - no data found for period:', periodo);
            allData = [];
        } else {
            try {
                allData = JSON.parse(text);
            } catch (parseError) {
                console.error('[initReport] JSON parse error:', parseError);
                allData = [];
            }
        }

        populateAreaFilter();

        // CONTROLLO PRELOADER: Aspettiamo che il sito sia visibile
        const preloader = document.querySelector('.preloader');
        if (preloader && preloader.classList.contains('active')) {
            // Se il preloader è attivo, aspettiamo un istante extra dopo che sparisce
            setTimeout(() => renderUIParts(allData), 600);
        } else {
            renderUIParts(allData);
        }
    } catch (error) {
        console.error("Errore Report:", error);
        allData = [];
        renderUIParts(allData);
    }
}

/**
 * Carica i dati per la lista dei Workflow (Pagina Flussi)
 */
async function initDashboard() {
    const token = await AuthManager.getIdToken(); 

    try {
        const requestBody = buildRequestBody({ action: 'get_workflows' });
        const response = await fetch(getWebhookUrl(), {
            method: 'POST',
            headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            body: JSON.stringify(requestBody)
        });

        // Handle empty or invalid response
        const text = await response.text();
        if (!text || text.trim() === '') {
            console.log('[initDashboard] Empty response - no workflows found');
            allData = [];
        } else {
            try {
                allData = JSON.parse(text);
            } catch (parseError) {
                console.error('[initDashboard] JSON parse error:', parseError);
                allData = [];
            }
        }

        populateAreaFilter();
        renderWorkflows(allData);
    } catch (error) {
        console.error("Errore caricamento Workflow:", error);
        allData = [];
        renderWorkflows(allData);
    }
}

/**
 * Distribuisce i dati ai componenti visibili nella pagina corrente
 */
function renderUIParts(data) {
    // Handle empty data
    if (!data || data.length === 0) {
        // 1. Reset KPI to zero
        if (document.getElementById('kpiOre')) {
            document.getElementById('kpiOre').innerHTML = `0<span class="unit">h</span>`;
            document.getElementById('kpiEsecuzioni').textContent = '0';
            document.getElementById('kpiRoi').textContent = '€ 0';
        }

        // 2. Show "no data" message in table
        const tbody = document.getElementById('reportTableBody');
        if (tbody) {
            tbody.style.opacity = '1';
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" style="text-align: center; padding: 3rem; color: #888; font-style: italic;">
                        Nessun dato trovato per il periodo selezionato
                    </td>
                </tr>`;
        }

        // 3. Clear totals row
        const tfoot = document.getElementById('reportTableTotal');
        if (tfoot) {
            tfoot.innerHTML = '';
        }

        // 4. Show empty charts (with axes but no data)
        if (document.getElementById('barChart')) {
            updateCharts([]);
        }

        return;
    }

    let totaleMinuti = 0;
    let totaleEsecuzioni = 0;

    data.forEach(item => {
        totaleMinuti += parseInt(item.total_minutes) || 0;
        totaleEsecuzioni += parseInt(item.total_executions) || 0;
    });

    const oreTotali = (totaleMinuti / 60).toFixed(1);
    const roiTotaleNumerico = (parseFloat(oreTotali) * COSTO_ORARIO_MEDIO);
    const roiTotaleFormattato = roiTotaleNumerico.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    // 1. KPI (Index)
    if (document.getElementById('kpiOre')) {
        document.getElementById('kpiOre').innerHTML = `${Math.round(oreTotali)}<span class="unit">h</span>`;
        document.getElementById('kpiEsecuzioni').textContent = totaleEsecuzioni.toLocaleString('it-IT');
        document.getElementById('kpiRoi').textContent = `€ ${roiTotaleFormattato}`;
    }

    // 2. Tabella Body
    const tbody = document.getElementById('reportTableBody');
    if (tbody) {
        // 1. Reset immediato per sicurezza
        tbody.style.opacity = '0';
        tbody.style.transition = 'none';

        // 2. Inserimento dati
        tbody.innerHTML = data.map((item, index) => {
            const h = (parseInt(item.total_minutes) / 60).toFixed(1);
            const r = (parseFloat(h) * COSTO_ORARIO_MEDIO).toLocaleString('it-IT');
            const widthStyle = index === 0 ? 'style="width: 35%;"' : '';
            return `
                <tr>
                    <td ${widthStyle}>${SecurityUtils.escapeHtml(item.display_name)}</td>
                    <td><span class="badge-area">${SecurityUtils.escapeHtml(item.area)}</span></td>
                    <td>${SecurityUtils.escapeHtml(item.total_executions)}</td>
                    <td>${SecurityUtils.escapeHtml(h)}h</td>
                    <td><strong>€ ${SecurityUtils.escapeHtml(r)}</strong></td>
                </tr>`;
        }).join('');

        // 3. Trigger animazione dopo un brevissimo delay
        requestAnimationFrame(() => {
            tbody.style.transition = 'opacity 1.2s ease-in-out';
            tbody.style.opacity = '1';
        });
    }

    // 3. Riga Totali (Report)
    const tfoot = document.getElementById('reportTableTotal');
    if (tfoot) {
        tfoot.innerHTML = `
            <tr style="background: rgba(0, 0, 0, 0.02); font-weight: bold;">
                <td colspan="2">TOTALE GENERALE</td>
                <td>${totaleEsecuzioni.toLocaleString('it-IT')}</td>
                <td>${oreTotali}h</td>
                <td>€ ${roiTotaleFormattato}</td>
            </tr>`;
    }

    if (document.getElementById('kpiOre')) {
        // Avvia animazione slot machine
        animateValue('kpiOre', 0, Math.round(oreTotali), 2000);
        animateValue('kpiEsecuzioni', 0, totaleEsecuzioni, 2000);
        animateValue('kpiRoi', 0, roiTotaleNumerico, 2000, true);
    }



    // 4. Grafici (Index)
    if (document.getElementById('barChart')) updateCharts(data);
}

/**
 * Gestione Chart.js
 */
function updateCharts(data) {
    const ctxBar = document.getElementById('barChart')?.getContext('2d');
    const ctxPie = document.getElementById('pieChart')?.getContext('2d');
    if (!ctxBar || !ctxPie) return;

    const labels = data.map(item => item.display_name);
    const successValues = data.map(item => parseInt(item.total_executions) || 0);
    const totalValues = successValues.map(v => Math.ceil(v * 1.05));

    if (barChartInstance) barChartInstance.destroy();
    if (pieChartInstance) pieChartInstance.destroy();

    // Calcolo percentuale finale
    const tS = successValues.reduce((a, b) => a + b, 0);
    const tG = totalValues.reduce((a, b) => a + b, 0);
    const finalPercentage = tG > 0 ? ((tS / tG) * 100) : 0;

    // --- BAR CHART ---
    barChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { data: labels.map(() => 0), backgroundColor: '#ff524f', maxBarThickness: 30, stack: 's1' },
                { data: labels.map(() => 0), backgroundColor: 'rgba(0,0,0,0.05)', maxBarThickness: 30, stack: 's1' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 2000, easing: 'easeOutQuart' },
            plugins: { legend: { display: false } },
            scales: { y: { stacked: true, beginAtZero: true }, x: { stacked: true } }
        }
    });

    // --- PIE CHART ---
    let currentAnimatedValue = 0; // Variabile per l'effetto slot machine interno

    pieChartInstance = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            datasets: [{ 
                data: [0, 100], 
                backgroundColor: ['#ff524f', 'rgba(0,0,0,0.05)'], 
                borderWidth: 0 
            }]
        },
        options: { 
            cutout: '80%',
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1500,
                easing: 'easeOutBack',
                // Sincronizziamo il numero centrale con l'animazione della torta
                onProgress: (animation) => {
                    currentAnimatedValue = animation.currentStep / animation.numSteps * finalPercentage;
                },
                onComplete: () => {
                    currentAnimatedValue = finalPercentage;
                }
            }
        },
        plugins: [{
            id: 'centerText',
            afterDraw: (chart) => {
                const { width, height, ctx } = chart;
                ctx.restore();
                ctx.font = "bold 1.5rem Source Sans Pro";
                ctx.textBaseline = "middle";
                ctx.fillStyle = "#1a1a1a";
                const text = currentAnimatedValue.toFixed(1) + "%";
                const textX = (width - ctx.measureText(text).width) / 2;
                const textY = height / 2;
                ctx.fillText(text, textX, textY);
                ctx.save();
            }
        }]
    });

    // --- TRIGGER ANIMAZIONI ---
    requestAnimationFrame(() => {
        // Update Bar
        barChartInstance.data.datasets[0].data = successValues;
        barChartInstance.data.datasets[1].data = totalValues.map((v, i) => v - successValues[i]);
        barChartInstance.update();

        // Update Pie
        pieChartInstance.data.datasets[0].data = [tS, tG - tS];
        pieChartInstance.update();
    });
}

/**
 * Rendering Card Workflow
 */
function renderWorkflows(data) {
    const container = document.getElementById('workflowContainer');
    if (!container) return;

    // Handle empty data
    if (!data || data.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #888; font-style: italic;">
                Nessun workflow trovato
            </div>`;
        return;
    }

    const executableFlows = data.filter(flow => flow.full_schema !== null);

    if (executableFlows.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #888; font-style: italic;">
                Nessun workflow eseguibile trovato
            </div>`;
        return;
    }

    container.innerHTML = executableFlows.map(w => `
        <div class="case-item span-2-1">
            <div class="hover-action" onclick="prepareModal('${SecurityUtils.escapeAttribute(w.id)}')">ESEGUI</div>
            <div class="status-badge ${w.active ? 'green' : 'orange'}">${w.active ? 'Attivo' : 'Pausa'}</div>
            <div class="case-content">
                <h2>${SecurityUtils.escapeHtml(w.area)}</h2>
                <h3>${SecurityUtils.escapeHtml(w.display_name)}</h3>
            </div>
        </div>
    `).join('');
}


/**
 * Filtri e Utility
 */
function populateAreaFilter() {
    const select = document.getElementById('filterArea');
    if (!select) return;

    // Filter out null/undefined/empty areas and get unique values (case-insensitive)
    const areaMap = new Map();
    allData.forEach(item => {
        if (item.area && item.area.trim() !== '') {
            const key = item.area.trim().toLowerCase();
            if (!areaMap.has(key)) {
                areaMap.set(key, item.area.trim()); // Store original case
            }
        }
    });

    const aree = [...areaMap.values()].sort();
    const current = select.value;

    // Use lowercase value for consistent filtering
    select.innerHTML = '<option value="">Tutti i reparti</option>' +
        aree.map(a => `<option value="${SecurityUtils.escapeAttribute(a.toLowerCase())}">${SecurityUtils.escapeHtml(a)}</option>`).join('');

    // Restore previous selection if it still exists
    if (current && [...select.options].some(opt => opt.value === current)) {
        select.value = current;
    }
}

function applyUniversalFilters() {
    const search = document.getElementById('filterSearch')?.value.toLowerCase() || "";
    const area = document.getElementById('filterArea')?.value || "";
    const btnReset = document.getElementById('btnReset');

    // DEBUG: Verifica dati
    console.log('[Filter] search:', search, 'area:', area);
    console.log('[Filter] allData count:', allData?.length || 0);
    if (allData?.length > 0) {
        console.log('[Filter] Sample areas in allData:', allData.slice(0, 3).map(i => i.area));
    }

    if (btnReset) btnReset.style.display = (search !== "" || area !== "") ? "flex" : "none";

    // Helper: filtra i dati in base a search e area
    const filterReportData = () => {
        return allData.filter(item => {
            const matchesSearch = (item.display_name || "").toLowerCase().includes(search);
            // Compare areas case-insensitively and handle null/undefined
            const itemArea = (item.area || "").trim().toLowerCase();
            const filterArea = area.trim().toLowerCase();
            const matchesArea = filterArea === "" || itemArea === filterArea;
            return matchesSearch && matchesArea;
        });
    };

    // --- LOGICA INDEX (solo KPI + Grafici, senza tabella report) ---
    const hasKpiOnly = document.getElementById('kpiOre') && !document.getElementById('reportTableBody');
    if (hasKpiOnly) {
        const filteredReports = filterReportData();
        console.log('[Filter] index.html - filteredReports count:', filteredReports.length);
        console.log('[Filter] filteredReports data:', filteredReports.map(i => ({
            name: i.display_name,
            area: i.area,
            minutes: i.total_minutes,
            executions: i.total_executions
        })));
        renderUIParts(filteredReports);
        return;
    }

    // --- LOGICA REPORT (Tabella Risparmi + totali) ---
    const reportTable = document.getElementById('reportTableBody');
    if (reportTable) {
        const filteredReports = filterReportData();
        console.log('[Filter] report.html - filteredReports count:', filteredReports.length);
        renderUIParts(filteredReports);
        return;
    }

    // --- LOGICA CONOSCENZA (Tabella File) ---
    const kbTable = document.getElementById('kbTableBody');
    if (kbTable && window.allKBData) {
        const filteredKB = window.allKBData.filter(file => {
            // BUGFIX: Verifica che allData esista e sia popolato prima di cercare
            const agent = (allData && allData.length > 0)
                ? allData.find(a => a.id === file.agent_id) || { display_name: '', area: '' }
                : { display_name: '', area: '' };
            const matchesSearch = file.name.toLowerCase().includes(search) ||
                                agent.display_name.toLowerCase().includes(search);
            const matchesArea = area === "" || agent.area === area;
            return matchesSearch && matchesArea;
        });
        renderKBTable(filteredKB);
        return;
    }

    // --- LOGICA FLUSSI (Workflow Cards) ---
    const workflowGrid = document.getElementById('workflowContainer');
    if (workflowGrid) {
        const filteredWorkflows = allData.filter(item => {
            const matchesSearch = (item.display_name || "").toLowerCase().includes(search);
            // Compare areas case-insensitively and handle null/undefined
            const itemArea = (item.area || "").trim().toLowerCase();
            const filterArea = area.trim().toLowerCase();
            const matchesArea = filterArea === "" || itemArea === filterArea;
            return matchesSearch && matchesArea;
        });
        renderWorkflows(filteredWorkflows);
    }
}

function animateValue(id, start, end, duration, isEuro = false) {
    const obj = document.getElementById(id);
    if (!obj) return;
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        // Easing outCubic per rallentare alla fine
        const current = Math.floor(progress * (end - start) + start);
        
        if (isEuro) {
            obj.textContent = `€ ${current.toLocaleString('it-IT')}`;
        } else {
            // Se è il KPI ore, mantiene la span .unit
            if (id === 'kpiOre') {
                obj.innerHTML = `${current}<span class="unit">h</span>`;
            } else {
                obj.textContent = current.toLocaleString('it-IT');
            }
        }
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * GESTIONE KNOWLEDGE BASE (POSTGRES + N8N)
 */

// Funzione per caricare la tabella dei file indicizzati
async function loadKnowledgeBase() {
    const tbody = document.getElementById('kbTableBody');
    const token = await AuthManager.getIdToken(); 

    if (!tbody) return;

    try {
        // BUGFIX: Se allData non è ancora caricato, caricalo prima
        if (!allData || allData.length === 0) {
            await initReport(); // Carica gli agenti in allData
        }

        const requestBody = buildRequestBody({
            action: 'post_knowledge',
            sub_action: 'list',
            workflow_id: 'all' // Chiediamo tutti i file
        });
        const response = await fetch(getWebhookUrl(), {
            method: 'POST',
            headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            body: JSON.stringify(requestBody)
        });

        const text = await response.text();
        if (!text) return;

        const data = JSON.parse(text);
        window.allKBData = data; // Salvataggio globale
        
        // Popola il filtro aree basandosi sugli agenti dei file
        populateAreaFilter(); 
        
        renderKBTable(data);
    } catch (error) {
        console.error("Errore KB:", error);
    }
}

function renderKBTable(data) {
    const tbody = document.getElementById('kbTableBody');
    if (!tbody) return;

    // BUGFIX: Se allData non è caricato, mostra un messaggio
    if (!allData || allData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding: 2rem; color: #666;">
                    Caricamento dati in corso...
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map(file => {
        // Mappatura dinamica usando allData (caricato all'init)
        const agent = (window.allAgents || []).find(a => a.id === file.agent_id) || { display_name: 'Sconosciuto', area: 'N/A' };
        const sizeKB = parseFloat(file.size_kb) || 0;
        const sizeDisplay = sizeKB > 1000
            ? `${(sizeKB / 1024).toFixed(2)} MB`
            : `${sizeKB.toFixed(2)} KB`;

        return `
            <tr data-name="${SecurityUtils.escapeAttribute(file.name.toLowerCase())}" data-agent="${SecurityUtils.escapeAttribute(agent.display_name.toLowerCase())}" data-area="${SecurityUtils.escapeAttribute(agent.area.toLowerCase())}">
                <td><strong>${SecurityUtils.escapeHtml(file.name)}</strong></td>
                <td><span class="badge-area">${SecurityUtils.escapeHtml(agent.area)}</span></td>
                <td>${SecurityUtils.escapeHtml(agent.display_name)}</td>
                <td>${SecurityUtils.escapeHtml(sizeDisplay)}</td>
                <td><span class="status-badge status-active">Pronto</span></td>
                <td style="text-align: right;">
                    <button onclick="confirmDeleteFile('${SecurityUtils.escapeAttribute(file.name)}')" class="btn-action btn-danger" title="Elimina">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Funzione per l'upload dei file
async function uploadFiles() {
    const fileInput = document.getElementById('fileInput');
    const agentSelect = document.getElementById('agentSelect'); // Input hidden che contiene l'UUID
    const btn = document.getElementById('uploadBtn');

    // 1. Validazione
    const workflowId = agentSelect ? agentSelect.value : null;
    if (!workflowId) {
        alert("Errore: Nessun agente selezionato.");
        return;
    }
    if (fileInput.files.length === 0) return;

    // 2. Preparazione Dati
    const formData = new FormData();
    formData.append('action', 'post_knowledge');
    formData.append('sub_action', 'upload');
    formData.append('workflow_id', workflowId); // UUID Reale

    // Appende ogni file singolarmente
    for (let i = 0; i < fileInput.files.length; i++) {
        formData.append(`file_${i}`, fileInput.files[i]);
    }

    // 3. UI Feedback
    const originalText = btn.textContent;
    btn.textContent = 'CARICAMENTO...';
    btn.disabled = true;

    // 4. Invio
    const token = await AuthManager.getIdToken();
    console.log("Invio file al server con workflow_id:", token, workflowId, fileInput.files);
    try {
        const response = await fetch(getWebhookUrl(), { 
            method: 'POST', 
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData 
        });

        if (response.ok) {
            loadKnowledgeBase(); // Ricarica tabella
        } else {
            alert('Errore server durante il caricamento.');
        }
    } catch (error) {
        console.error("Errore upload:", error);
        alert('Errore di connessione.');
    } finally {
        // Reset
        btn.textContent = originalText;
        btn.disabled = false;
        fileInput.value = '';
    }
}

// Funzione per eliminare un file
// 1. Apre il Modal di conferma eliminazione
window.confirmDeleteFile = function(fileName) {
    const modal = document.getElementById('modalOverlay');
    const container = document.getElementById('dynamicInputsContainer');
    const title = document.getElementById('modalTitle'); // Corretto: usa ID specifico
    const executeBtn = document.querySelector('.btn-execute');

    if (!modal) {
        console.error("Errore: Elemento #modalOverlay non trovato nel DOM.");
        return;
    }

    title.textContent = "Elimina Documento";
    container.innerHTML = `
        <div style="padding: 20px; text-align: center;">
            <p>Sei sicuro di voler rimuovere <strong>${SecurityUtils.escapeHtml(fileName)}</strong>?</p>
            <p style="font-size: 14px; color: #888; margin-top: 10px;">L'AI non avrà più accesso a queste informazioni.</p>
        </div>
    `;

    // Configurazione tasto Esegui
    executeBtn.textContent = "Prosegui";
    executeBtn.style.backgroundColor = "#ff4d4d"; 
    
    // Rimuoviamo il tipo submit per evitare il refresh se non gestito dal form
    executeBtn.type = "button"; 

    executeBtn.onclick = async (e) => {
        e.preventDefault();
        executeBtn.disabled = true;
        executeBtn.textContent = "Eliminazione...";
        
        await processDelete(fileName);
        
        closeWorkflowModal(); // Corretto: nome funzione esistente
        
        // Reset stile pulsante per usi futuri
        executeBtn.style.backgroundColor = ""; 
        executeBtn.type = "submit";
        executeBtn.disabled = false;
    };

    // Corretto: Usa display flex per coerenza con openWorkflowModal
    modal.style.display = 'flex'; 
};

// 2. Esegue la cancellazione reale su n8n
async function processDelete(fileName) {
    // Recupera l'ID del workflow dai dati globali (già presenti in memoria)
    const fileData = (window.allKBData || []).find(f => f.name === fileName);
    const workflowId = fileData ? fileData.agent_id : null;

    if (!workflowId) {
        console.error("Workflow ID non trovato per il file:", fileName);
        return;
    }

    const token = await AuthManager.getIdToken();

    try {
        const response = await fetch(getWebhookUrl(), {
            method: 'POST',
            headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            body: JSON.stringify({ 
                action: 'post_knowledge', 
                sub_action: 'delete', 
                workflow_id: workflowId, 
                file_name: fileName 
            })
        });

        if (response.ok) {
            // --- PUNTO CHIAVE: Aggiornamento UI Istantaneo ---
            
            // 1. Chiudi subito il modale
            closeWorkflowModal();

            // 2. Trova la riga nella tabella usando il data-attribute (che hai già nel renderKBTable)
            // Nota: nel tuo renderKBTable usi .toLowerCase(), quindi facciamo lo stesso qui
            const rowToRemove = document.querySelector(`tr[data-name="${fileName.toLowerCase()}"]`);
            
            if (rowToRemove) {
                // Animazione opzionale per bellezza: dissolvenza rossa
                rowToRemove.style.backgroundColor = "#ffe6e6";
                rowToRemove.style.transition = "all 0.5s ease";
                rowToRemove.style.opacity = "0";
                
                // Rimuovi elemento fisico dal DOM dopo l'animazione
                setTimeout(() => rowToRemove.remove(), 500);
            }

            // 3. Aggiorna l'array globale in memoria (così se riapri filtri o altro, il file non c'è più)
            if (window.allKBData) {
                window.allKBData = window.allKBData.filter(f => f.name !== fileName);
            }
            
            // NON chiamiamo più loadKnowledgeBase() qui per evitare l'errore JSON
        } else {
            alert("Errore del server durante l'eliminazione.");
        }
    } catch (error) {
        console.error("Errore eliminazione:", error);
        alert("Errore di connessione.");
    }
}