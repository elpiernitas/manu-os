import Foundation
import CryptoKit

enum FileProtection {
    /// `NSFileProtectionCompleteUntilFirstUserAuthentication` (ADR-0011 §3). Solo iOS; no verificado en dispositivo.
    static func apply(to url: URL) {
        #if os(iOS)
        try? FileManager.default.setAttributes(
            [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path
        )
        #endif
    }
}

/// Blobs cifrados fuera de SQLite. El nombre es HMAC-SHA256(subclave, contenido): no revela
/// el hash del contenido a quien solo tenga el disco, y permite verificar integridad al leer.
public final class FileBlobStore: BlobStore, @unchecked Sendable {
    private let directory: URL
    private let encryptionKey: SymmetricKey
    private let addressKey: SymmetricKey
    private let lock = NSLock()

    public init(directory: URL, key: SymmetricKey) throws {
        guard key.bitCount == 256 else { throw StorageError.invalidKeyMaterial }
        self.directory = directory
        self.encryptionKey = VaultKeys.subkey(key, info: "manu.blob.enc.v1")
        self.addressKey = VaultKeys.subkey(key, info: "manu.blob.addr.v1")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        FileProtection.apply(to: directory)
    }

    private func address(of data: Data) throws -> BlobID {
        try BlobID(hex: HMAC<SHA256>.authenticationCode(for: data, using: addressKey).map { String(format: "%02x", $0) }.joined())
    }

    private func url(_ id: BlobID) -> URL { directory.appendingPathComponent(id.hex + ".blob") }
    private static func aad(_ id: BlobID) -> Data { Data("manu.blob.v1|\(id.hex)".utf8) }

    public func put(_ data: Data) throws -> BlobID {
        lock.lock(); defer { lock.unlock() }
        let id = try address(of: data)
        // Duplicado: si el existente verifica, se conserva (idempotente); si está corrupto, se reescribe.
        if let existing = try? read(id), existing == data { return id }
        let sealed = try Sealer.seal(data, key: encryptionKey, aad: Self.aad(id))
        try sealed.write(to: url(id), options: .atomic)
        FileProtection.apply(to: url(id))
        return id
    }

    public func get(_ id: BlobID) throws -> Data {
        lock.lock(); defer { lock.unlock() }
        return try read(id)
    }

    private func read(_ id: BlobID) throws -> Data {
        guard let sealed = try? Data(contentsOf: url(id)) else { throw StorageError.notFound }
        let data = try Sealer.open(sealed, key: encryptionKey, aad: Self.aad(id))
        // Verificación de integridad independiente del AEAD: el contenido debe corresponder a su dirección.
        guard try address(of: data) == id else { throw StorageError.integrityFailure }
        return data
    }

    public func exists(_ id: BlobID) -> Bool {
        lock.lock(); defer { lock.unlock() }
        return FileManager.default.fileExists(atPath: url(id).path)
    }

    /// Sobrescribe con ceros y elimina. En APFS/SSD no hay garantía de borrado físico (wear leveling, snapshots).
    public func delete(_ id: BlobID) throws {
        lock.lock(); defer { lock.unlock() }
        let path = url(id)
        guard FileManager.default.fileExists(atPath: path.path) else { return }
        if let size = (try? FileManager.default.attributesOfItem(atPath: path.path)[.size]) as? Int, size > 0,
           let handle = try? FileHandle(forWritingTo: path) {
            try? handle.write(contentsOf: Data(count: size))
            try? handle.synchronize()
            try? handle.close()
        }
        try FileManager.default.removeItem(at: path)
    }
}
