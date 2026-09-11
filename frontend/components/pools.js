// frontend/components/pools.js
const PoolsComponent = {
    async loadPools(chainId) {
        try {
            const response = await fetch(`${CONFIG.API_URL}/pools/${chainId}`);
            const data = await response.json();

            if (data.success) {
                state.ui.pools = data.pools;
                this.display();
            }
        } catch (error) {
            console.error('Load pools error:', error);
        }
    },

    display() {
        const container = document.getElementById('poolsList');

        if (state.ui.pools.length === 0) {
            container.innerHTML = '<div class="empty-state">No pools available</div>';
            return;
        }

        container.innerHTML = state.ui.pools.map(pool => `
            <div class="pool-card">
                <div class="pool-header">
                    <div class="pool-pair">${pool.token0.slice(2, 8)} / ${pool.token1.slice(2, 8)}</div>
                    <div class="pool-fee">${(pool.fee / 10000).toFixed(2)}%</div>
                </div>
                <div class="pool-info">
                    <div class="pool-info-item">
                        <span>Pool</span>
                        <span>${formatAddress(pool.poolAddress)}</span>
                    </div>
                    <div class="pool-info-item">
                        <span>Liquidity</span>
                        <span>$${formatNumber(pool.liquidity)}</span>
                    </div>
                    <div class="pool-info-item">
                        <span>24h Volume</span>
                        <span>$${formatNumber(pool.volume24h || '0')}</span>
                    </div>
                    <div class="pool-info-item">
                        <span>APR</span>
                        <span>${(pool.apr || 0).toFixed(2)}%</span>
                    </div>
                    <div class="pool-info-item">
                        <span>DEX</span>
                        <span>${pool.dex.toUpperCase()}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }
};