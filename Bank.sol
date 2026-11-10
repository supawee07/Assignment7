// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract Bank {
    mapping(address => uint256) private balances;

    error ZeroAmount();
    error InsufficientBalance();
    error TransferFailed();

    event Deposited(address indexed account, uint256 amount);
    event Withdrawn(address indexed account, uint256 amount);

    function deposit() external payable {
        if (msg.value == 0) revert ZeroAmount();
        balances[msg.sender] += msg.value;
        emit Deposited(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        uint256 balance = balances[msg.sender];
        if (amount > balance) revert InsufficientBalance();
        balances[msg.sender] = balance - amount;

        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }

    function checkBalance() external view returns (uint256) {
        return balances[msg.sender];
    }
}
