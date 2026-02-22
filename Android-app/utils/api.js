export const apiUrl = (serverIP, path) => `http://${serverIP}${path}`;

export const fetchAPI = async (serverIP, isConnected, path, method = 'GET', body = null) => {
    if (!isConnected && path !== '/') return null;
    try {
        const res = await fetch(apiUrl(serverIP, path), {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : null
        });
        return res.ok ? await res.json() : null;
    } catch (e) {
        return null;
    }
};
