// backend/routes/user.js
const express = require('express');
const router = express.Router();
const Swap = require('../models/Swap');
const User = require('../models/User');

router.get('/:address/history', async (req, res) => {
    try {
        const swaps = await Swap.find({ userAddress: req.params.address.toLowerCase() })
            .sort({ timestamp: -1 })
            .limit(50)
            .lean();

        const user = await User.findOne({ address: req.params.address.toLowerCase() });

        res.json({ success: true, user, recentSwaps: swaps });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history', details: error.message });
    }
});

router.get('/:address/stats', async (req, res) => {
    try {
        const user = await User.findOne({ address: req.params.address.toLowerCase() });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const swapStats = await Swap.aggregate([
            { $match: { userAddress: req.params.address.toLowerCase() } },
            {
                $group: {
                    _id: null,
                    totalSwaps: { $sum: 1 },
                    successfulSwaps: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    avgSlippage: { $avg: '$slippage' },
                    totalVolume: { $sum: { $toDouble: '$amountIn' } }
                }
            }
        ]);

        res.json({ success: true, user, swapStats: swapStats[0] || {} });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch user stats', details: error.message });
    }
});

router.post('/:address/preferences', async (req, res) => {
    try {
        const { darkMode, notifications, slippageTolerance, favoriteTokens, preferredChains } = req.body;

        const user = await User.findOneAndUpdate(
            { address: req.params.address.toLowerCase() },
            {
                darkMode,
                notifications,
                slippageTolerance,
                favoriteTokens,
                preferredChains,
                updatedAt: new Date()
            },
            { new: true, upsert: true }
        );

        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update preferences', details: error.message });
    }
});

module.exports = router;