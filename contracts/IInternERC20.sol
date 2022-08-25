// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

interface IInternERC20 {
    // OPTIONAL
    function name() external view returns (string memory);

    function symbol() external view returns (string memory);

    function mint(address to, uint256 amount) external;

    // NOT USED
    //function burn(address to, uint256 amount) external;

    function addToWhitelist(address user) external;
    
    // NOT USED
    //function removeFromWhitelist(address user) external;

    function addressWhitelistStatus(address account)
        external
        view
        returns (bool);

    // STANDART
    function totalSupply() external view returns (uint256);

    function decimals() external pure returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function allowance(address _owner, address spender)
        external
        view
        returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool);

    // STANDART EVENTS
    // indexed - for a search (up to 3 in an event)
    event Transfer(address indexed from, address indexed to, uint256 amount);

    event Approve(address indexed owner, address indexed to, uint256 amount);

    // OPTIONALS EVENTS
    /* Whitelist
      bool status = true -> added to whitelist
      bool status = false -> removed from whitelist */
    event Whitelist(
        address indexed from,
        address indexed user,
        bool indexed status
    );

    /* TotalTokenStatus
       bool status = true -> minted
       bool status = false -> burned */
    event TotalTokenStatus(
        address indexed from,
        address indexed to,
        uint256 amount,
        bool indexed status
    );
}
