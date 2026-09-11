// backend/routes/stats.js
const express = require('express');
const router = express.Router();
const Swap = require('../models/Swap');
const User = require('../models/User');
const LiquidityPool = require('../models/LiquidityPool');

router.get('/', async (req, res) => {
    try {
        const [totalSwaps, completedSwaps, totalVolume, totalUsers, activePools, userStats] = await Promise.all([
            Swap.countDocuments(),
            Swap.countDocuments({ status: 'completed' }),
            Swap.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, total: { $sum: { $toDouble: '$amountIn' } } } }
            ]),
            User.countDocuments(),
            LiquidityPool.countDocuments({ active: true }),
            Swap.aggregate([
                { $match: { status: 'completed' } },
                { $group: { _id: null, avgSlippage: { $avg: '$slippage' }, avgImpact: { $avg: '$priceImpact' } } }
            ])
        ]);

        res.json({
            success: true,
            stats: {
                totalSwaps,
                completedSwaps,
                totalVolume: totalVolume[0]?.total.toString() || '0',
                totalUsers,
                activePools,
                successRate: totalSwaps > 0 ? ((completedSwaps / totalSwaps) * 100).toFixed(2) : 0,
                avgSlippage: userStats[0]?.avgSlippage.toFixed(2) || '0',
                avgPriceImpact: userStats[0]?.avgImpact.toFixed(2) || '0'
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
    }
});

router.get('/volume/:chainId', async (req, res) => {
    try {
        const volume = await Swap.aggregate([
            { $match: { sourceChain: parseInt(req.params.chainId), status: 'completed' } },
            { $group: { _id: null, total: { $sum: { $toDouble: '$amountIn' } } } }
        ]);

        res.json({ success: true, volume: volume[0]?.total || '0' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch volume', details: error.message });
    }
});

router.get('/top-tokens/:limit', async (req, res) => {
    try {
        const topTokens = await Swap.aggregate([
            { $match: { status: 'completed' } },
            {
                $group: {
                    _id: '$tokenIn',
                    count: { $sum: 1 },
                    volume: { $sum: { $toDouble: '$amountIn' } }
                }
            },
            { $sort: { count: -1 } },
            { $limit: parseInt(req.params.limit) || 10 }
        ]);

        res.json({ success: true, topTokens });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch top tokens', details: error.message });
    }
});

module.exports = router;