import Foundation
import CryptoKit
import argon2

/// Parámetros explícitos de Argon2id (RFC 9106). Coste en KiB de memoria.
public struct Argon2Parameters: Codable, Equatable, Sendable {
    public let iterations: UInt32
    public let memoryKiB: UInt32
    public let parallelism: UInt32

    public static let maxIterations: UInt32 = 10
    public static let maxMemoryKiB: UInt32 = 256 * 1024
    public static let maxParallelism: UInt32 = 8

    /// Perfil de producción: 64 MiB, 3 pasadas, 1 carril.
    public static let standard = Argon2Parameters(unchecked: 3, 65_536, 1)
    /// Perfil ligero solo para CI/pruebas.
    public static let testing = Argon2Parameters(unchecked: 1, 64, 1)

    private init(unchecked iterations: UInt32, _ memoryKiB: UInt32, _ parallelism: UInt32) {
        self.iterations = iterations
        self.memoryKiB = memoryKiB
        self.parallelism = parallelism
    }

    public init(iterations: UInt32, memoryKiB: UInt32, parallelism: UInt32) throws {
        guard (1...Self.maxIterations).contains(iterations),
              (1...Self.maxParallelism).contains(parallelism),
              memoryKiB >= 8 * parallelism, memoryKiB <= Self.maxMemoryKiB
        else { throw StorageError.invalidKDFParameters }
        self.iterations = iterations
        self.memoryKiB = memoryKiB
        self.parallelism = parallelism
    }

    public init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        try self.init(
            iterations: c.decode(UInt32.self, forKey: .iterations),
            memoryKiB: c.decode(UInt32.self, forKey: .memoryKiB),
            parallelism: c.decode(UInt32.self, forKey: .parallelism)
        )
    }
}

public enum KeyDerivation {
    public static let minimumSaltLength = 16

    /// Deriva 32 bytes con Argon2id v1.3. El secreto solo debe ser sintético en pruebas.
    public static func argon2id(
        secret: Data, salt: Data, parameters: Argon2Parameters, outputLength: Int = 32
    ) throws -> Data {
        guard salt.count >= minimumSaltLength else { throw StorageError.invalidKDFParameters }
        return try argon2idUnchecked(secret: secret, salt: salt, parameters: parameters, outputLength: outputLength)
    }

    /// Sin el mínimo de sal de MANU OS; existe para reproducir vectores oficiales (sal de 8 bytes).
    static func argon2idUnchecked(
        secret: Data, salt: Data, parameters: Argon2Parameters, outputLength: Int
    ) throws -> Data {
        guard !secret.isEmpty, salt.count >= 8, outputLength >= 16, outputLength <= 64 else {
            throw StorageError.invalidKDFParameters
        }
        var out = [UInt8](repeating: 0, count: outputLength)
        let rc: Int32 = secret.withUnsafeBytes { s in
            salt.withUnsafeBytes { t in
                argon2id_hash_raw(
                    parameters.iterations, parameters.memoryKiB, parameters.parallelism,
                    s.baseAddress, s.count, t.baseAddress, t.count, &out, outputLength
                )
            }
        }
        guard rc == 0 else { throw StorageError.invalidKDFParameters }
        return Data(out)
    }

    public static func deriveKEK(recoverySecret: String, salt: Data, parameters: Argon2Parameters) throws -> SymmetricKey {
        SymmetricKey(data: try argon2id(secret: Data(recoverySecret.utf8), salt: salt, parameters: parameters))
    }
}

/// DEK envuelta con la KEK: es lo único de la clave que puede persistirse en disco.
public struct WrappedKey: Codable, Equatable, Sendable {
    public let version: Int
    public let salt: Data
    public let parameters: Argon2Parameters
    public let sealed: Data
}

public enum VaultKeys {
    static func aadForKey(vaultID: String) -> Data { Data("manu.dek.v1|\(vaultID)".utf8) }

    public static func generateDEK() -> SymmetricKey { SymmetricKey(size: .bits256) }

    public static func wrap(dek: SymmetricKey, vaultID: String, recoverySecret: String,
                            salt: Data, parameters: Argon2Parameters) throws -> WrappedKey {
        let kek = try KeyDerivation.deriveKEK(recoverySecret: recoverySecret, salt: salt, parameters: parameters)
        let sealed = try Sealer.seal(dek.withUnsafeBytes { Data($0) }, key: kek, aad: aadForKey(vaultID: vaultID))
        return WrappedKey(version: 1, salt: salt, parameters: parameters, sealed: sealed)
    }

    public static func unwrap(_ wrapped: WrappedKey, vaultID: String, recoverySecret: String) throws -> SymmetricKey {
        guard wrapped.version == 1 else { throw StorageError.invalidSealedData }
        let kek = try KeyDerivation.deriveKEK(recoverySecret: recoverySecret, salt: wrapped.salt, parameters: wrapped.parameters)
        let raw = try Sealer.open(wrapped.sealed, key: kek, aad: aadForKey(vaultID: vaultID))
        guard raw.count == 32 else { throw StorageError.invalidKeyMaterial }
        return SymmetricKey(data: raw)
    }

    static func subkey(_ dek: SymmetricKey, info: String) -> SymmetricKey {
        HKDF<SHA256>.deriveKey(inputKeyMaterial: dek, salt: Data(), info: Data(info.utf8), outputByteCount: 32)
    }
}

/// AES-256-GCM. Formato: nonce(12) || ciphertext || tag(16). Nonce aleatorio por operación.
public enum Sealer {
    public static let nonceLength = 12
    public static let tagLength = 16

    public static func seal(_ plaintext: Data, key: SymmetricKey, aad: Data) throws -> Data {
        guard key.bitCount == 256 else { throw StorageError.invalidKeyMaterial }
        let box = try AES.GCM.seal(plaintext, using: key, nonce: AES.GCM.Nonce(), authenticating: aad)
        guard let combined = box.combined else { throw StorageError.invalidSealedData }
        return combined
    }

    public static func open(_ sealed: Data, key: SymmetricKey, aad: Data) throws -> Data {
        guard sealed.count >= nonceLength + tagLength else { throw StorageError.invalidSealedData }
        do {
            let box = try AES.GCM.SealedBox(combined: sealed)
            return try AES.GCM.open(box, using: key, authenticating: aad)
        } catch {
            throw StorageError.decryptionFailed
        }
    }
}
