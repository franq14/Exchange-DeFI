//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

import "./Registry.sol";

contract Exchange is OwnableUpgradeable, ERC20Upgradeable {
    address public tokenAddress;
    address public registryAddress;
    uint public fee;

    event TokenPurchase(address indexed buyer, uint256 indexed ethSold, uint256 indexed tokensBought);
    event EthPurchase(address indexed buyer, uint256 indexed tokensSold, uint256 indexed ethBought);
    event AddLiquidity(address indexed provider, uint256 indexed ethAmount, uint256 indexed tokenAmount);
    event RemoveLiquidity(address indexed provider, uint256 indexed ethAmount, uint256 indexed tokenAmount);

    function initialize(address _token) initializer public {
        __ERC20_init("LiquidityPoolToken", "LP");
        require(_token != address(0), "Invalid token");
        fee = 99;
        tokenAddress = _token;
        registryAddress = msg.sender;
    }

    function addLiquidity(uint256 _tokenAmount) public payable returns(uint256){
        uint256 liquidity;
        if(totalSupply() == 0){
            liquidity = address(this).balance;
        } else {
            uint ethReserve = address(this).balance - msg.value;
            uint tokenReserve = getReserve();
            uint256 correctTokenAmount = (msg.value * tokenReserve) / ethReserve;
            require(_tokenAmount >= correctTokenAmount, "Cannot reach minimun tokens amount");
            liquidity = (totalSupply() * msg.value) / ethReserve;
        }        
        IERC20 token = IERC20(tokenAddress);
        token.transferFrom(msg.sender, address(this), _tokenAmount);
        _mint(msg.sender, liquidity);
        emit AddLiquidity(msg.sender, msg.value, _tokenAmount);
        return liquidity;
    }

    function removeLiquidity(uint256 _amount) public returns(uint256, uint256){
        require(_amount > 0, "Invalid amount");
        uint256 ethAmount = (address(this).balance * _amount) / totalSupply();
        uint256 tokenAmount = (getReserve() * _amount) / totalSupply();
        _burn(msg.sender, _amount);
        payable(msg.sender).transfer(ethAmount);
        IERC20(tokenAddress).transfer(msg.sender, tokenAmount);
        emit RemoveLiquidity(msg.sender, ethAmount, tokenAmount);
        return(ethAmount, tokenAmount);
    }

    function getReserve() public view returns(uint256){
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    function getAmount(uint256  inputAmount, uint256 inputReserve, uint256 outputReserve) private view returns(uint256){
        require(inputReserve > 0 && outputReserve > 0, "Invalid reserves");
        // X * Y = K => CPAMM => ContinousPriceAutomaticMarketMaker
        // X = inputReserve
        // Y = outputReserve
        // (x + dx) * (y - dy) = K
        // dy = y - dx .......
        uint256 inputAmountWithFee = inputAmount * fee;
        uint256 numerator = inputAmountWithFee * outputReserve;
        uint256 denominator = (inputReserve * 100) + inputAmountWithFee;
        return numerator / denominator;
    }

    function getTokenAmount(uint256 _ethSold) public view returns(uint256){
        require(_ethSold > 0, "Invalid amount");
        uint256 tokenReserve = getReserve();
        return getAmount(_ethSold, address(this).balance, tokenReserve);
    }

    function getEthAmount(uint256 _tokenSold) public view returns(uint256){
        require(_tokenSold > 0, "Invalid amount");
        uint256 tokenReserve = getReserve();
        return getAmount(_tokenSold, tokenReserve, address(this).balance);
    }

    function ethToToken(uint256 _minTokens, address recipient) private {
        uint256 tokenReserve = getReserve();
        uint256 tokensBought = getAmount(msg.value, address(this).balance - msg.value, tokenReserve);
        require(tokensBought >= _minTokens, "Cannot reach the minimum token");
        IERC20(tokenAddress).transfer(recipient, tokensBought);
        emit TokenPurchase(msg.sender, msg.value, tokensBought);
    }

    function ethToTokenSwap(uint256 _minTokens) public payable{
        ethToToken(_minTokens, msg.sender);
    }

    function ethToTokenTransfer(uint256 _minTokens, address _recipient) public payable {
        ethToToken(_minTokens, _recipient);
    }

    function tokenToEthSwap(uint256 _tokensSold, uint256 _minEth) public {
        uint256 tokenReserve = getReserve();
        uint256 ethBought = getAmount(_tokensSold, tokenReserve, address(this).balance);
        require(ethBought >= _minEth, "Cannot reach the minimum eth");
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), _tokensSold);
        payable(msg.sender).transfer(ethBought);
        emit EthPurchase(msg.sender, ethBought, _tokensSold);
    }

    function tokenToTokenSwap(uint256 _tokensSold, uint256 _minTokensBought, address _tokenAddress) public {
        // This is SCAMM Exchange
        // I want to buy DAI paying SCAMM
        // Ask registry wich is the DAI Exchange 
        address exchangeAddress = Registry(registryAddress).getExchange(_tokenAddress);
        require(exchangeAddress != address(0), "There's no registry for token");
        require(exchangeAddress != address(this), "Invalid exchange address");
        uint256 tokenReserve = getReserve();
        uint256 ethBought = getAmount(_tokensSold, tokenReserve, address(this).balance);
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), _tokensSold);
        Exchange(exchangeAddress).ethToTokenTransfer{value: ethBought}(_minTokensBought, msg.sender);
    }
}
