import Foundation
import CryptoKit

/// `LocalStore` sobre SQLite. Cada valor se cifra con AES-256-GCM; colección e id se
/// autentican como AAD, de modo que mover un ciphertext a otro registro falla al abrir.
/// Colección e id quedan en claro (son identificadores, nunca contenido).
public final class SQLiteLocalStore: LocalStore, @unchecked Sendable {
    private let db: SQLiteDatabase
    private let key: SymmetricKey
    private let lock = NSLock()
    private var compactions = 0

    /// Abre (y migra) el almacén. Lanza `unsupportedSchemaVersion` ante una versión futura.
    public init(url: URL, key: SymmetricKey) throws {
        guard key.bitCount == 256 else { throw StorageError.invalidKeyMaterial }
        self.db = try SQLiteDatabase(path: url.path)
        self.key = key
        try Migrations.migrate(db)
        FileProtection.apply(to: url)
    }

    public static var latestSchemaVersion: Int { Migrations.latest }

    public func schemaVersion() throws -> Int {
        lock.lock(); defer { lock.unlock() }
        return try db.userVersion
    }

    public func transaction<T>(_ body: (LocalStoreTransaction) throws -> T) throws -> T {
        lock.lock(); defer { lock.unlock() }
        try db.exec("BEGIN IMMEDIATE")
        do {
            let result = try body(Tx(db: db, key: key))
            try db.exec("COMMIT")
            return result
        } catch {
            try? db.exec("ROLLBACK")
            throw error
        }
    }

    public func compact() throws {
        lock.lock(); defer { lock.unlock() }
        try db.exec("VACUUM")
        compactions += 1
    }

    // MARK: Diagnóstico verificable (usado por las pruebas de borrado)

    public var compactionCount: Int {
        lock.lock(); defer { lock.unlock() }
        return compactions
    }

    public func secureDeleteEnabled() throws -> Bool {
        lock.lock(); defer { lock.unlock() }
        return try db.scalarInt("PRAGMA secure_delete") != 0
    }

    public func foreignKeysEnabled() throws -> Bool {
        lock.lock(); defer { lock.unlock() }
        return try db.scalarInt("PRAGMA foreign_keys") != 0
    }

    public func freelistCount() throws -> Int {
        lock.lock(); defer { lock.unlock() }
        return Int(try db.scalarInt("PRAGMA freelist_count"))
    }

    // MARK: Transacción

    private struct Tx: LocalStoreTransaction {
        let db: SQLiteDatabase
        let key: SymmetricKey

        static func validate(_ s: String) throws {
            guard !s.isEmpty, s.utf8.count <= 128,
                  s.utf8.allSatisfy({ ($0 >= 48 && $0 <= 57) || ($0 >= 65 && $0 <= 90) || ($0 >= 97 && $0 <= 122) || $0 == 45 || $0 == 95 || $0 == 46 })
            else { throw StorageError.invalidIdentifier(s) }
        }

        static func aad(_ collection: String, _ id: String) -> Data {
            Data("manu.record.v1|\(collection)|\(id)".utf8)
        }

        func put(collection: String, id: String, plaintext: Data) throws {
            try Self.validate(collection); try Self.validate(id)
            let sealed = try Sealer.seal(plaintext, key: key, aad: Self.aad(collection, id))
            try db.run(
                "INSERT INTO records (collection, id, sealed) VALUES (?, ?, ?) ON CONFLICT(collection, id) DO UPDATE SET sealed = excluded.sealed",
                [.text(collection), .text(id), .blob(sealed)]
            )
        }

        func get(collection: String, id: String) throws -> Data? {
            try Self.validate(collection); try Self.validate(id)
            let rows = try db.run("SELECT sealed FROM records WHERE collection = ? AND id = ?", [.text(collection), .text(id)])
            guard case .blob(let sealed)? = rows.first?.first else { return nil }
            return try Sealer.open(sealed, key: key, aad: Self.aad(collection, id))
        }

        func delete(collection: String, id: String) throws {
            try Self.validate(collection); try Self.validate(id)
            try db.run("DELETE FROM records WHERE collection = ? AND id = ?", [.text(collection), .text(id)])
        }

        func ids(in collection: String) throws -> [String] {
            try Self.validate(collection)
            return try db.run("SELECT id FROM records WHERE collection = ? ORDER BY id", [.text(collection)]).compactMap {
                if case .text(let s)? = $0.first { return s } else { return nil }
            }
        }

        func linkBlob(_ blob: BlobID, toCollection collection: String, id: String) throws {
            try Self.validate(collection); try Self.validate(id)
            // La clave foránea exige que el registro exista.
            try db.run(
                "INSERT OR IGNORE INTO blob_refs (collection, id, blob_hash) VALUES (?, ?, ?)",
                [.text(collection), .text(id), .text(blob.hex)]
            )
        }

        func blobs(forCollection collection: String, id: String) throws -> [BlobID] {
            try Self.validate(collection); try Self.validate(id)
            return try db.run("SELECT blob_hash FROM blob_refs WHERE collection = ? AND id = ? ORDER BY blob_hash", [.text(collection), .text(id)]).compactMap {
                if case .text(let s)? = $0.first { return try BlobID(hex: s) } else { return nil }
            }
        }

        func isBlobReferenced(_ blob: BlobID, excludingCollection collection: String, id: String) throws -> Bool {
            try db.scalarInt(
                "SELECT COUNT(*) FROM blob_refs WHERE blob_hash = ? AND NOT (collection = ? AND id = ?)",
                [.text(blob.hex), .text(collection), .text(id)]
            ) > 0
        }
    }
}
