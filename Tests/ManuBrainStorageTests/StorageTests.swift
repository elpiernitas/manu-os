import XCTest
import CryptoKit
@testable import ManuBrainStorage
import ManuBrainDomain

/// Todos los datos son sintéticos.
final class StorageTests: XCTestCase {
    var dir: URL!
    var key: SymmetricKey!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory.appendingPathComponent("manu-brain-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        key = SymmetricKey(size: .bits256)
    }

    override func tearDownWithError() throws { try? FileManager.default.removeItem(at: dir) }

    var dbURL: URL { dir.appendingPathComponent("vault.sqlite") }
    let secretText = "SYNTHETIC-SENSITIVE-PAYLOAD-7f3a91"

    func allBytes() throws -> Data {
        var all = Data()
        for e in try FileManager.default.subpathsOfDirectory(atPath: dir.path).sorted() {
            var isDir: ObjCBool = false
            if FileManager.default.fileExists(atPath: dir.appendingPathComponent(e).path, isDirectory: &isDir), !isDir.boolValue {
                all.append(try Data(contentsOf: dir.appendingPathComponent(e)))
            }
        }
        return all
    }

    // MARK: Persistencia, transacciones, reapertura

    func testPutGetReopen() throws {
        do {
            let s = try SQLiteLocalStore(url: dbURL, key: key)
            try s.put(collection: "fragment", id: "a1", plaintext: Data(secretText.utf8))
            XCTAssertEqual(try s.schemaVersion(), SQLiteLocalStore.latestSchemaVersion)
            XCTAssertTrue(try s.foreignKeysEnabled())
            XCTAssertTrue(try s.secureDeleteEnabled())
        }
        let s2 = try SQLiteLocalStore(url: dbURL, key: key)
        XCTAssertEqual(try s2.get(collection: "fragment", id: "a1"), Data(secretText.utf8))
        XCTAssertNil(try s2.get(collection: "fragment", id: "zz"))
        XCTAssertEqual(try s2.ids(in: "fragment"), ["a1"])
    }

    func testTransactionCommitAndRollback() throws {
        let s = try SQLiteLocalStore(url: dbURL, key: key)
        struct Boom: Error {}
        XCTAssertThrowsError(try s.transaction { tx -> Void in
            try tx.put(collection: "c", id: "x", plaintext: Data("1".utf8))
            throw Boom()
        })
        XCTAssertNil(try s.get(collection: "c", id: "x"), "rollback debe descartar la escritura")
        try s.transaction { tx in
            try tx.put(collection: "c", id: "x", plaintext: Data("1".utf8))
            try tx.put(collection: "c", id: "y", plaintext: Data("2".utf8))
        }
        XCTAssertEqual(try s.ids(in: "c"), ["x", "y"])
        // Tras un rollback el almacén sigue utilizable.
        XCTAssertThrowsError(try s.transaction { tx -> Void in try tx.delete(collection: "c", id: "x"); throw Boom() })
        XCTAssertNotNil(try s.get(collection: "c", id: "x"))
    }

    func testDuplicatePutOverwritesSingleRow() throws {
        let s = try SQLiteLocalStore(url: dbURL, key: key)
        try s.put(collection: "c", id: "x", plaintext: Data("old".utf8))
        try s.put(collection: "c", id: "x", plaintext: Data("new".utf8))
        XCTAssertEqual(try s.ids(in: "c"), ["x"])
        XCTAssertEqual(try s.get(collection: "c", id: "x"), Data("new".utf8))
    }

    func testInvalidIdentifiersRejected() throws {
        let s = try SQLiteLocalStore(url: dbURL, key: key)
        for bad in ["", "a|b", "../x", String(repeating: "a", count: 129)] {
            XCTAssertThrowsError(try s.put(collection: "c", id: bad, plaintext: Data()))
        }
    }

    func testForeignKeyRejectsLinkToMissingRecord() throws {
        let s = try SQLiteLocalStore(url: dbURL, key: key)
        let blobs = try FileBlobStore(directory: dir.appendingPathComponent("blobs"), key: key)
        let id = try blobs.put(Data("x".utf8))
        XCTAssertThrowsError(try s.transaction { try $0.linkBlob(id, toCollection: "source", id: "missing") })
    }

    // MARK: Migraciones

    func testMigrationFromEveryPreviousVersion() throws {
        for from in 1..<Migrations.latest {
            let url = dir.appendingPathComponent("m\(from).sqlite")
            do {
                let raw = try SQLiteDatabase(path: url.path)
                try Migrations.migrate(raw, to: from)
                XCTAssertEqual(try raw.userVersion, from)
                if from == 1 {
                    try raw.run("INSERT INTO records (collection, id, sealed) VALUES ('c','legacy',?)",
                                [.blob(try Sealer.seal(Data("legacy".utf8), key: key, aad: Data("manu.record.v1|c|legacy".utf8)))])
                }
            }
            let s = try SQLiteLocalStore(url: url, key: key)
            XCTAssertEqual(try s.schemaVersion(), Migrations.latest)
            XCTAssertEqual(try s.get(collection: "c", id: "legacy"), Data("legacy".utf8))
            XCTAssertNoThrow(try s.transaction { tx in
                try tx.linkBlob(try BlobID(hex: String(repeating: "a", count: 64)), toCollection: "c", id: "legacy")
            })
        }
    }

    func testFutureSchemaVersionIsRejectedAndUntouched() throws {
        let future = Migrations.latest + 41
        do {
            let raw = try SQLiteDatabase(path: dbURL.path)
            try Migrations.migrate(raw)
            try raw.exec("PRAGMA user_version = \(future)")
        }
        let before = try Data(contentsOf: dbURL)
        XCTAssertThrowsError(try SQLiteLocalStore(url: dbURL, key: key)) {
            XCTAssertEqual($0 as? StorageError, .unsupportedSchemaVersion(future))
        }
        XCTAssertEqual(try Data(contentsOf: dbURL), before)
    }

    // MARK: Cifrado

    func testNoPlaintextOnDisk() throws {
        let s = try SQLiteLocalStore(url: dbURL, key: key)
        let blobs = try FileBlobStore(directory: dir.appendingPathComponent("blobs"), key: key)
        try s.put(collection: "fragment", id: "f1", plaintext: Data(secretText.utf8))
        let b = try blobs.put(Data(secretText.utf8))
        try s.put(collection: "source", id: "s1", plaintext: Data("meta".utf8))
        try s.transaction { try $0.linkBlob(b, toCollection: "source", id: "s1") }
        try s.compact()
        let bytes = try allBytes()
        XCTAssertNil(bytes.range(of: Data(secretText.utf8)))
        XCTAssertNil(bytes.range(of: Data("SYNTHETIC-SENSITIVE".utf8)))
        XCTAssertNotNil(bytes.range(of: Data("SQLite format 3".utf8)), "la inspección sí lee el archivo SQLite")
    }

    func testWrongKeyFails() throws {
        let s = try SQLiteLocalStore(url: dbURL, key: key)
        try s.put(collection: "c", id: "x", plaintext: Data("v".utf8))
        let other = try SQLiteLocalStore(url: dbURL, key: SymmetricKey(size: .bits256))
        XCTAssertThrowsError(try other.get(collection: "c", id: "x")) { XCTAssertEqual($0 as? StorageError, .decryptionFailed) }
    }

    func testTamperedCiphertextFails() throws {
        let s = try SQLiteLocalStore(url: dbURL, key: key)
        try s.put(collection: "c", id: "x", plaintext: Data("value".utf8))
        let raw = try SQLiteDatabase(path: dbURL.path)
        guard case .blob(var sealed)? = try raw.run("SELECT sealed FROM records").first?.first else { return XCTFail() }
        sealed[sealed.count / 2] ^= 0x01
        try raw.run("UPDATE records SET sealed = ?", [.blob(sealed)])
        XCTAssertThrowsError(try s.get(collection: "c", id: "x")) { XCTAssertEqual($0 as? StorageError, .decryptionFailed) }
    }

    func testTamperedMetadataFails() throws {
        let s = try SQLiteLocalStore(url: dbURL, key: key)
        try s.put(collection: "c", id: "x", plaintext: Data("value".utf8))
        let raw = try SQLiteDatabase(path: dbURL.path)
        try raw.run("UPDATE records SET id = 'y'")           // el ciphertext ya no corresponde a su id
        XCTAssertThrowsError(try s.get(collection: "c", id: "y")) { XCTAssertEqual($0 as? StorageError, .decryptionFailed) }
        try raw.run("UPDATE records SET id = 'x', collection = 'other'")
        XCTAssertThrowsError(try s.get(collection: "other", id: "x")) { XCTAssertEqual($0 as? StorageError, .decryptionFailed) }
    }

    func testNonceNeverReused() throws {
        var nonces = Set<Data>()
        for _ in 0..<2000 {
            let sealed = try Sealer.seal(Data("same".utf8), key: key, aad: Data("aad".utf8))
            XCTAssertTrue(nonces.insert(sealed.prefix(Sealer.nonceLength)).inserted)
        }
        let s = try SQLiteLocalStore(url: dbURL, key: key)
        for _ in 0..<3 { try s.put(collection: "c", id: "x", plaintext: Data("same".utf8)) }
    }

    func testShortOrEmptySealedDataRejected() {
        XCTAssertThrowsError(try Sealer.open(Data(count: 5), key: key, aad: Data()))
    }

    // MARK: Blobs

    func testBlobRoundTripDuplicateAndIntegrity() throws {
        let blobs = try FileBlobStore(directory: dir.appendingPathComponent("blobs"), key: key)
        let a = try blobs.put(Data(secretText.utf8))
        let b = try blobs.put(Data(secretText.utf8))
        XCTAssertEqual(a, b)
        XCTAssertEqual(try FileManager.default.contentsOfDirectory(atPath: dir.appendingPathComponent("blobs").path).count, 1)
        XCTAssertEqual(try blobs.get(a), Data(secretText.utf8))
        XCTAssertNotEqual(try blobs.put(Data("other".utf8)), a)

        // Manipulación de un byte.
        let file = dir.appendingPathComponent("blobs/\(a.hex).blob")
        var bytes = try Data(contentsOf: file)
        bytes[bytes.count - 1] ^= 0xff
        try bytes.write(to: file)
        XCTAssertThrowsError(try blobs.get(a))
        // Un put del mismo contenido repara el archivo corrupto.
        XCTAssertEqual(try blobs.put(Data(secretText.utf8)), a)
        XCTAssertEqual(try blobs.get(a), Data(secretText.utf8))
    }

    func testBlobSwappedFilesDetected() throws {
        let blobs = try FileBlobStore(directory: dir.appendingPathComponent("blobs"), key: key)
        let a = try blobs.put(Data("aaa".utf8)), b = try blobs.put(Data("bbb".utf8))
        let fa = dir.appendingPathComponent("blobs/\(a.hex).blob"), fb = dir.appendingPathComponent("blobs/\(b.hex).blob")
        try Data(contentsOf: fb).write(to: fa)
        XCTAssertThrowsError(try blobs.get(a))
    }

    func testBlobIDRejectsTraversal() {
        for bad in ["../etc/passwd", String(repeating: "A", count: 64), "abc"] {
            XCTAssertThrowsError(try BlobID(hex: bad))
        }
    }

    func testBlobMissingAndEmpty() throws {
        let blobs = try FileBlobStore(directory: dir.appendingPathComponent("blobs"), key: key)
        let empty = try blobs.put(Data())
        XCTAssertEqual(try blobs.get(empty), Data())
        try blobs.delete(empty)
        XCTAssertFalse(blobs.exists(empty))
        XCTAssertThrowsError(try blobs.get(empty)) { XCTAssertEqual($0 as? StorageError, .notFound) }
    }

    // MARK: Argon2id y claves

    func hex(_ d: Data) -> String { d.map { String(format: "%02x", $0) }.joined() }

    func testArgon2idKnownVectors() throws {
        // Vector de test.c de la implementación de referencia (P-H-C, rev. f57e61e): argon2id v1.3, t=2, m=64 MiB, p=1.
        let v = try KeyDerivation.argon2idUnchecked(
            secret: Data("password".utf8), salt: Data("somesalt".utf8),
            parameters: try Argon2Parameters(iterations: 2, memoryKiB: 65_536, parallelism: 1), outputLength: 32)
        XCTAssertEqual(hex(v), "09316115d5cf24ed5a15a31a3ba326e5cf32edc24702987c02b6566f61913cf7")
        // Perfil ligero de CI, valor generado con la misma implementación de referencia compilada con gcc.
        let ci = try KeyDerivation.argon2id(
            secret: Data("correct horse synthetic".utf8), salt: Data("0123456789abcdef".utf8), parameters: .testing)
        XCTAssertEqual(hex(ci), "522fefc6b7151c5d7717eeb76e999dc0db02b32f5b5b885ca8b6d1296af1e6db")
    }

    func testArgon2Limits() {
        XCTAssertThrowsError(try Argon2Parameters(iterations: 0, memoryKiB: 64, parallelism: 1))
        XCTAssertThrowsError(try Argon2Parameters(iterations: 1, memoryKiB: 4, parallelism: 1))
        XCTAssertThrowsError(try Argon2Parameters(iterations: 1, memoryKiB: Argon2Parameters.maxMemoryKiB + 1, parallelism: 1))
        XCTAssertThrowsError(try Argon2Parameters(iterations: 11, memoryKiB: 64, parallelism: 1))
        XCTAssertThrowsError(try Argon2Parameters(iterations: 1, memoryKiB: 64, parallelism: 9))
        XCTAssertThrowsError(try KeyDerivation.argon2id(secret: Data("s".utf8), salt: Data(count: 8), parameters: .testing))
        XCTAssertThrowsError(try KeyDerivation.argon2id(secret: Data(), salt: Data(count: 16), parameters: .testing))
        // Un WrappedKey manipulado con parámetros abusivos no llega a derivar.
        let json = Data(#"{"iterations":1,"memoryKiB":4294967295,"parallelism":1}"#.utf8)
        XCTAssertThrowsError(try JSONDecoder().decode(Argon2Parameters.self, from: json))
    }

    func testWrapUnwrapDEK() throws {
        let dek = VaultKeys.generateDEK()
        let salt = Data((0..<16).map { UInt8($0) })
        let wrapped = try VaultKeys.wrap(dek: dek, vaultID: "vault-1", recoverySecret: "synthetic recovery secret", salt: salt, parameters: .testing)
        let back = try VaultKeys.unwrap(wrapped, vaultID: "vault-1", recoverySecret: "synthetic recovery secret")
        XCTAssertEqual(back.withUnsafeBytes { Data($0) }, dek.withUnsafeBytes { Data($0) })
        XCTAssertNil(wrapped.sealed.range(of: dek.withUnsafeBytes { Data($0) }))
        XCTAssertThrowsError(try VaultKeys.unwrap(wrapped, vaultID: "vault-1", recoverySecret: "wrong secret"))
        XCTAssertThrowsError(try VaultKeys.unwrap(wrapped, vaultID: "vault-2", recoverySecret: "synthetic recovery secret"))
        let decoded = try JSONDecoder().decode(WrappedKey.self, from: JSONEncoder().encode(wrapped))
        XCTAssertEqual(decoded, wrapped)
    }

    func testInMemoryKeyStore() throws {
        let ks = InMemoryKeyStore()
        XCTAssertNil(try ks.load(named: "k"))
        try ks.store(Data([1, 2, 3]), named: "k")
        XCTAssertEqual(try ks.load(named: "k"), Data([1, 2, 3]))
        try ks.remove(named: "k")
        XCTAssertNil(try ks.load(named: "k"))
    }

    // MARK: Borrado derivado de SourceDeletionEvent

    func uuid(_ n: Int) throws -> UUIDv7 {
        try UUIDv7(rawValue: String(format: "018f0000-0000-7000-8000-%012x", n))
    }

    func makeSource(_ id: UUIDv7) throws -> Source {
        Source(id: id, kind: "note", importedAt: try UTCTimestamp(rawValue: "2026-01-01T00:00:00Z"),
               authorAgentID: try uuid(99), retentionPolicy: .full, originalRetained: true,
               originalHash: nil, sensitivity: .sensitive)
    }

    func testSourceDeletionEventFlow() throws {
        let store = try SQLiteLocalStore(url: dbURL, key: key)
        let blobs = try FileBlobStore(directory: dir.appendingPathComponent("blobs"), key: key)
        let sid = try uuid(1)
        let shared = try blobs.put(Data("shared-synthetic".utf8))
        let exclusive = try blobs.put(Data(secretText.utf8))
        try store.transaction { tx in
            try tx.put(collection: StorageCollections.source, id: sid.rawValue, plaintext: try JSONEncoder().encode(try makeSource(sid)))
            try tx.put(collection: StorageCollections.source, id: try uuid(2).rawValue, plaintext: try JSONEncoder().encode(try makeSource(try uuid(2))))
            try tx.linkBlob(exclusive, toCollection: StorageCollections.source, id: sid.rawValue)
            try tx.linkBlob(shared, toCollection: StorageCollections.source, id: sid.rawValue)
            try tx.linkBlob(shared, toCollection: StorageCollections.source, id: try uuid(2).rawValue)
        }
        // Bytes del registro cifrado antes del borrado, para comprobar que dejan de estar en el archivo.
        let raw = try SQLiteDatabase(path: dbURL.path, readOnly: true)
        let rows = try raw.run("SELECT sealed FROM records WHERE id = ?", [.text(sid.rawValue)])
        guard case .blob(let sealedBefore)? = rows.first?.first else { return XCTFail() }
        XCTAssertNotNil(try Data(contentsOf: dbURL).range(of: sealedBefore))

        let compactionsBefore = store.compactionCount
        let event = SourceDeletionEvent(id: try uuid(10), sourceID: sid, scope: "MANU_OS",
                                        requestedAt: try UTCTimestamp(rawValue: "2026-01-02T00:00:00Z"),
                                        confirmedByAgentID: try uuid(99), result: .requested)
        let done = try SourceDeletionService(store: store, blobs: blobs).apply(event)

        XCTAssertEqual(done.result, .completed)
        XCTAssertNotNil(done.completedAt)
        XCTAssertNil(try store.get(collection: StorageCollections.source, id: sid.rawValue))
        XCTAssertFalse(blobs.exists(exclusive))
        XCTAssertThrowsError(try blobs.get(exclusive))
        XCTAssertTrue(blobs.exists(shared), "un blob compartido con otra fuente no se borra")
        XCTAssertNotNil(try store.get(collection: StorageCollections.source, id: try uuid(2).rawValue))
        XCTAssertTrue(try store.secureDeleteEnabled())
        XCTAssertEqual(store.compactionCount, compactionsBefore + 1)
        XCTAssertEqual(try store.freelistCount(), 0, "tras VACUUM no quedan páginas libres")
        XCTAssertNil(try Data(contentsOf: dbURL).range(of: sealedBefore), "el ciphertext borrado no permanece en el archivo")
        let stored = try store.get(collection: StorageCollections.sourceDeletionEvent, id: event.id.rawValue)
        XCTAssertEqual(try JSONDecoder().decode(SourceDeletionEvent.self, from: XCTUnwrap(stored)).result, .completed)
        XCTAssertNil(try allBytes().range(of: Data(secretText.utf8)))
    }

    func testSourceDeletionUnknownSourceAndInvalidEvent() throws {
        let store = try SQLiteLocalStore(url: dbURL, key: key)
        let blobs = try FileBlobStore(directory: dir.appendingPathComponent("blobs"), key: key)
        let service = SourceDeletionService(store: store, blobs: blobs)
        let e = SourceDeletionEvent(id: try uuid(11), sourceID: try uuid(5), scope: "MANU_OS",
                                    requestedAt: try UTCTimestamp(rawValue: "2026-01-02T00:00:00Z"),
                                    confirmedByAgentID: try uuid(99), result: .requested)
        XCTAssertEqual(try service.apply(e).result, .notRetained)
        let completed = SourceDeletionEvent(id: try uuid(12), sourceID: try uuid(5), scope: "MANU_OS",
                                            requestedAt: try UTCTimestamp(rawValue: "2026-01-02T00:00:00Z"),
                                            confirmedByAgentID: try uuid(99), result: .completed)
        XCTAssertThrowsError(try service.apply(completed)) { XCTAssertEqual($0 as? StorageError, .invalidDeletionEvent) }
    }
}
