// backend/models/LiquidityPool.js
const mongoose = require('mongoose');

const liquidityPoolSchema = new mongoose.Schema({
    poolAddress: { type: String, required: true, lowercase: true },
    name: { type: String, required: true },
    chainId: { type: Number, required: true },
    token0: { type: String, required: true, lowercase: true },
    token1: { type: String, required: true, lowercase: true },
    reserve0: { type: String, default: '0' },
    reserve1: { type: String, default: '0' },
    liquidity: { type: String, default: '0' },
    fee: { type: Number, default: 3000 },
    protocol: { type: String, default: 'uniswap-v2' },
    dex: { type: String, enum: ['uniswap', 'sushiswap', 'curve', 'balancer', 'pancakeswap'], default: 'uniswap' },
    volume24h: { type: String, default: '0' },
    volume7d: { type: String, default: '0' },
    apr: { type: Number, default: 0 },
    apy: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    verified: { type: Boolean, default: false }
}, { timestamps: true });

liquidityPoolSchema.index({ poolAddress: 1, chainId: 1 }, { unique: true });
liquidityPoolSchema.index({ chainId: 1, active: 1 });
liquidityPoolSchema.index({ token0: 1, token1: 1, chainId: 1 });
liquidityPoolSchema.index({ lastUpdated: -1 });

const LiquidityPool = mongoose.model('LiquidityPool', liquidityPoolSchema);

module.exports = LiquidityPool;