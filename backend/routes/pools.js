// backend/routes/pools.js
const express = require('express');
const router = express.Router();
const LiquidityPool = require('../models/LiquidityPool');

router.get('/:chainId', async (req, res) => {
    try {
        const pools = await LiquidityPool.find({
            chainId: parseInt(req.params.chainId),
            active: true
        })
        .sort({ liquidity: -1 })
        .limit(100)
        .lean();

        res.json({ success: true, pools, count: pools.length });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pools', details: error.message });
    }
});

router.post('/register', async (req, res) => {
    try {
        const { poolAddress, name, chainId, token0, token1, reserve0, reserve1, liquidity, fee } = req.body;

        const existingPool = await LiquidityPool.findOne({ poolAddress, chainId });

        if (existingPool) {
            existingPool.reserve0 = reserve0;
            existingPool.reserve1 = reserve1;
            existingPool.liquidity = liquidity;
            existingPool.lastUpdated = new Date();
            await existingPool.save();
            return res.json({ success: true, message: 'Pool updated', pool: existingPool });
        }

        const pool = new LiquidityPool({
            poolAddress: poolAddress.toLowerCase(),
            name,
            chainId,
            token0: token0.toLowerCase(),
            token1: token1.toLowerCase(),
            reserve0,
            reserve1,
            liquidity,
            fee
        });

        await pool.save();
        res.json({ success: true, message: 'Pool registered', pool });
    } catch (error) {
        res.status(500).json({ error: 'Failed to register pool', details: error.message });
    }
});

router.get('/pair/:chainId/:token0/:token1', async (req, res) => {
    try {
        const { chainId, token0, token1 } = req.params;

        const pools = await LiquidityPool.find({
            chainId: parseInt(chainId),
            $or: [
                { token0: token0.toLowerCase(), token1: token1.toLowerCase() },
                { token0: token1.toLowerCase(), token1: token0.toLowerCase() }
            ],
            active: true
        }).lean();

        res.json({ success: true, pools });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pair pools', details: error.message });
    }
});

module.exports = router;