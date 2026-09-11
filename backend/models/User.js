// backend/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    address: { type: String, required: true, unique: true, lowercase: true },
    totalSwaps: { type: Number, default: 0 },
    totalVolume: { type: String, default: '0' },
    totalFeesPaid: { type: String, default: '0' },
    successfulSwaps: { type: Number, default: 0 },
    failedSwaps: { type: Number, default: 0 },
    averageSlippage: { type: Number, default: 0 },
    bestSwapSlippage: { type: Number, default: 100 },
    worstSwapSlippage: { type: Number, default: 0 },
    favoriteTokens: [{ type: String }],
    preferredChains: [{ type: Number }],
    lastActive: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    notifications: { type: Boolean, default: true },
    darkMode: { type: Boolean, default: true },
    slippageTolerance: { type: Number, default: 0.5 }
}, { timestamps: true });

userSchema.index({ address: 1 });
userSchema.index({ totalSwaps: -1 });
userSchema.index({ lastActive: -1 });

const User = mongoose.model('User', userSchema);

module.exports = User;