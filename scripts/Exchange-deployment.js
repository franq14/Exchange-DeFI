const { ethers, upgrades} = require("hardhat");

async function main() {

  const Exchange = await ethers.getContractFactory("Exchange");
  console.log('Deploying Exchange...');
  const exchange = await upgrades.deployProxy(Exchange, ['0x5081a39b8A5f0E35a8D959395a630b68B74Dd30f'], {initializer: 'initialize'});
  await exchange.deployed();
  console.log("Exchange deployed to:", exchange.address);
  console.log("Owner ir:", await exchange.owner());
}

main();
