// frontend/utils/api.js
class ApiClient {
    constructor(baseURL = CONFIG.API_URL) {
        this.baseURL = baseURL;
        this.timeout = 30000;
    }

    async request(method, endpoint, body = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' }
            };

            if (body) options.body = JSON.stringify(body);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeout);

            const response = await fetch(`${this.baseURL}${endpoint}`, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    get(endpoint) {
        return this.request('GET', endpoint);
    }

    post(endpoint, body) {
        return this.request('POST', endpoint, body);
    }

    put(endpoint, body) {
        return this.request('PUT', endpoint, body);
    }

    delete(endpoint) {
        return this.request('DELETE', endpoint);
    }
}

const api = new ApiClient();