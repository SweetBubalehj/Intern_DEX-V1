# Sample Hardhat Project

This project demonstrates a basic Hardhat use case. It comes with a sample contract, a test for that contract, and a script that deploys that contract.

![image](https://user-images.githubusercontent.com/53579504/186846580-097676e3-ba46-4c59-9017-1af4e7d02df3.png)

IInterExchange.sol - interface of InternExchange.sol (Multiple Exchanges)
IInternFactory.sol - interface of InternFactory.sol (Factory)
IInternERC20.sol - interface of InternERC20.sol (Staking token)

InterExchange.sol - contract of exchange ether to token
- Has add/remove liquidity options with giving staking award for its providing
- Has LP-tokens options: to send, to revieve, to mint, to burn them
- Has swaps - ether to token, token to ether, 
    token to token (with factory) -
    - swaps token to ether and send ether to another exchange contract from factory to make a swap ether to token

InternFactory.sol - contract of factory that can create multiple exchanges
- Has create exchange option by address of token and saves it in mapping, adding it in whitelist
- Has get exchange option that returns address of exchange by address of token

InternERC20.sol - contract of ERC20 token that Factory uses to give award for liquidity (staking)
- Has ERC20 standarts + mint and adding to whitelist options

![image](https://user-images.githubusercontent.com/53579504/186851048-7a293b97-77f0-4a9f-b09c-0a31acaae671.png)
