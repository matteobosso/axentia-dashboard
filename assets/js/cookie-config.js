window.addEventListener('load', function () {
    var cc = initCookieConsent();

    cc.run({
        current_lang: 'it',
        autoclear_cookies: true,
        page_scripts: true,

        // Configurazione estetica Minimal
        gui_options: {
        consent_modal: {
                layout: 'cloud',
                position: 'bottom center',
                transition: 'slide',
                swap_buttons: false
            }
        },

        onAccept: function () {
            // Sposta il focus sul body o su un elemento neutro per "liberare" lo span
            document.body.focus();

            if (cc.allowedCategory('analytics')) {
                if(typeof window.enableFirebaseAnalytics === 'function') {
                    window.enableFirebaseAnalytics();
                }
            }
        },

        languages: {
            'it': {
                consent_modal: {
                    title: 'Cookie',
                    description: 'Usiamo i cookie per migliorare la tua esperienza.',
                    primary_btn: { text: 'Accetta', role: 'accept_all' },
                    secondary_btn: { text: 'Impostazioni', role: 'settings' }
                },
                settings_modal: {
                    title: 'Preferenze Cookie',
                    save_settings_btn: 'Salva',
                    accept_all_btn: 'Accetta tutti',
                    blocks: [
                        {
                            title: 'Cookie Necessari',
                            description: 'Essenziali per il form contatti.',
                            toggle: { value: 'necessary', enabled: true, readonly: true }
                        },
                        {
                            title: 'Cookie Analitici',
                            description: 'Statistiche anonime di visita.',
                            toggle: { value: 'analytics', enabled: false, readonly: false }
                        }
                    ]
                }
            }
        }
    });
});