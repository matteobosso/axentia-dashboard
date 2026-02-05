(function() {
    "use strict";
  
    const app = {
        // Configurazione URL n8n
        N8N_WEBHOOK_URL: "https://n8n.axentia-automation.it/webhook/axentia-contatti",

        init: () => {
            app.setUpListeners();
            app.textarea.init();
            console.log("Axentia Form: Sistema inizializzato con n8n.");
        },

        DEFAULT_CONFIG: {
            classTo: 'form-field',
            errorClass: 'error',
            successClass: 'success',
            errorTextParent: 'form-field',
            errorTextTag: 'div',
            errorTextClass: 'pristine-error'
        },

        setUpListeners: () => {
            const forms = document.querySelectorAll("form");
            forms.forEach(item => { 
                item.addEventListener('focus', app.formFields.focus, true);
                item.addEventListener("blur", app.formFields.blur, true);
                item.addEventListener('submit', app.handleSubmit, false);
            });
        },

        handleSubmit: async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const formOuter = form.closest(".form-outer");

            // 1. Validazione Pristine
            if (typeof Pristine === 'undefined') return;
            const pristine = new Pristine(form, app.DEFAULT_CONFIG);
            if (!pristine.validate()) return;

            // 2. Attivazione Loader
            let ajaxLoader = form.querySelector(".ajax-loader");
            if (ajaxLoader) ajaxLoader.classList.add("active");

            // 3. Raccolta Dati
            let data = {};
            form.querySelectorAll('.form-control').forEach(field => {
                const key = field.getAttribute('name') || field.id;
                if (key) data[key] = (field.type === 'checkbox') ? field.checked : field.value;
            });
            data.createdAt = new Date().toISOString();

            try {
                // 4. Invio a FIRESTORE (se configurato)
                if (window.addDoc && window.db) {
                    await window.addDoc(window.collection(window.db, "contacts"), data);
                }

                // 5. Invio a n8n (Email Automation)
                // Usiamo fetch senza await per non bloccare l'utente se n8n è lento
                fetch(app.N8N_WEBHOOK_URL, {
                    method: 'POST',
                    mode: 'no-cors', // Importante per GitHub Pages -> n8n
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                // 6. Gestione Successo UI
                const formVisible = formOuter.querySelector(".form-success-visible");
                const formHidden = formOuter.querySelector(".form-success-hidden");

                if(formVisible) formVisible.style.display = 'none';
                if(formHidden) {
                    formHidden.style.display = 'block';
                    formHidden.classList.add("visible");
                }
                
                form.reset();
                pristine.reset();

            } catch (error) {
                console.error("Errore durante l'invio:", error);
                alert("Si è verificato un errore. Riprova.");
            } finally {
                if (ajaxLoader) ajaxLoader.classList.remove("active");
            }
        },

        formFields: {
            focus: e => {
                const target = e.target;
                if(['input', 'textarea'].includes(target.tagName.toLowerCase())) {
                    const parent = target.closest('.form-field');
                    if(parent) parent.classList.add("focus");
                }
            },
            blur: e => {
                const target = e.target;
                if(['input', 'textarea'].includes(target.tagName.toLowerCase()) && target.value === "") {
                    const parent = target.closest('.form-field');
                    if(parent) parent.classList.remove("focus");
                }
            },
        },

        textarea: {
            init: () => {
                document.querySelectorAll("textarea").forEach(item => {
                    item.style.overflow = 'hidden';
                    item.addEventListener('input', () => {
                        item.style.height = 'auto';
                        item.style.height = (item.scrollHeight + 1) + 'px';
                    });
                });
            }
        }
    };

    // Partenza immediata al caricamento
    if (document.readyState === "complete") {
        app.init();
    } else {
        window.addEventListener('load', app.init);
    }

}());