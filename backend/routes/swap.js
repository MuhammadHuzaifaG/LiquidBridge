// backend/routes/swap.js
const express = require('express');
const router = express.Router();
const Swap = require('../models/Swap');
const User = require('../models/User');
const routingService = require('../services/routingService');

router.post('/initiate', async (req, res) => {
    try {
        const { userAddress, tokenIn, tokenOut, amountIn, minAmountOut, chainId, crossChain, destinationChain } = req.body;

        if (!userAddress || !tokenIn || !tokenOut || !amountIn || !chainId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const route = await routingService.findBestRoute(tokenIn, tokenOut, amountIn, chainId);
        if (!route) {
            return res.status(404).json({ error: 'No viable route found' });
        }

        const swap = new Swap({
            userAddress: userAddress.toLowerCase(),
            tokenIn: tokenIn.toLowerCase(),
            tokenOut: tokenOut.toLowerCase(),
            amountIn,
            minAmountOut,
            sourceChain: chainId,
            destinationChain: destinationChain || chainId,
            poolUsed: route.poolAddress,
            priceImpact: route.priceImpact,
            status: 'initiated'
        });

        await swap.save();

        let user = await User.findOne({ address: userAddress.toLowerCase() });
        if (!user) {
            user = new User({ address: userAddress.toLowerCase() });
        }
        user.totalSwaps += 1;
        user.lastActive = new Date();
        await user.save();

        res.json({
            success: true,
            swapId: swap._id,
            route,
            message: 'Swap initiated successfully'
        });
    } catch (error) {
        console.error('Initiate swap error:', error);
        res.status(500).json({ error: 'Failed to initiate swap', details: error.message });
    }
});

router.get('/:swapId', async (req, res) => {
    try {
        const swap = await Swap.findById(req.params.swapId);
        if (!swap) {
            return res.status(404).json({ error: 'Swap not found' });
        }
        res.json({ success: true, swap });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch swap', details: error.message });
    }
});

router.post('/status', async (req, res) => {
    try {
        const { swapId, txHash, status, amountOut, gasUsed } = req.body;

        const swap = await Swap.findByIdAndUpdate(
            swapId,
            {
                status,
                txHash,
                amountOut,
                gasUsed,
                completedAt: status === 'completed' ? new Date() : undefined
            },
            { new: true }
        );

        if (status === 'completed') {
            await User.updateOne(
                { address: swap.userAddress },
                {
                    $inc: { successfulSwaps: 1 },
                    lastActive: new Date()
                }
            );
        }

        res.json({ success: true, swap });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update status', details: error.message });
    }
});

module.exports = router;