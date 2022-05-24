const hre = require("hardhat");

async function main() {
  const YisuCoin = await hre.ethers.getContractFactory("YisuCoin");
  const yisucoin = await YisuCoin.deploy(10);

  await yisucoin.deployed();

  console.log("YisuCoin deployed to:", yisucoin.address);
}

main();
