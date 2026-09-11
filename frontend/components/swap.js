// frontend/components/swap.js
const SwapComponent = {
    async getQuote() {
        if (!state.swap.tokenIn || !state.swap.tokenOut) return;

        const amountIn = document.getElementById('amountIn').value || '0';
        if (amountIn === '0') return;

        try {
            const response = await fetch(`${CONFIG.API_URL}/quote`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tokenIn: state.swap.tokenIn.address,
                    tokenOut: state.swap.tokenOut.address,
                    amountIn: ethers.parseUnits(amountIn, state.swap.tokenIn.decimals).toString(),
                    chainId: state.wallet.chainId
                })
            });

            const data = await response.json();
            if (data.success) {
                state.swap.route = data.route;
                const amountOut = ethers.formatUnits(data.route.expectedOutput, state.swap.tokenOut.decimals);
                state.swap.amountOut = amountOut;
                state.swap.minAmountOut = this.calculateMinAmount(amountOut);

                document.getElementById('amountOut').value = formatNumber(amountOut, 6);
                this.displayRouteDetails(data);
            }
        } catch (error) {
            console.error('Quote error:', error);
        }
    },

    calculateMinAmount(amount) {
        return (parseFloat(amount) * (1 - state.swap.slippageTolerance / 100)).toString();
    },

    displayRouteDetails(data) {
        document.getElementById('bestPool').textContent = data.route.poolName || 'Uniswap V2';
        document.getElementById('priceImpact').textContent = `${data.route.priceImpact.toFixed(2)}%`;
        document.getElementById('slippage').textContent = `${state.swap.slippageTolerance.toFixed(2)}%`;
        document.getElementById('liquidity').textContent = `$${formatNumber(data.route.liquidity)}`;
        document.getElementById('minReceived').textContent = `${formatNumber(state.swap.minAmountOut, 6)}`;
        document.getElementById('routeDetails').style.display = 'block';
    },

    async execute() {
        if (!state.wallet.connected) {
            showNotification('Connect wallet first', 'error');
            return;
        }

        try {
            const btn = document.getElementById('swapBtn');
            btn.disabled = true;
            btn.textContent = 'Processing...';

            const amountIn = ethers.parseUnits(
                document.getElementById('amountIn').value,
                state.swap.tokenIn.decimals
            );

            const minAmountOut = ethers.parseUnits(
                state.swap.minAmountOut,
                state.swap.tokenOut.decimals
            );

            await WalletComponent.checkAndApprove(state.swap.tokenIn.address, amountIn.toString());

            const response = await fetch(`${CONFIG.API_URL}/swap/initiate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userAddress: state.wallet.address,
                    tokenIn: state.swap.tokenIn.address,
                    tokenOut: state.swap.tokenOut.address,
                    amountIn: amountIn.toString(),
                    minAmountOut: minAmountOut.toString(),
                    chainId: state.wallet.chainId
                })
            });

            const data = await response.json();
            if (data.success) {
                showNotification('Swap initiated!', 'success');
                document.getElementById('amountIn').value = '';
                document.getElementById('amountOut').value = '';
            }

            btn.disabled = false;
            btn.textContent = 'Swap';
        } catch (error) {
            showNotification('Swap failed', 'error');
            document.getElementById('swapBtn').disabled = false;
            document.getElementById('swapBtn').textContent = 'Swap';
        }
    }
};