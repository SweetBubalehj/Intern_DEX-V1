// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./IInternFactory.sol";
import "./IInternExchange.sol";
import "./IInternERC20.sol";

/*
contract of exchange that allows user to:

add/remove liquidity

mint/burn/transfer LP-tokens

swaps Tokens to Ethers/Ethers to Tokens/Tokens to Tokens with 0.3% fee

getting award as additional project tokens for provied liquidity
*/
contract InternExchange is ERC20 {
    /*
    tokenAddress - address of token that we trade with

    factoryAddress - address of factory that contains multiple exchanges

    stakingTokenAddress - address of token that is given as award for liquidity
    */
    address public tokenAddress;

    address public factoryAddress;

    address public stakingTokenAddress;

    /*
    addressToTime - mapping of address to state of staking time 

    addressToStaked - mapping of address to staked token amount
    */
    mapping(address => uint256) public addressToTime;
    mapping(address => uint256) public addressToStaked;

    /*
    constructor that is ERC20 contract with LP-tokens

    requiers that exchange and staking tokens not 0 address
    */
    constructor(address _token, address _stakingToken)
        ERC20("InternSwap-V1", "INTS-V1")
    {
        require(_token != address(0), "wrong address!");
        require(_stakingToken != address(0), "wrong address!");
        tokenAddress = _token;
        stakingTokenAddress = _stakingToken;
        factoryAddress = msg.sender;
    }

    /*
    function that adds liquidity in pool

    if liquidity pool is empty user can add any ratios
    however, if pool has liquidity user can add tokens and ethers depends on price rations only
    
    user is minted LP-tokens after adding liquidity in 1-1 to ether ratio

    function also saves the state of address and time of added liquidity to give award
    if user adds liquidity again, state of before staked amount saves
    */
    function addLiquidity(uint256 _tokenAmount)
        public
        payable
        returns (uint256)
    {
        if (getTokenBalance() == 0) {
            IERC20 token = IERC20(tokenAddress);
            token.transferFrom(msg.sender, address(this), _tokenAmount);

            addressToTime[msg.sender] = block.timestamp;

            uint256 liquidity = address(this).balance;
            _mint(msg.sender, liquidity);

            return liquidity;
        } else {
            uint256 etherBalance = address(this).balance - msg.value;
            uint256 tokenBalance = getTokenBalance();
            uint256 tokenAmount = (msg.value * tokenBalance) / etherBalance;
            require(_tokenAmount >= tokenAmount, "not enough input amount!");

            IERC20 token = IERC20(tokenAddress);
            token.transferFrom(msg.sender, address(this), tokenAmount);

            if (balanceOf(msg.sender) == 0) {
                addressToTime[msg.sender] = block.timestamp;
            } else {
                getStakedState(msg.sender);
            }

            uint256 liquidity = (totalSupply() * msg.value) / etherBalance;
            _mint(msg.sender, liquidity);

            return liquidity;
        }
    }

    /*
    function that returns balance of tokens in liquidity pool
    */
    function getTokenBalance() public view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this));
    }

    /*
    low-level function that counts price of ratio ethers to tokens - X * Y = K
    it is constructed that pool never can become empty after exchanges

    requires liquidity in pool

    includes 0.3% fee for transaction for liquidity providers
    */
    function getAmount(
        uint256 inputAmount,
        uint256 inputReserve,
        uint256 outputReserve
    ) private pure returns (uint256) {
        require(inputReserve > 0 && outputReserve > 0, "no liquidity!");

        uint256 inputAmountWithFee = inputAmount * 997;
        uint256 numerator = inputAmountWithFee * outputReserve;
        uint256 denominator = (inputReserve * 1000) + inputAmountWithFee;

        return numerator / denominator;
    }

    /* 
    function that returns current tokens amount that can be sold for entered ethers

    requires some ethers value

    calls getAmount function that counts this value
    */
    function getTokenAmount(uint256 etherSold) public view returns (uint256) {
        require(etherSold > 0, "not enough eth");

        return getAmount(etherSold, address(this).balance, getTokenBalance());
    }

    /* 
    function that returns current ethers amount that can be sold for entered tokens

    requires some tokens tokens

    calls getAmount function that counts this value
    */
    function getEtherAmount(uint256 tokensSold) public view returns (uint256) {
        require(tokensSold > 0, "not enough tokens");

        return getAmount(tokensSold, getTokenBalance(), address(this).balance);
    }

    /* 
    function that swaps ethers to minimum value of tokens

    transfers amount of ethers from user before swap

    calls low-level etherToToken function
    */
    function swapEtherToToken(uint256 _minTokenAmount) public payable {
        etherToToken(_minTokenAmount, msg.sender);
    }

    /* 
    function that transfers ethers from this contract to another exchange contract

    uses in swapTokenToToken function
    */
    function ethToTokenTransfer(uint256 _minTokens, address _recipient)
        public
        payable
    {
        etherToToken(_minTokens, _recipient);
    }

    /*
    low-level function that swaps ethers to a minimum amount of tokens
    in swapEtherToToken and swapTokenToToken

    calls getAmount function that counts value of tokens

    requieres that minimum count of tokens less or equial value of tokens user would get

    transfers amount of tokens to user after swap
    */
    function etherToToken(uint256 _minTokenAmount, address recipient) private {
        uint256 tokenBalance = getTokenBalance();
        uint256 tokensBought = getAmount(
            msg.value,
            address(this).balance - msg.value,
            tokenBalance
        );
        require(tokensBought >= _minTokenAmount, "not enough input amount!");
        IERC20(tokenAddress).transfer(recipient, tokensBought);
    }

    /*
    function that swaps tokens to a minimum amount of ethers

    calls getAmount function that counts value of ethers

    requieres that minimum count of ethers less or equial value of ethers user would get

    transfers amount of tokens from user during swap
    transfers amount of ethers to user after swap
    */
    function swapTokenToEther(uint256 _tokensSold, uint256 _minEtherAmount)
        public
    {
        uint256 tokenBalance = getTokenBalance();
        uint256 etherBought = getAmount(
            _tokensSold,
            tokenBalance,
            address(this).balance
        );
        require(etherBought >= _minEtherAmount, "not enough input amount!");
        IERC20(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            _tokensSold
        );
        payable(msg.sender).transfer(etherBought);
    }

    /*
    function that swaps tokens to a minimum amount of tokens
    by getting address of another exchange from factory by address of token user wants to get

    requieres that exchange address not this contract and zero address

    calls getAmount function that counts value of tokens to ethers

    transfers amount of selling tokens from user during swap

    calls another contract and sending swapped ethers (from getAmount function) on it by ethToTokenTransfer

    transfers amount of buying tokens to user after swap
    */
    function swapTokenToToken(
        uint256 _tokensSold,
        uint256 _minTokenBought,
        address _tokenAddress
    ) public {
        address exchangeAddress = IInternFactory(factoryAddress).getExchange(
            _tokenAddress
        );

        require(
            exchangeAddress != address(this) && exchangeAddress != address(0),
            "exchange doesn't exist!"
        );

        uint256 tokenBalance = getTokenBalance();
        uint256 ethersBought = getAmount(
            _tokensSold,
            tokenBalance,
            address(this).balance
        );

        IERC20(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            _tokensSold
        );

        IInternExchange(exchangeAddress).ethToTokenTransfer{
            value: ethersBought
        }(_minTokenBought, msg.sender);
    }

    /*
    function that removes liquidity from pool by LP-tokens

    require some amount of LP-tokens
    
    saves staking state of user

    user is burned LP-tokens

    transfers amount of ethers to user by current token to ether ratio
    transfers amount of tokens to user by current ether to token ratio
    */
    function removeLiquidity(uint256 _amount)
        public
        returns (uint256, uint256)
    {
        require(_amount > 0, "invalid amount!");

        uint256 ethAmount = (address(this).balance * _amount) / totalSupply();
        uint256 tokenAmount = (getTokenBalance() * _amount) / totalSupply();

        getStakedState(msg.sender);

        _burn(msg.sender, _amount);

        payable(msg.sender).transfer(ethAmount);
        IERC20 token = IERC20(tokenAddress);
        token.transfer(msg.sender, tokenAmount);

        return (ethAmount, tokenAmount);
    }

    /*
    function that returns staked amount
    counts as 1 staking token every 24 hours to 1 provided ether in liquidity pool
    */
    function getStakedAmount(address _user) public view returns (uint256) {
        uint256 _time = block.timestamp - addressToTime[_user];
        uint256 _amount = addressToStaked[_user] +
            (balanceOf(_user) * _time) /
            86400;

        return (_amount);
    }

    /*
    function that changes staking state if user changes LP-tokens state
    like adding another liquidity, sending or getting LP-tokens

    calls getStakedAmount to count amount of staked tokens
    */
    function getStakedState(address _user) private returns (uint256) {
        addressToStaked[_user] = getStakedAmount(_user);
        addressToTime[_user] = block.timestamp;

        return (addressToStaked[_user]);
    }

    /*
    function that mints staked tokens to user

    calls getStakedState to get corrent state of staking 
    requires some staked amount

    staking amount will be zero after withdrawal
    */
    function withdrawStakedTokens() public {
        IInternERC20 intern = IInternERC20(stakingTokenAddress);
        uint256 _staked = getStakedState(msg.sender);

        require(_staked > 0, "0 INT to withdraw!");

        intern.mint(msg.sender, _staked);
        addressToStaked[msg.sender] = 0;
    }

    /* 
    additional function from openzeppelin that changes staking state
    before LP-tokens transfer
    */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256
    ) internal virtual override {
        getStakedState(from);
        if (balanceOf(to) == 0) {
            addressToTime[to] = block.timestamp;
        } else {
            getStakedState(to);
        }
    }
}
