// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./InternExchange.sol";
import "./IInternFactory.sol";
import "./InternERC20.sol";

/* 
contract of factory that contains multiple exchanges

allows user to add exchanges with token addresses

factory is used to swap tokens from one contract to another token's contract
*/
contract InternFactory is InternERC20 {
    /*
    tokenToExchange - mapping that saves token address to exchange address
    */
    mapping(address => address) public tokenToExchange;

    /*
    constructor that is ERC20 contract with staking tokens
    */
    constructor() InternERC20("Intern token", "INT", address(this)) {}

    /*
    function creates exchange by address of token

    requires token address is not zero

    requieres that token is not in factory (mapping) already

    requires this factory to be whitelisted in ERC20 token to mint award tokens

    creates new exchage by token address
    adds it to mapping

    adds exchange to whitelist to be able to mint award tokens
    */
    function createExchange(address _tokenAddress) public returns (address) {
        require(_tokenAddress != address(0), "invalid address!");
        require(
            tokenToExchange[_tokenAddress] == address(0),
            "exchange already exist!"
        );

        IInternERC20 intern = IInternERC20(address(this));
        require(
            intern.addressWhitelistStatus(address(this)) == true,
            "factory is not whitelisted!"
        );

        InternExchange dex = new InternExchange(_tokenAddress, address(this));
        tokenToExchange[_tokenAddress] = address(dex);
        intern.addToWhitelist(address(dex));
        return address(dex);
    }

    /*
    fucntion returns exchange address by token address
    */
    function getExchange(address _tokenAddress) public view returns (address) {
        return tokenToExchange[_tokenAddress];
    }
}
