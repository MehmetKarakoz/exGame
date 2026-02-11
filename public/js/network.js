// ============================================
// Network – WebSocket communication
// ============================================
const Network = (() => {
    let ws = null;
    let handlers = {};
    let playerId = null;
    let reconnectAttempts = 0;
    const MAX_RECONNECT = 5;

    function connect() {
        const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
        const url = `${protocol}://${location.host}`;

        ws = new WebSocket(url);

        ws.onopen = () => {
            console.log('WebSocket bağlantısı kuruldu');
            reconnectAttempts = 0;
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'connected') {
                    playerId = msg.playerId;
                }
                if (handlers[msg.type]) {
                    handlers[msg.type].forEach(fn => fn(msg));
                }
                if (handlers['*']) {
                    handlers['*'].forEach(fn => fn(msg));
                }
            } catch (e) {
                console.error('Parse error:', e);
            }
        };

        ws.onclose = () => {
            console.log('WebSocket bağlantısı kesildi');
            if (reconnectAttempts < MAX_RECONNECT) {
                reconnectAttempts++;
                setTimeout(connect, 1000 * reconnectAttempts);
            }
        };

        ws.onerror = (err) => {
            console.error('WebSocket hatası:', err);
        };
    }

    function send(data) {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    function on(type, fn) {
        if (!handlers[type]) handlers[type] = [];
        handlers[type].push(fn);
    }

    function off(type, fn) {
        if (handlers[type]) {
            handlers[type] = handlers[type].filter(f => f !== fn);
        }
    }

    function getPlayerId() {
        return playerId;
    }

    return { connect, send, on, off, getPlayerId };
})();
