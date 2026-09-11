// scripts/registerPools.js
const fetch = require('node-fetch');
require('dotenv').config();

const POOLS = [
    {
        poolAddress: "0x0d4a11d5fffb9df6cbbaea9c205eb4d4f8d5bee8",
        name: "Uniswap V2 WETH-USDC",
        chainId: 1,
        token0: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        token1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        reserve0: "100000000000000000000",
        reserve1: "250000000000",
        liquidity: "25000000",
        fee: 3000
    }
];

async function registerPools() {
    for (const pool of POOLS) {
        try {
            const response = await fetch(`${process.env.API_URL}/pools/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(pool)
            });

            const data = await response.json();
            console.log(`✅ Registered pool: ${pool.name}`);
        } catch (error) {
            console.error(`❌ Failed to register pool: ${pool.name}`, error);
        }
    }
}

registerPools();