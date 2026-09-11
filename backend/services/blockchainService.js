// backend/services/blockchainService.js
const { getProvider } = require('../config/blockchain');
const ethers = require('ethers');

const ERC20_ABI = [
    'function balanceOf(address owner) public view returns (uint256)',
    'function approve(address spender, uint256 amount) public returns (bool)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function decimals() public view returns (uint8)',
    'function symbol() public view returns (string)',
    'function name() public view returns (string)'
];

class BlockchainService {
    async getTokenBalance(tokenAddress, userAddress, chainId) {
        try {
            const provider = getProvider(chainId);
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            const balance = await contract.balanceOf(userAddress);
            return balance.toString();
        } catch (error) {
            console.error('Balance fetch error:', error.message);
            return '0';
        }
    }

    async getTokenDecimals(tokenAddress, chainId) {
        try {
            const provider = getProvider(chainId);
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
            const decimals = await contract.decimals();
            return decimals;
        } catch (error) {
            console.error('Decimals fetch error:', error.message);
            return 18;
        }
    }

    async getTokenInfo(tokenAddress, chainId) {
        try {
            const provider = getProvider(chainId);
            const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

            const [name, symbol, decimals] = await Promise.all([
                contract.name().catch(() => 'Unknown'),
                contract.symbol().catch(() => 'UNKNOWN'),
                contract.decimals().catch(() => 18)
            ]);

            return { name, symbol, decimals, address: tokenAddress };
        } catch (error) {
            console.error('Token info error:', error.message);
            return { name: 'Unknown', symbol: 'UNKNOWN', decimals: 18, address: tokenAddress };
        }
    }

    async getGasPrice(chainId) {
        try {
            const provider = getProvider(chainId);
            const feeData = await provider.getFeeData();
            return {
                gasPrice: feeData.gasPrice?.toString() || '0',
                maxFeePerGas: feeData.maxFeePerGas?.toString() || '0',
                maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString() || '0'
            };
        } catch (error) {
            console.error('Gas price error:', error.message);
            return { gasPrice: '0', maxFeePerGas: '0', maxPriorityFeePerGas: '0' };
        }
    }

    async verifyTransaction(txHash, chainId) {
        try {
            const provider = getProvider(chainId);
            const receipt = await provider.getTransactionReceipt(txHash);
            return receipt?.status === 1;
        } catch (error) {
            console.error('Transaction verification error:', error.message);
            return false;
        }
    }

    async getBlockNumber(chainId) {
        try {
            const provider = getProvider(chainId);
            return await provider.getBlockNumber();
        } catch (error) {
            console.error('Block number error:', error.message);
            return 0;
        }
    }
}

module.exports = new BlockchainService();