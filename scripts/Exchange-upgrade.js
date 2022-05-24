const { ethers, upgrades } = require('hardhat');

async function main(){
    const ExchangeV2 = await ethers.getContractFactory('ExchangeV2');
    console.log('Deploying Exchange...');
    await upgrades.upgradeProxy('0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9', ExchangeV2);
    console.log('Exchange upgraded');
}

main();