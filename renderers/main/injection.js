// injection.js

// Status messages.
const msgDB = {
    es: {
        rest: 'Vuelves a tener conexión',
        lost: 'No tienes conexión'
    },
    en: {
        rest: "You're back online",
        lost: "You're offline"
    }
};

let msg = msgDB.en;
Object.keys(msgDB).forEach(lang => {
    if (lang === navigator.language) msg = msgDB[lang];
});

/**
 * Override visibility change events so that playback isn’t interrupted when the window loses focus.
 */
const visibilityChangeOverriding = () => {
    document.addEventListener('webkitvisibilitychange', event => {
        event.stopImmediatePropagation();
    }, true);
    document.addEventListener('visibilitychange', event => {
        event.stopImmediatePropagation();
    }, true);
};

/**
 * Observe title changes and reset to "YouTube TV" if changed.
 */
const observeTitleChanges = () => {
    document.title = 'YouTube TV';
    const obs = new MutationObserver(() => {
        if (document.title === 'YouTube TV') return;
        document.title = 'YouTube TV';
    });
    obs.observe(document.querySelector('title'), { attributes: true, subtree: true, childList: true });
};

const loadConnectionWarnings = () => {
    // Connection restored.
    const rest = document.createElement('div');
    // Connection lost.
    const lost = document.createElement('div');
    
    rest.innerHTML = `<p>${ msg.rest }</p>`;
    lost.innerHTML = `<p>${ msg.lost }</p>`;

    const styles = document.createElement('style');
    
    // Updated CSS: use fixed positioning for persistent bottom placement.
    styles.innerHTML = `
        .warning {
            position: fixed;
            left: 50%;
            bottom: 0;
            width: 100%;
            transform: translate(-50%, 100%);
            transition: transform 0.2s ease-out;
            will-change: transform;
            text-align: center;
            z-index: 9999;
        }
        .warning > p {
            margin: 10px 0;
            font-weight: 500;
        }
        .rest { background: #009D32; }
        .lost { background: red; }
        .visible { transform: translate(-50%, 0%); }
    `;

    rest.classList.add('warning', 'rest');
    lost.classList.add('warning', 'lost');
    rest.id = 'rest';
    lost.id = 'lost';

    document.body.appendChild(rest);
    document.body.appendChild(lost);
    document.body.appendChild(styles);
};

const loadConnectionEvents = () => {
    window.ipc = window.require('electron').ipcRenderer;
    const rest = document.getElementById('rest');
    const lost = document.getElementById('lost');

    window.addEventListener('online', () => {
        lost.classList.remove('visible');
        rest.classList.add('visible');
        window.ipc.send('network', 'online');
        setTimeout(() => { rest.classList.remove('visible'); }, 5000);
    });

    window.addEventListener('offline', () => {
        rest.classList.remove('visible');
        lost.classList.add('visible');
        window.ipc.send('network', 'offline');
        setTimeout(() => { lost.classList.remove('visible'); }, 5000);
    });
};

const listenLocalStorageQueries = () => {
    window.ipc.on('localStorageQuery', (event, { type, data }) => {
        const inf = window.localStorage.getItem(data);
        event.sender.send('localStorageQueryResponse', inf);
    });
};

visibilityChangeOverriding();
observeTitleChanges();
loadConnectionWarnings();
loadConnectionEvents();
listenLocalStorageQueries();

console.log('JavaScript enhancements loaded at', new Date(Date.now()).toISOString());
