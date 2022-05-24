const { expect } = require("chai");
const { ethers, waffle, upgrades } = require("hardhat");
const { provider } = waffle;

const totalSupply = ethers.utils.parseEther("10000");
const amountA = ethers.utils.parseEther("2000");
const amountB = ethers.utils.parseEther("1000");

let token;
let exchange;
let exchangeUpgrade;
let rewardsToken;
let stakingRewards;
let deployer, bob, alice;
let tx;

describe("Exchange", function () {
  beforeEach(async function(){
    [deployer, bob, alice] = await ethers.getSigners();

    //Deploy exchange Token
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("KoojaCoin", "KOJ", totalSupply);
    await token.deployed();
    
    //Deploy rewards Token
    rewardsToken = await Token.deploy("YisuCoin", "YSC", totalSupply);
    await rewardsToken.deployed();
    
    //Deploy exchange
    const Exchange = await ethers.getContractFactory("Exchange");
    exchange = await upgrades.deployProxy(Exchange, [token.address], {initializer: 'initialize'});
    await exchange.deployed();
    
    //Deploy staking rewards
    const StakingRewards = await ethers.getContractFactory("StakingRewards");
    stakingRewards = await StakingRewards.deploy(exchange.address, rewardsToken.address);
    await stakingRewards.deployed();

    //Transfer all rewardsTokens to StakingRewards contract
    const deployerRewardsTokens = await rewardsToken.balanceOf(deployer.address)
    await rewardsToken.approve(stakingRewards.address, deployerRewardsTokens)
    await stakingRewards.depositRewardsTokens(deployerRewardsTokens)
  })

  it("Adds liquidity", async function () {
    await token.approve(exchange.address, amountA);
    tx = await exchange.addLiquidity(amountA, { value: amountB});

    await expect(tx).to.emit(exchange, "AddLiquidity").withArgs(deployer.address, amountB, amountA);

    expect(await exchange.balanceOf(deployer.address)).to.equal(ethers.utils.parseUnits("1000"));
    expect(await provider.getBalance(exchange.address)).to.equal(amountB);
    expect(await exchange.getReserve()).to.equal(amountA);
  });

  it("Removes liquidity", async function () {
    await token.approve(exchange.address, 200);
    const mintedTokens = await exchange.addLiquidity(200, { value: 100});

    expect(await provider.getBalance(exchange.address)).to.equal(100);
    expect(await exchange.getReserve()).to.equal(200);

    await exchange.removeLiquidity(mintedTokens.value);

    expect(await exchange.getReserve()).to.equal(0);
  });

  it("Returns correct token amount", async function(){
    await token.approve(exchange.address, amountA);
    await exchange.addLiquidity(amountA, { value: amountB});

    let tokenOut = await exchange.getTokenAmount(ethers.utils.parseEther("1"));

    expect(ethers.utils.formatEther(tokenOut)).to.equal("1.978041738678708079");
  })

  it("Returns correct ether amount", async function(){
    await token.approve(exchange.address, amountA);
    await exchange.addLiquidity(amountA, { value: amountB});

    let tokenOut = await exchange.getEthAmount(ethers.utils.parseEther("2"));

    expect(ethers.utils.formatEther(tokenOut)).to.equal("0.989020869339354039");
  })

  it("StakingRewards correctly deployed", async function () {
    expect(await stakingRewards.stakingToken()).to.equal(exchange.address);
    expect(await stakingRewards.rewardsToken()).to.equal(rewardsToken.address);
    expect(await rewardsToken.balanceOf(deployer.address)).to.equal(0);
    expect(await rewardsToken.balanceOf(stakingRewards.address)).to.equal(ethers.utils.parseUnits("10000"));
  });

  it("Stake tokens and reclaim rewards", async () => {
    await token.approve(exchange.address, amountA);
    await exchange.addLiquidity(amountA, { value: amountB });

    let tokens_to_be_staked = await exchange.balanceOf(deployer.address);
    await exchange.approve(stakingRewards.address, tokens_to_be_staked);
    await stakingRewards.stake(tokens_to_be_staked);

    expect(await exchange.balanceOf(stakingRewards.address)).to.equal(tokens_to_be_staked);
    expect(parseInt(await stakingRewards.rewardPerToken())).to.equal(0);
    
    // Simulate 20 blocks
    let numberOfBlocks = 20;
    for (let i = 0; i < numberOfBlocks; i++) {
      await ethers.provider.send("evm_increaseTime", [60]);
      await ethers.provider.send("evm_mine");
    }
    
    expect(parseInt(await stakingRewards.rewardPerToken())).to.equal(120);
    expect(parseInt(await stakingRewards.earned(deployer.address))).equal(120000);

    await stakingRewards.withdraw(tokens_to_be_staked);
    expect(await exchange.balanceOf(stakingRewards.address)).to.equal(0);

    await stakingRewards.getReward();
    expect(await rewardsToken.balanceOf(deployer.address)).to.equal(120000);
  });

  it("Works after upgrading", async () => {
    //Upgrade exchange
    const ExchangeV2 = await ethers.getContractFactory("ExchangeV2");
    exchangeUpgrade = await upgrades.upgradeProxy(exchange.address, ExchangeV2);
    await exchangeUpgrade.deployed();
    
    await token.approve(exchangeUpgrade.address, amountA);
    await exchangeUpgrade.addLiquidity(amountA, { value: amountB});

    let tokenOut = await exchangeUpgrade.getEthAmount(ethers.utils.parseEther("2"));

    expect(ethers.utils.formatEther(tokenOut)).to.equal("0.989020869339354039");
  })

});
