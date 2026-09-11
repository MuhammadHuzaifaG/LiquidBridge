// frontend/components/analytics.js
const AnalyticsComponent = {
    chart: null,

    async loadStats() {
        try {
            const response = await fetch(`${CONFIG.API_URL}/stats`);
            const data = await response.json();

            if (data.success) {
                state.ui.stats = data.stats;
                this.displayStats();
            }
        } catch (error) {
            console.error('Load stats error:', error);
        }
    },

    displayStats() {
        const stats = state.ui.stats;
        document.getElementById('totalSwaps').textContent = stats.totalSwaps || '0';
        document.getElementById('totalVolume').textContent = `$${formatNumber(stats.totalVolume / 1e18)}`;
        document.getElementById('totalUsers').textContent = stats.totalUsers || '0';
        document.getElementById('activePools').textContent = stats.activePools || '0';
        document.getElementById('successRate').textContent = `${stats.successRate}%`;
        document.getElementById('avgSlippage').textContent = `${stats.avgSlippage}%`;
    },

    async initChart() {
        const ctx = document.getElementById('volumeChart');
        if (!ctx) return;

        const response = await fetch(`${CONFIG.API_URL}/stats/volume/1`);
        const data = await response.json();

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Volume',
                    data: [65, 59, 80, 81, 56, 55, 40],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
};