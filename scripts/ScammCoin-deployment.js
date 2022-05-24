const hre = require("hardhat");

async function main() {
  const Token = await hre.ethers.getContractFactory("Token");
  const token = await Token.deploy("KoojaCoin", "KOJ", 10000);
  await token.deployed();

  console.log("ScammCoin deployed to:", token.address);
}

main();
