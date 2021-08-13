pragma solidity >=0.8.0;

contract CryptoChat {
    event Message(address indexed sender, string message);

    string chatMessage;

    uint256 totalMessage;

    constructor() {
        chatMessage = 'First message';
        totalMessage = 1;
    }

    function set(string memory newMessage) public {
        chatMessage = newMessage;
        totalMessage++;
        emit Message(msg.sender, chatMessage);
    }

    function get() public view returns (string memory) {
        return chatMessage;
    }

    function getTotalMessage() public view returns (uint256) {
        return totalMessage;
    }
}
