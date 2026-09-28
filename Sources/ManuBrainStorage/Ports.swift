import Foundation

/// Errores del núcleo de persistencia. No incluyen material de claves ni contenido.
public enum StorageError: Error, Equatable, Sendable {
    case unsupportedSchemaVersion(Int)
    case sqlite(code: Int32, message: String)
    case invalidIdentifier(String)
    case notFound
    case integrityFailure
    case decryptionFailed
    case invalidKeyMaterial
    case invalidKDFParameters
    case invalidSealedData
    case invalidDeletionEvent
}

/// Puerto de almacenamiento estructurado. Las capas superiores no conocen SQLite.
public protocol LocalStoreTransaction {
    func put(collection: String, id: String, plaintext: Data) throws
    func get(collection: String, id: String) throws -> Data?
    func delete(collection: String, id: String) throws
    func ids(in collection: String) throws -> [String]
    func linkBlob(_ blob: BlobID, toCollection collection: String, id: String) throws
    func blobs(forCollection collection: String, id: String) throws -> [BlobID]
    /// Blobs enlazados desde otros registros distintos del indicado.
    func isBlobReferenced(_ blob: BlobID, excludingCollection collection: String, id: String) throws -> Bool
}

public protocol LocalStore: AnyObject, Sendable {
    /// Ejecuta `body` en una transacción explícita: commit si retorna, rollback si lanza.
    func transaction<T>(_ body: (LocalStoreTransaction) throws -> T) throws -> T
    func schemaVersion() throws -> Int
    /// Compactación controlada (`VACUUM`).
    func compact() throws
}

public extension LocalStore {
    func put(collection: String, id: String, plaintext: Data) throws {
        try transaction { try $0.put(collection: collection, id: id, plaintext: plaintext) }
    }
    func get(collection: String, id: String) throws -> Data? {
        try transaction { try $0.get(collection: collection, id: id) }
    }
    func delete(collection: String, id: String) throws {
        try transaction { try $0.delete(collection: collection, id: id) }
    }
    func ids(in collection: String) throws -> [String] {
        try transaction { try $0.ids(in: collection) }
    }
}

/// Dirección de un blob: HMAC-SHA256 (hex, 64 caracteres) del contenido con una subclave del vault.
public struct BlobID: Hashable, Sendable {
    public let hex: String
    public init(hex: String) throws {
        guard hex.count == 64, hex.utf8.allSatisfy({ ($0 >= 48 && $0 <= 57) || ($0 >= 97 && $0 <= 102) }) else {
            throw StorageError.invalidIdentifier("blob")
        }
        self.hex = hex
    }
}

public protocol BlobStore: AnyObject, Sendable {
    func put(_ data: Data) throws -> BlobID
    func get(_ id: BlobID) throws -> Data
    func exists(_ id: BlobID) -> Bool
    func delete(_ id: BlobID) throws
}

/// Custodia de claves. Keychain real pertenece a BRAIN-02b; aquí solo hay un puerto.
public protocol KeyStore: AnyObject, Sendable {
    func store(_ key: Data, named name: String) throws
    func load(named name: String) throws -> Data?
    func remove(named name: String) throws
}

/// Implementación solo para pruebas.
public final class InMemoryKeyStore: KeyStore, @unchecked Sendable {
    private let lock = NSLock()
    private var keys: [String: Data] = [:]
    public init() {}
    public func store(_ key: Data, named name: String) throws {
        lock.lock(); defer { lock.unlock() }
        keys[name] = key
    }
    public func load(named name: String) throws -> Data? {
        lock.lock(); defer { lock.unlock() }
        return keys[name]
    }
    public func remove(named name: String) throws {
        lock.lock(); defer { lock.unlock() }
        keys[name] = nil
    }
}
