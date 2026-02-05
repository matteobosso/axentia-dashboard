document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const fileInput = document.getElementById('chat-file');
    const filePreview = document.getElementById('file-preview');
    const fileNameSpan = document.getElementById('filename');
    const removeFileBtn = document.getElementById('remove-file');
    const agentSelect = document.getElementById('agent-type');

    let isTyping = false;

    // --- GESTIONE SESSIONE ---
    let sessionId = localStorage.getItem('chat_session_id');
    if (!sessionId) {
        sessionId = SecurityUtils.generateSecureId();
        localStorage.setItem('chat_session_id', sessionId);
    }

    const toggleTypingIndicator = (show) => {
        let indicator = document.getElementById('typing-indicator');
        
        if (show) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'typing-indicator';
                indicator.classList.add('typing-indicator'); // Usa la tua classe CSS
                indicator.innerHTML = `
                    <span></span>
                    <span></span>
                    <span></span>
                `;
                chatMessages.appendChild(indicator);
            }
            scrollToBottom();
        } else if (indicator) {
            indicator.remove();
        }
    };

    const scrollToBottom = () => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    };

    // Gestione File Preview
    fileInput.addEventListener('change', () => {
        if (isTyping) return;
        if (fileInput.files.length > 0) {
            fileNameSpan.textContent = fileInput.files[0].name;
            filePreview.style.display = 'block';
        }
    });

    removeFileBtn.addEventListener('click', () => {
        if (isTyping) return;
        fileInput.value = "";
        filePreview.style.display = 'none';
    });

    const createMessageHTML = (text, type, fileName = null) => {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type);

        // Uniformiamo la struttura: entrambi i messaggi vengono avvolti in tag <p>
        // L'assistente lo fa tramite marked.parse, l'utente lo facciamo manualmente
        let contentHTML = type === 'assistant' ? marked.parse(text) : `<p>${SecurityUtils.escapeHtml(text)}</p>`;

        let fileHTML = '';
        if (fileName) {
            fileHTML = `
                <div class="file-attachment-inline">
                    <span>📄</span>
                    <span>${SecurityUtils.escapeHtml(fileName)}</span>
                </div>`;
        }

        const name = type === 'user' ? 'Tu' : 'Agente AI';
        messageDiv.innerHTML = `
            <p><strong>${name}</strong></p>
            <div class="msg-content">
                ${fileHTML}
                <div class="text-payload">${contentHTML}</div>
            </div>
        `;

        // Rendering LaTeX e Prism (solo se necessario, ma gestito in sicurezza)
        setTimeout(() => {
            // Applica stili al codice solo se presenti
            if (messageDiv.querySelector('code')) {
                Prism.highlightAllUnder(messageDiv);
            }
            
            // Renderizza LaTeX
            renderMathInElement(messageDiv, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
            });
        }, 0);

        return messageDiv;
    };

    const setInputState = (loading) => {
        isTyping = loading;
        if (userInput) {
            userInput.disabled = loading;
            userInput.placeholder = loading ? "L'agente sta scrivendo..." : "Invia un comando...";
        }
        if (sendBtn) {
            sendBtn.disabled = loading;
            sendBtn.style.opacity = loading ? "0.5" : "1";
        }
        // Rimosso agentSelect.disabled perché ora usi un dropdown custom
    };

    const sendMessage = async () => {
        if (isTyping) return;

        const text = userInput.value.trim();
        const file = fileInput.files.length > 0 ? fileInput.files[0] : null;
        
        // Recupera il path (es. "chat") dall'input hidden
        const webhookPath = document.getElementById('agentSelect').value;
        // Costruisce l'URL completo usando AuthManager per endpoint dinamico
        const fullUrl = typeof AuthManager !== 'undefined'
            ? AuthManager.getWebhookUrl(webhookPath)
            : `https://main-n8n.axentia-automation.it/webhook/${webhookPath}`;

        if (!text && !file) return;
        if (!webhookPath) return console.error("Agente non configurato");

        const userMsg = createMessageHTML(text, 'user', file ? file.name : null);
        chatMessages.appendChild(userMsg);

        // Reset UI
        userInput.value = '';
        fileInput.value = '';
        if(filePreview) filePreview.style.display = 'none';
        
        scrollToBottom();
        setInputState(true); // Qui scattava l'errore
        toggleTypingIndicator(true);

        try {
            const formData = new FormData();
            formData.append('chatInput', text);
            formData.append('sessionId', sessionId);
            if (file) formData.append('file', file);

            const response = await fetch(fullUrl, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`Errore: ${response.status}`);

            const data = await response.json();
            toggleTypingIndicator(false);
            const result = Array.isArray(data) ? data[0] : data;
            const botResponse = result.output || result.text || "Risposta non valida.";

            chatMessages.appendChild(createMessageHTML(botResponse, 'assistant'));
        } catch (error) {
            toggleTypingIndicator(false);
            chatMessages.appendChild(createMessageHTML("Errore di connessione.", 'assistant'));
        } finally {
            setInputState(false);
            scrollToBottom();
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    scrollToBottom();
});