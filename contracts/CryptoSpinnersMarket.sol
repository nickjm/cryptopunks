pragma solidity ^0.4.8;
contract CryptoSpinnersMarket {

    // You can use this hash to verify the image file containing all the spinners
    string public imageHash = "ac39af4793119ee46bbff351d8cb6b5f23da60222126add4268e261199a2921b";

    address owner;

    string public standard = 'CryptoSpinners';
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;

    uint public spinnersRemainingToAssign = 0;

    //mapping (address => uint) public addressToSpinnerIndex;
    mapping (uint => address) public spinnerIndexToAddress;

    /* This creates an array with all balances */
    mapping (address => uint256) public balanceOf;

    struct Ask {
        bool isForSale;
        uint spinnerIndex;
        address seller;
        uint minValue;          // in ether
        address onlySellTo;     // specify to sell only to a specific person
    }

    struct Bid {
        bool hasBid;
        uint spinnerIndex;
        address bidder;
        uint value;
    }

    // A record of spinners that are offered for sale at a specific minimum value, and perhaps to a specific person
    mapping (uint => Ask) public spinnerAsks;

    // A record of the highest spinner bid
    mapping (uint => Bid) public spinnerBids;

    mapping (address => uint) public pendingWithdrawals;

    event Assign(address indexed to, uint256 spinnerIndex);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event SpinnerTransfer(address indexed from, address indexed to, uint256 spinnerIndex);
    event SpinnerOffered(uint indexed spinnerIndex, uint minValue, address indexed toAddress);
    event SpinnerBidEntered(uint indexed spinnerIndex, uint value, address indexed fromAddress);
    event SpinnerBidWithdrawn(uint indexed spinnerIndex, uint value, address indexed fromAddress);
    event SpinnerBought(uint indexed spinnerIndex, uint value, address indexed fromAddress, address indexed toAddress);
    event SpinnerNoLongerForSale(uint indexed spinnerIndex);

    /* Initializes contract with initial supply tokens to the creator of the contract */
    function CryptoSpinnersMarket() payable {
        //        balanceOf[msg.sender] = initialSupply;              // Give the creator all initial tokens
        owner = msg.sender;
        totalSupply = 10000;                        // Update total supply
        spinnersRemainingToAssign = totalSupply;
        name = "CryptoSpinners";                                   // Set the name for display purposes
        symbol = "CSPIN";                               // Set the symbol for display purposes
        decimals = 0;                                       // Amount of decimals for display purposes
    }

    function getSpinner(uint spinnerIndex) {
        if (spinnersRemainingToAssign == 0) throw;
        if (spinnerIndexToAddress[spinnerIndex] != 0x0) throw;
        if (spinnerIndex >= 10000) throw;
        spinnerIndexToAddress[spinnerIndex] = msg.sender;
        balanceOf[msg.sender]++;
        spinnersRemainingToAssign--;
        Assign(msg.sender, spinnerIndex);
    }

    // Transfer ownership of a spinner to another user without requiring payment
    function transferSpinner(address to, uint spinnerIndex) {
        if (spinnerIndexToAddress[spinnerIndex] != msg.sender) throw;
        if (spinnerIndex >= 10000) throw;
        if (spinnerAsks[spinnerIndex].isForSale) {
            spinnerNoLongerForSale(spinnerIndex);
        }
        spinnerIndexToAddress[spinnerIndex] = to;
        balanceOf[msg.sender]--;
        balanceOf[to]++;
        Transfer(msg.sender, to, 1);
        SpinnerTransfer(msg.sender, to, spinnerIndex);
        // Check for the case where there is a bid from the new owner and refund it.
        // Any other bid can stay in place.
        Bid bid = spinnerBids[spinnerIndex];
        if (bid.bidder == to) {
            // Kill bid and refund value
            pendingWithdrawals[to] += bid.value;
            spinnerBids[spinnerIndex] = Bid(false, spinnerIndex, 0x0, 0);
        }
    }

    function spinnerNoLongerForSale(uint spinnerIndex) {
        if (spinnerIndexToAddress[spinnerIndex] != msg.sender) throw;
        if (spinnerIndex >= 10000) throw;
        spinnerAsks[spinnerIndex] = Ask(false, spinnerIndex, msg.sender, 0, 0x0);
        SpinnerNoLongerForSale(spinnerIndex);
    }

    function offerSpinnerForSale(uint spinnerIndex, uint minSalePriceInWei) {
        if (spinnerIndexToAddress[spinnerIndex] != msg.sender) throw;
        if (spinnerIndex >= 10000) throw;
        spinnerAsks[spinnerIndex] = Ask(true, spinnerIndex, msg.sender, minSalePriceInWei, 0x0);
        SpinnerOffered(spinnerIndex, minSalePriceInWei, 0x0);
    }

    function offerSpinnerForSaleToAddress(uint spinnerIndex, uint minSalePriceInWei, address toAddress) {
        if (spinnerIndexToAddress[spinnerIndex] != msg.sender) throw;
        if (spinnerIndex >= 10000) throw;
        spinnerAsks[spinnerIndex] = Ask(true, spinnerIndex, msg.sender, minSalePriceInWei, toAddress);
        SpinnerOffered(spinnerIndex, minSalePriceInWei, toAddress);
    }

    function buySpinner(uint spinnerIndex) payable {
        Ask ask = spinnerAsks[spinnerIndex];
        if (spinnerIndex >= 10000) throw;
        if (!ask.isForSale) throw;                // spinner not actually for sale
        if (ask.onlySellTo != 0x0 && ask.onlySellTo != msg.sender) throw;  // spinner not supposed to be sold to this user
        if (msg.value < ask.minValue) throw;      // Didn't send enough ETH
        if (ask.seller != spinnerIndexToAddress[spinnerIndex]) throw; // Seller no longer owner of spinner

        address seller = ask.seller;

        spinnerIndexToAddress[spinnerIndex] = msg.sender;
        balanceOf[seller]--;
        balanceOf[msg.sender]++;
        Transfer(seller, msg.sender, 1);

        spinnerNoLongerForSale(spinnerIndex);
        pendingWithdrawals[seller] += msg.value;
        SpinnerBought(spinnerIndex, msg.value, seller, msg.sender);

        // Check for the case where there is a bid from the new owner and refund it.
        // Any other bid can stay in place.
        Bid bid = spinnerBids[spinnerIndex];
        if (bid.bidder == msg.sender) {
            // Kill bid and refund value
            pendingWithdrawals[msg.sender] += bid.value;
            spinnerBids[spinnerIndex] = Bid(false, spinnerIndex, 0x0, 0);
        }
    }

    function withdraw() {
        uint amount = pendingWithdrawals[msg.sender];
        // Remember to zero the pending refund before
        // sending to prevent re-entrancy attacks
        pendingWithdrawals[msg.sender] = 0;
        msg.sender.transfer(amount);
    }

    function enterBidForSpinner(uint spinnerIndex) payable {
        if (spinnerIndex >= 10000) throw;
        if (spinnerIndexToAddress[spinnerIndex] == 0x0) throw;
        if (spinnerIndexToAddress[spinnerIndex] == msg.sender) throw;
        if (msg.value == 0) throw;
        Bid existing = spinnerBids[spinnerIndex];
        if (msg.value <= existing.value) throw;
        if (existing.value > 0) {
            // Refund the failing bid
            pendingWithdrawals[existing.bidder] += existing.value;
        }
        spinnerBids[spinnerIndex] = Bid(true, spinnerIndex, msg.sender, msg.value);
        SpinnerBidEntered(spinnerIndex, msg.value, msg.sender);
    }

    function acceptBidForSpinner(uint spinnerIndex, uint minPrice) {
        if (spinnerIndex >= 10000) throw;
        if (spinnerIndexToAddress[spinnerIndex] != msg.sender) throw;
        address seller = msg.sender;
        Bid bid = spinnerBids[spinnerIndex];
        if (bid.value == 0) throw;
        if (bid.value < minPrice) throw;

        spinnerIndexToAddress[spinnerIndex] = bid.bidder;
        balanceOf[seller]--;
        balanceOf[bid.bidder]++;
        Transfer(seller, bid.bidder, 1);

        spinnerAsks[spinnerIndex] = Ask(false, spinnerIndex, bid.bidder, 0, 0x0);
        uint amount = bid.value;
        spinnerBids[spinnerIndex] = Bid(false, spinnerIndex, 0x0, 0);
        pendingWithdrawals[seller] += amount;
        SpinnerBought(spinnerIndex, bid.value, seller, bid.bidder);
    }

    function withdrawBidForSpinner(uint spinnerIndex) {
        if (spinnerIndex >= 10000) throw;
        if (spinnerIndexToAddress[spinnerIndex] == 0x0) throw;
        if (spinnerIndexToAddress[spinnerIndex] == msg.sender) throw;
        Bid bid = spinnerBids[spinnerIndex];
        if (bid.bidder != msg.sender) throw;
        SpinnerBidWithdrawn(spinnerIndex, bid.value, msg.sender);
        uint amount = bid.value;
        spinnerBids[spinnerIndex] = Bid(false, spinnerIndex, 0x0, 0);
        // Refund the bid money
        msg.sender.transfer(amount);
    }

}
