// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract GydPlatform {
    // =========================================================
    // ENUMS
    // =========================================================

    enum UserRole {
        None,
        Owner,
        Admin,
        User,
        LockDevice
    }

    enum CommandStatus {
        Pending,
        Executed,
        Failed,
        Expired,
        Cancelled
    }

    // =========================================================
    // STRUCTS
    // =========================================================

    struct User {
        address walletAddress;
        UserRole role;
        string name;
        bool isActive;
        uint256 registeredAt;
    }

    struct LockDevice {
        address walletAddress;
        string name;
        string lockId;
        string publicKeyFingerprint;
        bool isApproved;
        bool isOnline;
        uint256 registeredAt;
        uint256 lastSeenAt;
    }

    struct CommandRecord {
        uint256 commandId;
        address lockAddress;
        address submittedBy;
        bytes encryptedPayload;
        bytes encryptedSessionKey;
        bytes iv;
        bytes authTag;
        uint256 submittedAt;
        uint256 expiresAt;
        bytes32 nonce;
        CommandStatus status;
        uint256 executedAt;
        string executionResult;
    }

    // =========================================================
    // STATE VARIABLES
    // =========================================================

    address public owner;
    address public admin;

    uint256 public totalUsers;
    uint256 public totalLocks;
    uint256 public totalCommands;

    mapping(address => User) public users;
    mapping(address => LockDevice) public lockDevices;
    mapping(string => address) private lockIdToAddress;
    mapping(uint256 => CommandRecord) public commands;

    // Anti replay: setiap user tidak boleh pakai nonce yang sama dua kali
    mapping(address => mapping(bytes32 => bool)) private usedNonces;

    // =========================================================
    // EVENTS
    // =========================================================

    event AdminRegistered(
        address indexed adminAddress,
        string name,
        uint256 timestamp
    );

    event AdminChanged(
        address indexed oldAdmin,
        address indexed newAdmin,
        string name,
        uint256 timestamp
    );

    event AuthorizedUserRegistered(
        address indexed userAddress,
        string name,
        uint256 timestamp
    );

    event AuthorizedUserRevoked(
        address indexed userAddress,
        uint256 timestamp
    );

    event LockRegistered(
        address indexed lockAddress,
        string name,
        string lockId,
        string publicKeyFingerprint,
        uint256 timestamp
    );

    event LockApproved(
        address indexed lockAddress,
        uint256 timestamp
    );

    event LockRejected(
        address indexed lockAddress,
        uint256 timestamp
    );

    event LockHeartbeat(
        address indexed lockAddress,
        bool isOnline,
        uint256 timestamp
    );

    event CommandSubmitted(
        uint256 indexed commandId,
        address indexed lockAddress,
        address indexed submittedBy,
        uint256 submittedAt,
        uint256 expiresAt,
        bytes32 nonce
    );

    event CommandExecuted(
        uint256 indexed commandId,
        address indexed lockAddress,
        bool success,
        string resultMessage,
        uint256 timestamp
    );

    event CommandCancelled(
        uint256 indexed commandId,
        address indexed cancelledBy,
        uint256 timestamp
    );

    // =========================================================
    // MODIFIERS
    // =========================================================

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    modifier onlyOwnerOrAdmin() {
        require(
            msg.sender == owner || msg.sender == admin,
            "Only owner or admin"
        );
        _;
    }

    modifier onlyAuthorizedUser() {
        require(_isAuthorizedUser(msg.sender), "Only authorized user");
        _;
    }

    modifier onlyApprovedLock() {
        require(
            lockDevices[msg.sender].walletAddress != address(0),
            "Lock not registered"
        );
        require(lockDevices[msg.sender].isApproved, "Lock not approved");
        _;
    }

    // =========================================================
    // CONSTRUCTOR
    // =========================================================

    constructor(
        string memory _ownerName,
        address _adminAddress,
        string memory _adminName
    ) {
        owner = msg.sender;

        users[owner] = User({
            walletAddress: owner,
            role: UserRole.Owner,
            name: _ownerName,
            isActive: true,
            registeredAt: block.timestamp
        });

        totalUsers++;

        if (_adminAddress != address(0)) {
            require(_adminAddress != owner, "Admin cannot be owner");

            users[_adminAddress] = User({
                walletAddress: _adminAddress,
                role: UserRole.Admin,
                name: _adminName,
                isActive: true,
                registeredAt: block.timestamp
            });

            admin = _adminAddress;
            totalUsers++;

            emit AdminRegistered(_adminAddress, _adminName, block.timestamp);
        }
    }

    // =========================================================
    // INTERNAL HELPERS
    // =========================================================

    function _isAuthorizedUser(address _userAddress) internal view returns (bool) {
        User memory user = users[_userAddress];

        if (user.walletAddress == address(0)) {
            return false;
        }

        if (!user.isActive) {
            return false;
        }

        return (
            user.role == UserRole.Owner ||
            user.role == UserRole.Admin ||
            user.role == UserRole.User
        );
    }

    // =========================================================
    // ADMIN / USER MANAGEMENT
    // =========================================================

    function registerAdmin(address _adminAddress, string memory _name) external onlyOwner {
        require(_adminAddress != address(0), "Invalid address");
        require(_adminAddress != owner, "Cannot register owner as admin");
        require(users[_adminAddress].role == UserRole.None, "Address already registered");

        users[_adminAddress] = User({
            walletAddress: _adminAddress,
            role: UserRole.Admin,
            name: _name,
            isActive: true,
            registeredAt: block.timestamp
        });

        admin = _adminAddress;
        totalUsers++;

        emit AdminRegistered(_adminAddress, _name, block.timestamp);
    }

    function changeAdmin(address _newAdminAddress, string memory _name) external onlyOwner {
        require(_newAdminAddress != address(0), "Invalid address");
        require(_newAdminAddress != owner, "Owner cannot be admin");
        require(_newAdminAddress != admin, "Same admin");

        address oldAdmin = admin;

        if (oldAdmin != address(0)) {
            users[oldAdmin].role = UserRole.None;
            users[oldAdmin].isActive = false;
        }

        if (users[_newAdminAddress].role == UserRole.None) {
            users[_newAdminAddress] = User({
                walletAddress: _newAdminAddress,
                role: UserRole.Admin,
                name: _name,
                isActive: true,
                registeredAt: block.timestamp
            });
            totalUsers++;
        } else {
            users[_newAdminAddress].role = UserRole.Admin;
            users[_newAdminAddress].name = _name;
            users[_newAdminAddress].isActive = true;
        }

        admin = _newAdminAddress;

        emit AdminChanged(oldAdmin, _newAdminAddress, _name, block.timestamp);
    }

    function registerAuthorizedUser(address _userAddress, string memory _name) external onlyOwnerOrAdmin {
        require(_userAddress != address(0), "Invalid address");
        require(users[_userAddress].role == UserRole.None, "Address already registered");
        require(_userAddress != owner, "Owner already authorized");
        require(_userAddress != admin, "Admin already authorized");

        users[_userAddress] = User({
            walletAddress: _userAddress,
            role: UserRole.User,
            name: _name,
            isActive: true,
            registeredAt: block.timestamp
        });

        totalUsers++;

        emit AuthorizedUserRegistered(_userAddress, _name, block.timestamp);
    }

    function revokeAuthorizedUser(address _userAddress) external onlyOwnerOrAdmin {
        require(users[_userAddress].walletAddress != address(0), "User not found");
        require(users[_userAddress].role == UserRole.User, "Not an authorized user");

        users[_userAddress].isActive = false;
        users[_userAddress].role = UserRole.None;

        emit AuthorizedUserRevoked(_userAddress, block.timestamp);
    }

    // =========================================================
    // LOCK MANAGEMENT
    // =========================================================

    function registerLock(
        address _lockAddress,
        string memory _name,
        string memory _lockId,
        string memory _publicKeyFingerprint
    ) external onlyOwnerOrAdmin {
        require(_lockAddress != address(0), "Invalid lock address");
        require(bytes(_name).length > 0, "Lock name required");
        require(bytes(_lockId).length > 0, "Lock ID required");
        require(bytes(_publicKeyFingerprint).length > 0, "Public key fingerprint required");

        require(lockDevices[_lockAddress].walletAddress == address(0), "Lock already registered");
        require(lockIdToAddress[_lockId] == address(0), "Lock ID already used");
        require(users[_lockAddress].role == UserRole.None, "Address already has a role");

        lockDevices[_lockAddress] = LockDevice({
            walletAddress: _lockAddress,
            name: _name,
            lockId: _lockId,
            publicKeyFingerprint: _publicKeyFingerprint,
            isApproved: false,
            isOnline: false,
            registeredAt: block.timestamp,
            lastSeenAt: 0
        });

        lockIdToAddress[_lockId] = _lockAddress;

        users[_lockAddress] = User({
            walletAddress: _lockAddress,
            role: UserRole.LockDevice,
            name: _name,
            isActive: true,
            registeredAt: block.timestamp
        });

        totalLocks++;
        totalUsers++;

        emit LockRegistered(
            _lockAddress,
            _name,
            _lockId,
            _publicKeyFingerprint,
            block.timestamp
        );
    }

    function approveLock(address _lockAddress) external onlyOwnerOrAdmin {
        require(lockDevices[_lockAddress].walletAddress != address(0), "Lock not registered");
        require(!lockDevices[_lockAddress].isApproved, "Lock already approved");

        lockDevices[_lockAddress].isApproved = true;

        emit LockApproved(_lockAddress, block.timestamp);
    }

    function rejectLock(address _lockAddress) external onlyOwnerOrAdmin {
        require(lockDevices[_lockAddress].walletAddress != address(0), "Lock not registered");

        lockDevices[_lockAddress].isApproved = false;
        lockDevices[_lockAddress].isOnline = false;

        emit LockRejected(_lockAddress, block.timestamp);
    }

    function sendHeartbeat(bool _isOnline) external onlyApprovedLock {
        lockDevices[msg.sender].isOnline = _isOnline;
        lockDevices[msg.sender].lastSeenAt = block.timestamp;

        emit LockHeartbeat(msg.sender, _isOnline, block.timestamp);
    }

    // =========================================================
    // COMMAND MANAGEMENT
    // =========================================================

    function submitEncryptedCommand(
        address _lockAddress,
        bytes memory _encryptedPayload,
        bytes memory _encryptedSessionKey,
        bytes memory _iv,
        bytes memory _authTag,
        uint256 _expiresAt,
        bytes32 _nonce
    ) external onlyAuthorizedUser returns (uint256) {
        require(_lockAddress != address(0), "Invalid lock address");
        require(lockDevices[_lockAddress].walletAddress != address(0), "Lock not registered");
        require(lockDevices[_lockAddress].isApproved, "Lock not approved");

        require(_encryptedPayload.length > 0, "Encrypted payload required");
        require(_encryptedSessionKey.length > 0, "Encrypted session key required");
        require(_iv.length > 0, "IV required");
        require(_authTag.length > 0, "Auth tag required");

        require(_expiresAt > block.timestamp, "Expiry must be in the future");
        require(_nonce != bytes32(0), "Nonce required");
        require(!usedNonces[msg.sender][_nonce], "Nonce already used");

        totalCommands++;
        usedNonces[msg.sender][_nonce] = true;

        commands[totalCommands] = CommandRecord({
            commandId: totalCommands,
            lockAddress: _lockAddress,
            submittedBy: msg.sender,
            encryptedPayload: _encryptedPayload,
            encryptedSessionKey: _encryptedSessionKey,
            iv: _iv,
            authTag: _authTag,
            submittedAt: block.timestamp,
            expiresAt: _expiresAt,
            nonce: _nonce,
            status: CommandStatus.Pending,
            executedAt: 0,
            executionResult: ""
        });

        emit CommandSubmitted(
            totalCommands,
            _lockAddress,
            msg.sender,
            block.timestamp,
            _expiresAt,
            _nonce
        );

        return totalCommands;
    }

    function markCommandExecuted(
        uint256 _commandId,
        bool _success,
        string memory _resultMessage
    ) external onlyApprovedLock {
        require(_commandId > 0 && _commandId <= totalCommands, "Invalid command ID");

        CommandRecord storage command = commands[_commandId];

        require(command.lockAddress == msg.sender, "Not target lock");
        require(command.status == CommandStatus.Pending, "Command already finalized");

        if (block.timestamp > command.expiresAt) {
            command.status = CommandStatus.Expired;
            command.executedAt = block.timestamp;
            command.executionResult = "Command expired before execution";

            emit CommandExecuted(
                _commandId,
                msg.sender,
                false,
                "Command expired before execution",
                block.timestamp
            );
            return;
        }

        command.status = _success ? CommandStatus.Executed : CommandStatus.Failed;
        command.executedAt = block.timestamp;
        command.executionResult = _resultMessage;

        emit CommandExecuted(
            _commandId,
            msg.sender,
            _success,
            _resultMessage,
            block.timestamp
        );
    }

    function cancelCommand(uint256 _commandId) external {
        require(_commandId > 0 && _commandId <= totalCommands, "Invalid command ID");

        CommandRecord storage command = commands[_commandId];

        require(command.submittedBy == msg.sender, "Only command sender can cancel");
        require(command.status == CommandStatus.Pending, "Command already finalized");

        command.status = CommandStatus.Cancelled;
        command.executedAt = block.timestamp;
        command.executionResult = "Command cancelled by sender";

        emit CommandCancelled(_commandId, msg.sender, block.timestamp);
    }

    // =========================================================
    // VIEW FUNCTIONS
    // =========================================================

    function isAuthorizedUser(address _userAddress) external view returns (bool) {
        return _isAuthorizedUser(_userAddress);
    }

    function getLockById(string memory _lockId) external view returns (address) {
        return lockIdToAddress[_lockId];
    }

    function getLockInfo(address _lockAddress)
        external
        view
        returns (
            string memory name,
            string memory lockId,
            string memory publicKeyFingerprint,
            bool isApproved,
            bool isOnline,
            uint256 registeredAt,
            uint256 lastSeenAt
        )
    {
        LockDevice memory lockDevice = lockDevices[_lockAddress];
        require(lockDevice.walletAddress != address(0), "Lock not found");

        return (
            lockDevice.name,
            lockDevice.lockId,
            lockDevice.publicKeyFingerprint,
            lockDevice.isApproved,
            lockDevice.isOnline,
            lockDevice.registeredAt,
            lockDevice.lastSeenAt
        );
    }

    function getCommand(uint256 _commandId)
        external
        view
        returns (
            address lockAddress,
            address submittedBy,
            bytes memory encryptedPayload,
            bytes memory encryptedSessionKey,
            bytes memory iv,
            bytes memory authTag,
            uint256 submittedAt,
            uint256 expiresAt,
            bytes32 nonce,
            CommandStatus status,
            uint256 executedAt,
            string memory executionResult
        )
    {
        require(_commandId > 0 && _commandId <= totalCommands, "Invalid command ID");

        CommandRecord memory command = commands[_commandId];

        return (
            command.lockAddress,
            command.submittedBy,
            command.encryptedPayload,
            command.encryptedSessionKey,
            command.iv,
            command.authTag,
            command.submittedAt,
            command.expiresAt,
            command.nonce,
            command.status,
            command.executedAt,
            command.executionResult
        );
    }

    function getUserInfo(address _userAddress)
        external
        view
        returns (
            UserRole role,
            string memory name,
            bool isActive,
            uint256 registeredAt
        )
    {
        User memory user = users[_userAddress];
        require(user.walletAddress != address(0), "User not found");

        return (
            user.role,
            user.name,
            user.isActive,
            user.registeredAt
        );
    }

    function getLockCount() external view returns (uint256) {
        return totalLocks;
    }

    function getCommandCount() external view returns (uint256) {
        return totalCommands;
    }
}