// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IInternFactory {
    function createExchange(address _tokenAddress) external returns (address);

    function getExchange(address _tokenAddress) external returns (address);
}
