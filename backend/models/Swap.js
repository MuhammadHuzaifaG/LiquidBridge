// backend/models/Swap.js
const mongoose = require('mongoose');

const swapSchema = new mongoose.Schema({
    swapId: { type: Number, unique: true, sparse: true },
    userAddress: { type: String, required: true, lowercase: true },
    tokenIn: { type: String, required: true, lowercase: true },
    tokenOut: { type: String, required: true, lowercase: true },
    amountIn: { type: String, required: true },
    amountOut: { type: String },
    minAmountOut: { type: String, required: true },
    status: {
        type: String,
        enum: ['initiated', 'processing', 'completed', 'failed'],
        default: 'initiated'
    },
    poolUsed: { type: String },
    slippage: { type: Number },
    priceImpact: { type: Number },
    txHash: { type: String },
    sourceChain: { type: Number, required: true },
    destinationChain: { type: Number },
    timestamp: { type: Date, default: Date.now },
    completedAt: { type: Date },
    gasUsed: { type: String },
    protocolFee: { type: String },
    errorMessage: { type: String },
    retryCount: { type: Number, default: 0 }
}, { timestamps: true });

swapSchema.index({ userAddress: 1, timestamp: -1 });
swapSchema.index({ status: 1, sourceChain: 1 });
swapSchema.index({ timestamp: -1 });

const Swap = mongoose.model('Swap', swapSchema);

module.exports = Swap;