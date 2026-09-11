// backend/models/PriceHistory.js
const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
    tokenAddress: { type: String, required: true, lowercase: true },
    symbol: { type: String },
    price: { type: Number, required: true },
    priceUSD: { type: Number },
    change24h: { type: Number },
    volume24h: { type: String },
    marketCap: { type: String },
    chainId: { type: Number, required: true },
    source: { type: String, default: 'coingecko' },
    timestamp: { type: Date, default: Date.now, index: { expires: 86400 } }
}, { timestamps: true });

priceHistorySchema.index({ tokenAddress: 1, chainId: 1, timestamp: -1 });
priceHistorySchema.index({ timestamp: 1 }, { expireAfterSeconds: 86400 });

const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

module.exports = PriceHistory;