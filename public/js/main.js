// ============================================
// Main – screen navigation, initialization
// ============================================
const Main = (() => {
    let currentScreen = 'login';

    function init() {
        // Connect WebSocket
        Network.connect();

        // Init modules
        Lobby.init();
        Room.init();
        Tournament.init();

        // Login
        document.getElementById('login-btn').addEventListener('click', login);
        document.getElementById('username-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') login();
        });

        // Focus username input
        document.getElementById('username-input').focus();

        // Network handlers
        Network.on('loginSuccess', (msg) => {
            document.getElementById('lobby-username').textContent = msg.username;
            showScreen('lobby');
        });

        Network.on('error', (msg) => {
            showToast(msg.message, 'error');
        });
    }

    function login() {
        const username = document.getElementById('username-input').value.trim();
        if (!username) {
            showToast('Lütfen bir kullanıcı adı girin', 'error');
            return;
        }
        Network.send({ type: 'login', username });
    }

    function showScreen(name) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(`screen-${name}`);
        if (screen) {
            screen.classList.add('active');
            currentScreen = name;
        }
    }

    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 3000);
    }

    // Start
    document.addEventListener('DOMContentLoaded', init);

    return { showScreen, showToast };
})();
