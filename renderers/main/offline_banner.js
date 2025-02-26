// offline_banner.js
const ipc = window.require('electron').ipcRenderer;
const styles = document.createElement('style');
const bannerContainer = document.createElement('div');
const offlinePicture = document.createElement('div');
const offlineMessage = document.createElement('div');
const offlineDescription = document.createElement('div');

const msgDB = {
    en: {
        msg: "You're offline",
        des: 'It seems that the connection to the YouTube servers cannot be established.<br>Please check your connection, routers, and other network settings.<br>We will automatically try again once connectivity is detected.'
    },
    es: {
        msg: 'No tienes conexión',
        des: 'Parece que no se puede establecer la conexión con los servidores de YouTube.<br>Comprueba la conexión, así como los parámetros, enrutadores y concentradores.<br>Cuando se detecte conectividad, volveremos a intentarlo automáticamente.'
    }
};

let msg = msgDB.en;
Object.keys(msgDB).forEach(lang => {
    if (lang === navigator.language) {
        msg = msgDB[lang];
    }
});

// Updated CSS: the banner now fixes to the bottom center.
styles.innerHTML = `
    /* Apply a system font across elements */
    * {
        font-family: -apple-system, BlinkMacSystemFont, Roboto, "Segoe UI", Helvetica, Arial, sans-serif;
    }
    
    body {
        background: #181818;
        margin: 0;
        overflow: hidden;
    }
    
    /* Banner container: fixed to the bottom center of the viewport */
    .connection_err {
        display: flex;
        flex-direction: column;
        align-items: center;
        position: fixed;
        left: 50%;
        bottom: 0;
        transform: translateX(-50%);
        animation: fade-in 2s forwards;
        padding: 20px;
        box-sizing: border-box;
        z-index: 9999;
    }
    
    /* Offline message styling */
    .offline_message {
        font-size: 5vw;
        font-weight: 500;
        color: #959595;
        text-align: center;
    }
    
    /* Offline description styling */
    .offline_description {
        font-size: 3vw;
        color: #525252;
        width: 90%;
        max-width: 800px;
        text-align: center;
        margin-top: 40px;
    }
    
    @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }
`;

// Build banner content.
offlinePicture.innerHTML = 
    `<svg viewBox="0 0 48 48" height="48" width="48" style="width: 200px; height: 200px">
        <path style="fill: #959595" d="m41.25 44.4-5.8-5.9H12.6q-3.95 0-6.7-2.7t-2.75-6.7q0-3.8 2.65-6.45Q8.45 20 11.9 19.8q-.05-.65.275-1.8t.875-1.85l-8.1-8.1L6.5 6.5l36.35 36.35ZM12.6 36.3h20.65L14.8 17.9q-.6.75-.9 1.875-.3 1.125-.3 2.225h-1q-3.05 0-5.15 2.025-2.1 2.025-2.1 5.025 0 3.05 2.125 5.15Q9.6 36.3 12.6 36.3Zm11.35-9.25Zm18.25 9.8-1.65-1.65q1-.8 1.55-1.8t.55-2.3q0-2.05-1.525-3.575Q39.6 26 37.5 26h-3.25v-4.05q0-4.3-2.975-7.275Q28.3 11.7 24 11.7q-1.4 0-2.875.4t-2.675 1.2l-1.55-1.65q1.85-1.15 3.5-1.65t3.55-.5q5.05 0 8.625 3.45t3.875 8.45v2.45h1.25q3.05.2 5.1 2.225t2.05 5.025q0 1.5-.625 3.05-.625 1.55-2.025 2.7Zm-12.7-12.6Z"/>
    </svg>`;
offlineMessage.innerHTML = msg.msg;
offlineDescription.innerHTML = msg.des;

// Always inject the style.
document.body.appendChild(styles);

// Only show the banner if offline.
if (!navigator.onLine) {
    document.body.appendChild(bannerContainer);
}

// Append children to the banner container.
bannerContainer.classList.add('connection_err');
offlineMessage.classList.add('offline_message');
offlineDescription.classList.add('offline_description');
bannerContainer.appendChild(offlinePicture);
bannerContainer.appendChild(offlineMessage);
bannerContainer.appendChild(offlineDescription);

// Show the banner when offline, and remove it when online.
window.addEventListener('offline', () => {
    if (!document.body.contains(bannerContainer)) {
        document.body.appendChild(bannerContainer);
    }
});
window.addEventListener('online', () => {
    if (document.body.contains(bannerContainer)) {
        document.body.removeChild(bannerContainer);
    }
    ipc.send('restored');
});
