// backend/services/routingService.js
const LiquidityPool = require('../models/LiquidityPool');
const PriceHistory = require('../models/PriceHistory');
const ethers = require('ethers');

class RoutingService {
    async findBestRoute(tokenIn, tokenOut, amountIn, chainId) {
        try {
            const pools = await LiquidityPool.find({
                chainId,
                $or: [
                    { token0: tokenIn.toLowerCase(), token1: tokenOut.toLowerCase() },
                    { token0: tokenOut.toLowerCase(), token1: tokenIn.toLowerCase() }
                ],
                active: true
            })
            .sort({ liquidity: -1 })
            .limit(10)
            .lean();

            if (pools.length === 0) {
                return null;
            }

            let bestRoute = null;
            let bestOutput = BigInt(0);

            for (const pool of pools) {
                try {
                    const output = this.calculateOutputAmount(
                        BigInt(amountIn),
                        BigInt(pool.reserve0),
                        BigInt(pool.reserve1),
                        pool.fee
                    );

                    if (output > bestOutput) {
                        bestOutput = output;
                        const priceImpact = this.calculatePriceImpact(
                            BigInt(pool.reserve0),
                            BigInt(pool.reserve1),
                            BigInt(amountIn)
                        );

                        bestRoute = {
                            poolAddress: pool.poolAddress,
                            poolName: pool.name,
                            dex: pool.dex,
                            expectedOutput: output.toString(),
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
            console.error('Best route finding error:', error);
            return null;
        }
    }

    calculateOutputAmount(amountIn, reserve0, reserve1, fee) {
        const feePercent = BigInt(10000 - fee);
        const numerator = amountIn * reserve1 * feePercent;
        const denominator = reserve0 * BigInt(10000) + amountIn * feePercent;
        return numerator / denominator;
    }

    calculatePriceImpact(reserve0, reserve1, amountIn) {
        try {
            const spotPrice = parseFloat(reserve0.toString()) / parseFloat(reserve1.toString());
            const k = reserve0 * reserve1;
            const newReserve0 = reserve0 + amountIn;
            const newReserve1 = k / newReserve0;
            const amountOut = reserve1 - newReserve1;
            const executionPrice = parseFloat(amountIn.toString()) / parseFloat(amountOut.toString());
            const priceImpact = ((executionPrice - spotPrice) / spotPrice) * 100;
            return Math.max(0, priceImpact);
        } catch (error) {
            return 0;
        }
    }

    async findMultiHopRoute(tokenIn, tokenOut, amountIn, chainId, maxHops = 2) {
        try {
            if (maxHops <= 1) {
                return await this.findBestRoute(tokenIn, tokenOut, amountIn, chainId);
            }

            const directRoute = await this.findBestRoute(tokenIn, tokenOut, amountIn, chainId);
            const intermediateTokens = await this.getIntermediateTokens(chainId);

            let bestRoute = directRoute;
            let bestOutput = BigInt(directRoute?.expectedOutput || 0);

            for (const intermediate of intermediateTokens.slice(0, 5)) {
                try {
                    const hop1 = await this.findBestRoute(tokenIn, intermediate, amountIn, chainId);
                    if (!hop1) continue;

                    const hop2 = await this.findBestRoute(
                        intermediate,
                        tokenOut,
                        BigInt(hop1.expectedOutput),
                        chainId
                    );
                    if (!hop2) continue;

                    const totalOutput = BigInt(hop2.expectedOutput);
                    if (totalOutput > bestOutput) {
                        bestOutput = totalOutput;
                        bestRoute = {
                            ...hop2,
                            hops: 2,
                            intermediateToken: intermediate,
                            expectedOutput: totalOutput.toString()
                        };
                    }
                } catch (error) {
                    continue;
                }
            }

            return bestRoute;
        } catch (error) {
            console.error('Multi-hop route error:', error);
            return null;
        }
    }

    async getIntermediateTokens(chainId) {
        try {
            const pools = await LiquidityPool.aggregate([
                { $match: { chainId, active: true } },
                { $group: { _id: '$token0' } },
                { $sort: { _id: 1 } },
                { $limit: 20 }
            ]);
            return pools.map(p => p._id);
        } catch (error) {
            return [];
        }
    }
}

module.exports = new RoutingService();