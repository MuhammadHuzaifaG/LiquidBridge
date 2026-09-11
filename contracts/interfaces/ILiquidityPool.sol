// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILiquidityPool {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);
    
    function getQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (uint256 amountOut);
    
    function getReserves() external view returns (uint256 reserve0, uint256 reserve1);
    
    function token0() external view returns (address);
    
    function token1() external view returns (address);
    
    function fee() external view returns (uint256);
}