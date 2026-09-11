// frontend/utils/web3Utils.js
const Web3Utils = {
    async getTokenInfo(address, chainId) {
        try {
            const provider = new ethers.JsonRpcProvider(CONFIG.CHAINS[chainId].rpc);
            const contract = new ethers.Contract(address, ERC20_ABI, provider);

            const [name, symbol, decimals] = await Promise.all([
                contract.name(),
                contract.symbol(),
                contract.decimals()
            ]);

            return { name, symbol, decimals, address };
        } catch (error) {
            console.error('Token info error:', error);
            return null;
        }
    },

    async validateAddress(address) {
        return ethers.isAddress(address);
    },

    parseUnits(value, decimals) {
        return ethers.parseUnits(value.toString(), decimals);
    },

    formatUnits(value, decimals) {
        return ethers.formatUnits(value, decimals);
    },

    getChainName(chainId) {
        return CONFIG.CHAINS[chainId]?.name || 'Unknown';
    },

    getExplorerUrl(chainId, txHash) {
        const chain = CONFIG.CHAINS[chainId];
        if (!chain) return null;
        return `${chain.explorer}/tx/${txHash}`;
    }
};