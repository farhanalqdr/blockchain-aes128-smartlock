// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import {GydPlatform} from "./GydPlatform.sol";
import {Test} from "forge-std/Test.sol";

contract GydPlatformTest is Test {
    GydPlatform platform;

    address owner = address(0x1);
    address admin = address(0x2);
    address authorizedUser = address(0x3);
    address lockDevice = address(0x4);

    string ownerName = "Alice Owner";
    string adminName = "Bob Admin";
    string userName = "Charlie User";
    string lockName = "Front Door Lock";
    string lockId = "LOCK_001";
    string publicKeyFingerprint = "fingerprint-lock-001";

    function setUp() public {
        vm.prank(owner);
        platform = new GydPlatform(ownerName, address(0), "");
    }

    function test_InitialState() public view {
        assertEq(platform.owner(), owner);
        assertEq(platform.admin(), address(0));
        assertEq(platform.totalUsers(), 1);
        assertEq(platform.totalLocks(), 0);
        assertEq(platform.totalCommands(), 0);

        (GydPlatform.UserRole role, string memory name, bool isActive, uint256 registeredAt) =
            platform.getUserInfo(owner);

        assertEq(uint256(role), uint256(GydPlatform.UserRole.Owner));
        assertEq(name, ownerName);
        assertTrue(isActive);
        assertGt(registeredAt, 0);
    }

    function test_RegisterAdmin() public {
        vm.prank(owner);
        platform.registerAdmin(admin, adminName);

        assertEq(platform.admin(), admin);
        assertEq(platform.totalUsers(), 2);

        (GydPlatform.UserRole role, string memory name, bool isActive, uint256 registeredAt) =
            platform.getUserInfo(admin);

        assertEq(uint256(role), uint256(GydPlatform.UserRole.Admin));
        assertEq(name, adminName);
        assertTrue(isActive);
        assertGt(registeredAt, 0);
    }

    function test_RegisterAuthorizedUser() public {
        vm.prank(owner);
        platform.registerAuthorizedUser(authorizedUser, userName);

        assertEq(platform.totalUsers(), 2);

        (GydPlatform.UserRole role, string memory name, bool isActive, uint256 registeredAt) =
            platform.getUserInfo(authorizedUser);

        assertEq(uint256(role), uint256(GydPlatform.UserRole.User));
        assertEq(name, userName);
        assertTrue(isActive);
        assertGt(registeredAt, 0);
    }

    function test_RegisterAndApproveLock() public {
        vm.prank(owner);
        platform.registerLock(lockDevice, lockName, lockId, publicKeyFingerprint);

        assertEq(platform.totalLocks(), 1);
        assertEq(platform.totalUsers(), 2);

        (
            string memory name,
            string memory returnedLockId,
            string memory returnedFingerprint,
            bool isApproved,
            bool isOnline,
            uint256 registeredAt,
            uint256 lastSeenAt
        ) = platform.getLockInfo(lockDevice);

        assertEq(name, lockName);
        assertEq(returnedLockId, lockId);
        assertEq(returnedFingerprint, publicKeyFingerprint);
        assertFalse(isApproved);
        assertFalse(isOnline);
        assertGt(registeredAt, 0);
        assertEq(lastSeenAt, 0);

        vm.prank(owner);
        platform.approveLock(lockDevice);

        (, , , bool approvedAfter, , , ) = platform.getLockInfo(lockDevice);
        assertTrue(approvedAfter);
    }

    function test_SubmitEncryptedCommand() public {
        vm.startPrank(owner);
        platform.registerAuthorizedUser(authorizedUser, userName);
        platform.registerLock(lockDevice, lockName, lockId, publicKeyFingerprint);
        platform.approveLock(lockDevice);
        vm.stopPrank();

        bytes memory encryptedPayload = hex"11223344";
        bytes memory encryptedSessionKey = hex"55667788";
        bytes memory iv = hex"99aabbccddeeff00";
        bytes memory authTag = hex"00112233445566778899aabbccddeeff";
        bytes32 nonce = keccak256(abi.encodePacked("nonce-001"));
        uint256 expiresAt = block.timestamp + 60;

        vm.prank(authorizedUser);
        uint256 commandId = platform.submitEncryptedCommand(
            lockDevice,
            encryptedPayload,
            encryptedSessionKey,
            iv,
            authTag,
            expiresAt,
            nonce
        );

        assertEq(commandId, 1);
        assertEq(platform.totalCommands(), 1);

        (
            address targetLock,
            address submittedBy,
            bytes memory returnedPayload,
            bytes memory returnedSessionKey,
            bytes memory returnedIv,
            bytes memory returnedAuthTag,
            uint256 submittedAt,
            uint256 returnedExpiresAt,
            bytes32 returnedNonce,
            GydPlatform.CommandStatus status,
            uint256 executedAt,
            string memory executionResult
        ) = platform.getCommand(1);

        assertEq(targetLock, lockDevice);
        assertEq(submittedBy, authorizedUser);
        assertEq(keccak256(returnedPayload), keccak256(encryptedPayload));
        assertEq(keccak256(returnedSessionKey), keccak256(encryptedSessionKey));
        assertEq(keccak256(returnedIv), keccak256(iv));
        assertEq(keccak256(returnedAuthTag), keccak256(authTag));
        assertGt(submittedAt, 0);
        assertEq(returnedExpiresAt, expiresAt);
        assertEq(returnedNonce, nonce);
        assertEq(uint256(status), uint256(GydPlatform.CommandStatus.Pending));
        assertEq(executedAt, 0);
        assertEq(executionResult, "");
    }

    function test_MarkCommandExecuted() public {
        vm.startPrank(owner);
        platform.registerAuthorizedUser(authorizedUser, userName);
        platform.registerLock(lockDevice, lockName, lockId, publicKeyFingerprint);
        platform.approveLock(lockDevice);
        vm.stopPrank();

        bytes memory encryptedPayload = hex"11223344";
        bytes memory encryptedSessionKey = hex"55667788";
        bytes memory iv = hex"99aabbccddeeff00";
        bytes memory authTag = hex"00112233445566778899aabbccddeeff";
        bytes32 nonce = keccak256(abi.encodePacked("nonce-002"));
        uint256 expiresAt = block.timestamp + 60;

        vm.prank(authorizedUser);
        platform.submitEncryptedCommand(
            lockDevice,
            encryptedPayload,
            encryptedSessionKey,
            iv,
            authTag,
            expiresAt,
            nonce
        );

        vm.prank(lockDevice);
        platform.markCommandExecuted(1, true, "Unlocked successfully");

        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            GydPlatform.CommandStatus status,
            uint256 executedAt,
            string memory executionResult
        ) = platform.getCommand(1);

        assertEq(uint256(status), uint256(GydPlatform.CommandStatus.Executed));
        assertGt(executedAt, 0);
        assertEq(executionResult, "Unlocked successfully");
    }

    function test_CancelCommand() public {
        vm.startPrank(owner);
        platform.registerAuthorizedUser(authorizedUser, userName);
        platform.registerLock(lockDevice, lockName, lockId, publicKeyFingerprint);
        platform.approveLock(lockDevice);
        vm.stopPrank();

        bytes memory encryptedPayload = hex"11223344";
        bytes memory encryptedSessionKey = hex"55667788";
        bytes memory iv = hex"99aabbccddeeff00";
        bytes memory authTag = hex"00112233445566778899aabbccddeeff";
        bytes32 nonce = keccak256(abi.encodePacked("nonce-003"));
        uint256 expiresAt = block.timestamp + 60;

        vm.prank(authorizedUser);
        platform.submitEncryptedCommand(
            lockDevice,
            encryptedPayload,
            encryptedSessionKey,
            iv,
            authTag,
            expiresAt,
            nonce
        );

        vm.prank(authorizedUser);
        platform.cancelCommand(1);

        (
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            ,
            GydPlatform.CommandStatus status,
            uint256 executedAt,
            string memory executionResult
        ) = platform.getCommand(1);

        assertEq(uint256(status), uint256(GydPlatform.CommandStatus.Cancelled));
        assertGt(executedAt, 0);
        assertEq(executionResult, "Command cancelled by sender");
    }
}