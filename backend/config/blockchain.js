// backend/config/blockchain.js
const ethers = require('ethers');
require('dotenv').config();

const RPC_PROVIDERS = {
    1: {
        name: 'Ethereum',
        rpc: process.env.ETHEREUM_RPC,
        explorer: 'https://etherscan.io',
        chainId: 1
    },
    137: {
        name: 'Polygon',
        rpc: process.env.POLYGON_RPC,
        explorer: 'https://polygonscan.com',
        chainId: 137
    },
    43114: {
        name: 'Avalanche',
        rpc: process.env.AVALANCHE_RPC,
        explorer: 'https://snowtrace.io',
        chainId: 43114
    },
    56: {
        name: 'BSC',
        rpc: process.env.BSC_RPC,
        explorer: 'https://bscscan.com',
        chainId: 56
    },
    42161: {
        name: 'Arbitrum',
        rpc: process.env.ARBITRUM_RPC,
        explorer: 'https://arbiscan.io',
        chainId: 42161
    }
};

const providers = {};

const initializeProviders = () => {
    Object.entries(RPC_PROVIDERS).forEach(([chainId, config]) => {
        try {
            if (!config.rpc) {
                console.warn(`⚠️ RPC not configured for chain ${config.name}`);
                return;
            }
            providers[chainId] = new ethers.JsonRpcProvider(config.rpc);
            console.log(`✅ Provider initialized for ${config.name}`);
        } catch (error) {
            console.error(`❌ Error initializing provider for ${config.name}:`, error.message);
        }
    });
};

const getProvider = (chainId) => {
    if (!providers[chainId]) {
        throw new Error(`Provider not available for chain ${chainId}`);
    }
    return providers[chainId];
};

const getChainConfig = (chainId) => {
    return RPC_PROVIDERS[chainId] || null;
};

module.exports = {
    RPC_PROVIDERS,
    providers,
    initializeProviders,
    getProvider,
    getChainConfig
};