// SPDX-License-Identifier: MIT

pragma solidity ^0.8.9;

import "./IInternERC20.sol";

contract InternERC20 is IInternERC20 {
    uint256 totalTokens;

    address public owner;

    mapping(address => uint256) balances;
    mapping(address => mapping(address => uint256)) allowances;
    mapping(address => bool) whitelist;

    string _name;
    string _symbol;

    // MODIFIERS
    modifier enoughtTokens(address _from, uint256 _amount) {
        require(balanceOf(_from) >= _amount, "not enough tokens!");
        _;
    }

    modifier onlyWhitelisted(address _from) {
        require(whitelist[_from], "you are not whitelisted!");
        _;
    }

    // CONSTRUCTOR
    constructor(
        string memory name_,
        string memory symbol_,
        address _owner
    ) {
        _name = name_;
        _symbol = symbol_;
        owner = _owner;
        whitelist[owner] = true;
        emit Whitelist(msg.sender, msg.sender, whitelist[msg.sender]);
    }

    // OPTIONAL FUNCTIONS
    function name() external view returns (string memory) {
        return _name;
    }

    function symbol() external view returns (string memory) {
        return _symbol;
    }

    function mint(address to, uint256 amount)
        public
        onlyWhitelisted(msg.sender)
    {
        balances[to] += amount;
        totalTokens += amount;
        emit TotalTokenStatus(msg.sender, to, amount, true);
    }

    // NOT USED
    // function burn(address to, uint256 amount)
    //     public
    //     onlyWhitelisted(msg.sender)
    //     enoughtTokens(to, amount)
    // {
    //     balances[to] -= amount;
    //     totalTokens -= amount;
    //     emit TotalTokenStatus(msg.sender, to, amount, false);
    // }

    function addToWhitelist(address to) public onlyWhitelisted(msg.sender) {
        require(!whitelist[to], "address is already whitelisted!");
        whitelist[to] = true;
        emit Whitelist(msg.sender, to, whitelist[to]);
    }

    // NOT USED
    // function removeFromWhitelist(address to)
    //     public
    //     onlyWhitelisted(msg.sender)
    // {
    //     require(whitelist[to], "address is not whitelisted yet!");
    //     require(to != owner, "owner can't be deleted!");
    //     whitelist[to] = false;
    //     emit Whitelist(msg.sender, to, whitelist[to]);
    // }

    function addressWhitelistStatus(address account)
        public
        view
        returns (bool)
    {
        return whitelist[account];
    }

    // STANDART FUNCTIONS
    function totalSupply() external view returns (uint256) {
        return totalTokens;
    }

    function decimals() external pure returns (uint256) {
        return 18; // 1 token = 1 wei
    }

    function balanceOf(address account) public view returns (uint256) {
        return balances[account];
    }

    function transfer(address to, uint256 amount)
        external
        enoughtTokens(msg.sender, amount)
        returns (bool)
    {
        balances[msg.sender] -= amount;
        balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address _owner, address spender)
        public
        view
        returns (uint256)
    {
        return allowances[_owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(spender, msg.sender, amount);
        return true;
    }

    function _approve(
        address spender,
        address _owner,
        uint256 amount
    ) internal virtual {
        allowances[_owner][spender] = amount;
        emit Approve(_owner, spender, amount);
    }

    function transferFrom(
        address from,
        address _to,
        uint256 amount
    ) public enoughtTokens(from, amount) returns (bool) {
        require(allowances[from][_to] >= amount, "check allowance!");
        allowances[from][_to] -= amount; // error!

        balances[from] -= amount;
        balances[_to] += amount;

        emit Transfer(from, _to, amount);
        return true;
    }
}
