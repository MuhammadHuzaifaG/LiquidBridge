// frontend/components/wallet.js
const WalletComponent = {
    async connect() {
        if (!window.ethereum) {
            showNotification('Please install MetaMask', 'error');
            return false;
        }

        try {
            const web3Provider = new ethers.BrowserProvider(window.ethereum);
            const signer = await web3Provider.getSigner();
            const address = await signer.getAddress();
            const network = await web3Provider.getNetwork();

            state.wallet = {
                connected: true,
                address,
                chainId: Number(network.chainId),
                provider: web3Provider,
                signer
            };

            this.updateDisplay();
            return true;
        } catch (error) {
            showNotification('Failed to connect wallet', 'error');
            return false;
        }
    },

    disconnect() {
        state.wallet.connected = false;
        state.wallet.address = null;
        this.updateDisplay();
    },

    updateDisplay() {
        const btn = document.getElementById('walletBtn');
        if (state.wallet.connected && state.wallet.address) {
            btn.textContent = formatAddress(state.wallet.address);
            btn.classList.add('connected');
        } else {
            btn.textContent = 'Connect Wallet';
            btn.classList.remove('connected');
        }
    },

    async getBalance(tokenAddress) {
        if (!state.wallet.connected) return '0';

        try {
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, state.wallet.provider);
            const balance = await contract.balanceOf(state.wallet.address);
            return balance.toString();
        } catch (error) {
            console.error('Balance error:', error);
            return '0';
        }
    },

    async checkAndApprove(tokenAddress, amount) {
        if (!state.wallet.connected) return false;

        try {
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, state.wallet.signer);
            const allowance = await contract.allowance(state.wallet.address, CONFIG.CONTRACTS.LIQUIDBRIDGE);

            if (BigInt(allowance.toString()) < BigInt(amount)) {
                const approveTx = await contract.approve(CONFIG.CONTRACTS.LIQUIDBRIDGE, amount);
                await approveTx.wait();
                showNotification('Token approved', 'success');
            }
            return true;
        } catch (error) {
            showNotification('Approval failed', 'error');
            return false;
        }
    }
};