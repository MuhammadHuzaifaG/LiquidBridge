// scripts/deploy.js
const hre = require("hardhat");
require('dotenv').config();

async function main() {
    console.log("🚀 Deploying LiquidBridge...");

    const feeRecipient = process.env.FEE_RECIPIENT || (await ethers.getSigners())[0].address;
    
    const LiquidBridge = await ethers.getContractFactory("LiquidBridgeAggregator");
    const liquidBridge = await LiquidBridge.deploy(feeRecipient);
    await liquidBridge.waitForDeployment();

    const address = await liquidBridge.getAddress();
    console.log("✅ LiquidBridge deployed to:", address);

    const deploymentData = {
        network: hre.network.name,
        address: address,
        feeRecipient: feeRecipient,
        timestamp: new Date().toISOString()
    };

    require('fs').writeFileSync(
        `deployments/${hre.network.name}.json`,
        JSON.stringify(deploymentData, null, 2)
    );

    console.log("📝 Deployment info saved");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});