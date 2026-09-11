// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const ethers = require('ethers');
const axios = require('axios');
const mongoose = require('mongoose');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/liquidbridge', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// ============ SCHEMAS ============

const swapSchema = new mongoose.Schema({
    swapId: Number,
    userAddress: String,
    tokenIn: String,
    tokenOut: String,
    amountIn: String,
    amountOut: String,
    minAmountOut: String,
    status: { type: String, enum: ['initiated', 'processing', 'completed', 'failed'], default: 'initiated' },
    poolUsed: String,
    slippage: Number,
    priceImpact: Number,
    txHash: String,
    sourceChain: Number,
    destinationChain: Number,
    timestamp: { type: Date, default: Date.now },
    completedAt: Date,
    gasUsed: String,
    protocolFee: String
});

const liquidityPoolSchema = new mongoose.Schema({
    poolAddress: String,
    name: String,
    chainId: Number,
    token0: String,
    token1: String,
    reserve0: String,
    reserve1: String,
    liquidity: String,
    fee: Number,
    lastUpdated: { type: Date, default: Date.now },
    active: { type: Boolean, default: true }
});

const priceHistorySchema = new mongoose.Schema({
    tokenAddress: String,
    price: Number,
    chainId: Number,
    timestamp: { type: Date, default: Date.now }
});

const userSchema = new mongoose.Schema({
    address: String,
    totalSwaps: { type: Number, default: 0 },
    totalVolume: { type: String, default: '0' },
    totalFeesPaid: { type: String, default: '0' },
    lastActive: Date,
    createdAt: { type: Date, default: Date.now }
});

const Swap = mongoose.model('Swap', swapSchema);
const LiquidityPool = mongoose.model('LiquidityPool', liquidityPoolSchema);
const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);
const User = mongoose.model('User', userSchema);

// ============ PROVIDER SETUP ============

const providers = {
    1: new ethers.providers.JsonRpcProvider(process.env.ETHEREUM_RPC),
    137: new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC),
    43114: new ethers.providers.JsonRpcProvider(process.env.AVALANCHE_RPC),
    56: new ethers.providers.JsonRpcProvider(process.env.BSC_RPC),
    42161: new ethers.providers.JsonRpcProvider(process.env.ARBITRUM_RPC)
};

const AGGREGATOR_ABI = [
    'function calculateBestRoute(address tokenIn, address tokenOut, uint256 amountIn) external view returns (tuple(address pool, address tokenIn, address tokenOut, uint256 expectedOutput, uint256 fee) bestRoute)',
    'function initiateSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bool crossChain, uint256 destinationChain) external returns (uint256)',
    'function executeSwap(uint256 swapId) external',
    'function getSwapDetails(uint256 swapId) external view returns (tuple(uint256 swapId, address user, address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 timestamp, bool completed))',
    'function getUserSwaps(address user) external view returns (uint256[])',
    'function getPools() external view returns (address[])'
];

const ERC20_ABI = [
    'function balanceOf(address owner) public view returns (uint256)',
    'function approve(address spender, uint256 amount) public returns (bool)',
    'function allowance(address owner, address spender) public view returns (uint256)',
    'function decimals() public view returns (uint8)',
    'function symbol() public view returns (string)'
];

// ============ UTILITY FUNCTIONS ============

async function getTokenPrice(tokenAddress, chainId) {
    try {
        const cachedPrice = await PriceHistory.findOne({
            tokenAddress,
            chainId,
            timestamp: { $gte: new Date(Date.now() - 60000) }
        }).sort({ timestamp: -1 });

        if (cachedPrice) return cachedPrice.price;

        let price = 0;
        if (chainId === 1 || chainId === 137) {
            const response = await axios.get(`https://api.coingecko.com/api/v3/simple/token_price/${chainId === 1 ? 'ethereum' : 'polygon-pos'}`, {
                params: {
                    contract_addresses: tokenAddress,
                    vs_currencies: 'usd'
                }
            });
            price = response.data[tokenAddress.toLowerCase()]?.usd || 0;
        }

        await PriceHistory.create({ tokenAddress, price, chainId });
        return price;
    } catch (error) {
        console.error('Price fetch error:', error.message);
        return 0;
    }
}

async function calculateSlippage(amountIn, amountOut, tokenInPrice, tokenOutPrice) {
    const expectedValue = (amountIn / Math.pow(10, 18)) * tokenInPrice;
    const actualValue = (amountOut / Math.pow(10, 18)) * tokenOutPrice;
    return ((expectedValue - actualValue) / expectedValue) * 100;
}

async function calculatePriceImpact(poolReserve0, poolReserve1, amountIn) {
    const k = poolReserve0 * poolReserve1;
    const newReserve0 = poolReserve0 + amountIn;
    const amountOut = poolReserve1 - (k / newReserve0);
    
    const executionPrice = amountIn / amountOut;
    const spotPrice = poolReserve0 / poolReserve1;
    
    return ((executionPrice - spotPrice) / spotPrice) * 100;
}

async function findOptimalRoute(tokenIn, tokenOut, amountIn, chainId) {
    try {
        const pools = await LiquidityPool.find({
            chainId,
            $or: [
                { token0: tokenIn, token1: tokenOut },
                { token0: tokenOut, token1: tokenIn }
            ],
            active: true
        }).sort({ liquidity: -1 }).limit(10);

        if (pools.length === 0) {
            return null;
        }

        let bestRoute = null;
        let bestOutput = 0;

        for (const pool of pools) {
            try {
                const reserve0 = BigInt(pool.reserve0);
                const reserve1 = BigInt(pool.reserve1);
                const amountInBig = BigInt(amountIn);

                const numerator = amountInBig * reserve1 * BigInt(997);
                const denominator = reserve0 * BigInt(1000) + amountInBig * BigInt(997);
                const amountOut = numerator / denominator;

                if (amountOut > BigInt(bestOutput)) {
                    bestOutput = Number(amountOut);
                    
                    const priceImpact = await calculatePriceImpact(
                        Number(reserve0),
                        Number(reserve1),
                        Number(amountInBig)
                    );

                    bestRoute = {
                        poolAddress: pool.poolAddress,
                        poolName: pool.name,
                        expectedOutput: amountOut.toString(),
                        priceImpact,
                        fee: pool.fee,
                        liquidity: pool.liquidity,
                        token0: pool.token0,
                        token1: pool.token1
                    };
                }
            } catch (error) {
                console.error('Route calculation error:', error.message);
                continue;
            }
        }

        return bestRoute;
    } catch (error) {
        console.error('Route finding error:', error.message);
        return null;
    }
}

// ============ API ENDPOINTS ============

app.get('/api/health', (req, res) => {
    res.json({ status: 'LiquidBridge API is running', timestamp: new Date() });
});

app.get('/api/chains', (req, res) => {
    const chains = [
        { id: 1, name: 'Ethereum', rpc: process.env.ETHEREUM_RPC },
        { id: 137, name: 'Polygon', rpc: process.env.POLYGON_RPC },
        { id: 43114, name: 'Avalanche', rpc: process.env.AVALANCHE_RPC },
        { id: 56, name: 'BSC', rpc: process.env.BSC_RPC },
        { id: 42161, name: 'Arbitrum', rpc: process.env.ARBITRUM_RPC }
    ];
    res.json(chains);
});

app.post('/api/quote', async (req, res) => {
    try {
        const { tokenIn, tokenOut, amountIn, chainId } = req.body;

        if (!tokenIn || !tokenOut || !amountIn || !chainId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const route = await findOptimalRoute(tokenIn, tokenOut, amountIn, chainId);

        if (!route) {
            return res.status(404).json({ error: 'No liquidity route found' });
        }

        const tokenInPrice = await getTokenPrice(tokenIn, chainId);
        const tokenOutPrice = await getTokenPrice(tokenOut, chainId);

        const slippage = await calculateSlippage(amountIn, route.expectedOutput, tokenInPrice, tokenOutPrice);

        res.json({
            success: true,
            route,
            slippage,
            priceImpact: route.priceImpact,
            estimatedOutput: route.expectedOutput,
            tokenInPrice,
            tokenOutPrice,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Quote error:', error);
        res.status(500).json({ error: 'Failed to generate quote', details: error.message });
    }
});

app.post('/api/swap/initiate', async (req, res) => {
    try {
        const { userAddress, tokenIn, tokenOut, amountIn, minAmountOut, chainId, crossChain, destinationChain } = req.body;

        if (!userAddress || !tokenIn || !tokenOut || !amountIn || !chainId) {
            return res.status(400).json({ error: 'Missing required parameters' });
        }

        const route = await findOptimalRoute(tokenIn, tokenOut, amountIn, chainId);
        if (!route) {
            return res.status(404).json({ error: 'No viable route found' });
        }

        const swap = new Swap({
            userAddress,
            tokenIn,
            tokenOut,
            amountIn,
            minAmountOut,
            sourceChain: chainId,
            destinationChain: destinationChain || chainId,
            poolUsed: route.poolAddress,
            priceImpact: route.priceImpact,
            status: 'initiated'
        });

        await swap.save();

        let user = await User.findOne({ address: userAddress });
        if (!user) {
            user = new User({ address: userAddress });
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

app.get('/api/swap/:swapId', async (req, res) => {
    try {
        const swap = await Swap.findById(req.params.swapId);

        if (!swap) {
            return res.status(404).json({ error: 'Swap not found' });
        }

        res.json({
            success: true,
            swap
        });
    } catch (error) {
        console.error('Fetch swap error:', error);
        res.status(500).json({ error: 'Failed to fetch swap', details: error.message });
    }
});

app.get('/api/user/:address/history', async (req, res) => {
    try {
        const swaps = await Swap.find({ userAddress: req.params.address }).sort({ timestamp: -1 }).limit(50);
        const user = await User.findOne({ address: req.params.address });

        res.json({
            success: true,
            user,
            recentSwaps: swaps
        });
    } catch (error) {
        console.error('History fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch history', details: error.message });
    }
});

app.get('/api/pools/:chainId', async (req, res) => {
    try {
        const pools = await LiquidityPool.find({ 
            chainId: parseInt(req.params.chainId),
            active: true 
        }).sort({ liquidity: -1 });

        res.json({
            success: true,
            pools,
            count: pools.length
        });
    } catch (error) {
        console.error('Pools fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch pools', details: error.message });
    }
});

app.post('/api/pools/register', async (req, res) => {
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
            poolAddress,
            name,
            chainId,
            token0,
            token1,
            reserve0,
            reserve1,
            liquidity,
            fee
        });

        await pool.save();

        res.json({ success: true, message: 'Pool registered', pool });
    } catch (error) {
        console.error('Pool registration error:', error);
        res.status(500).json({ error: 'Failed to register pool', details: error.message });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const totalSwaps = await Swap.countDocuments();
        const completedSwaps = await Swap.countDocuments({ status: 'completed' });
        const totalVolume = await Swap.aggregate([
            { $match: { status: 'completed' } },
            { $group: { _id: null, total: { $sum: { $toDouble: '$amountIn' } } } }
        ]);

        const totalUsers = await User.countDocuments();
        const activePools = await LiquidityPool.countDocuments({ active: true });

        res.json({
            success: true,
            stats: {
                totalSwaps,
                completedSwaps,
                totalVolume: totalVolume[0]?.total.toString() || '0',
                totalUsers,
                activePools,
                successRate: totalSwaps > 0 ? ((completedSwaps / totalSwaps) * 100).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error('Stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
    }
});

app.get('/api/tokens/popular', async (req, res) => {
    const popularTokens = [
        { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, chainId: 1 },
        { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, chainId: 1 },
        { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, chainId: 1 },
        { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18, chainId: 137 },
        { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6, chainId: 137 }
    ];

    res.json({
        success: true,
        tokens: popularTokens
    });
});

app.get('/api/routes/:chainId/:tokenIn/:tokenOut/:amount', async (req, res) => {
    try {
        const { chainId, tokenIn, tokenOut, amount } = req.params;

        const route = await findOptimalRoute(tokenIn, tokenOut, amount, parseInt(chainId));

        if (!route) {
            return res.status(404).json({ error: 'No route found' });
        }

        res.json({
            success: true,
            route,
            timestamp: new Date()
        });
    } catch (error) {
        console.error('Route error:', error);
        res.status(500).json({ error: 'Failed to fetch route', details: error.message });
    }
});

app.post('/api/swap/status', async (req, res) => {
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
                    $inc: { totalSwaps: 1 },
                    lastActive: new Date()
                }
            );
        }

        res.json({ success: true, swap });
    } catch (error) {
        console.error('Status update error:', error);
        res.status(500).json({ error: 'Failed to update status', details: error.message });
    }
});

app.use((err, req, res, next) => {
    console.error('Global error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
});

app.listen(PORT, () => {
    console.log(`🚀 LiquidBridge Backend running on port ${PORT}`);
    console.log(`📊 API Documentation: http://localhost:${PORT}/api/health`);
});

module.exports = app;