import Foundation
import SQLite3

private let sqliteTransient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

/// Wrapper mínimo sobre el `sqlite3` del sistema. No es seguro entre hilos por sí mismo.
final class SQLiteDatabase {
    private var handle: OpaquePointer?

    init(path: String, readOnly: Bool = false) throws {
        let flags = readOnly ? SQLITE_OPEN_READONLY : (SQLITE_OPEN_READWRITE | SQLITE_OPEN_CREATE)
        let rc = sqlite3_open_v2(path, &handle, flags | SQLITE_OPEN_FULLMUTEX, nil)
        guard rc == SQLITE_OK else {
            let error = Self.error(handle, rc)
            sqlite3_close(handle)
            throw error
        }
        if !readOnly {
            try exec("PRAGMA foreign_keys = ON")
            try exec("PRAGMA secure_delete = ON")
            try exec("PRAGMA journal_mode = DELETE")
        }
    }

    deinit { sqlite3_close(handle) }

    static func error(_ handle: OpaquePointer?, _ code: Int32) -> StorageError {
        .sqlite(code: code, message: handle.map { String(cString: sqlite3_errmsg($0)) } ?? "open failed")
    }

    func exec(_ sql: String) throws {
        let rc = sqlite3_exec(handle, sql, nil, nil, nil)
        guard rc == SQLITE_OK else { throw Self.error(handle, rc) }
    }

    enum Value {
        case text(String)
        case blob(Data)
        case int(Int64)
    }

    /// Ejecuta una sentencia preparada y devuelve todas las filas.
    @discardableResult
    func run(_ sql: String, _ params: [Value] = []) throws -> [[Value]] {
        var stmt: OpaquePointer?
        var rc = sqlite3_prepare_v2(handle, sql, -1, &stmt, nil)
        guard rc == SQLITE_OK else { throw Self.error(handle, rc) }
        defer { sqlite3_finalize(stmt) }
        for (i, value) in params.enumerated() {
            let index = Int32(i + 1)
            switch value {
            case .text(let s):
                rc = sqlite3_bind_text(stmt, index, s, -1, sqliteTransient)
            case .int(let n):
                rc = sqlite3_bind_int64(stmt, index, n)
            case .blob(let d):
                rc = d.withUnsafeBytes { raw in
                    sqlite3_bind_blob(stmt, index, raw.baseAddress ?? UnsafeRawPointer(bitPattern: 1), Int32(d.count), sqliteTransient)
                }
            }
            guard rc == SQLITE_OK else { throw Self.error(handle, rc) }
        }
        var rows: [[Value]] = []
        while true {
            rc = sqlite3_step(stmt)
            if rc == SQLITE_DONE { break }
            guard rc == SQLITE_ROW else { throw Self.error(handle, rc) }
            var row: [Value] = []
            for col in 0..<sqlite3_column_count(stmt) {
                switch sqlite3_column_type(stmt, col) {
                case SQLITE_INTEGER:
                    row.append(.int(sqlite3_column_int64(stmt, col)))
                case SQLITE_BLOB:
                    let n = Int(sqlite3_column_bytes(stmt, col))
                    if n == 0 { row.append(.blob(Data())) } else {
                        row.append(.blob(Data(bytes: sqlite3_column_blob(stmt, col)!, count: n)))
                    }
                default:
                    row.append(.text(sqlite3_column_text(stmt, col).map { String(cString: $0) } ?? ""))
                }
            }
            rows.append(row)
        }
        return rows
    }

    func scalarInt(_ sql: String, _ params: [Value] = []) throws -> Int64 {
        if case .int(let n)? = try run(sql, params).first?.first { return n }
        throw StorageError.integrityFailure
    }

    var userVersion: Int {
        get throws { Int(try scalarInt("PRAGMA user_version")) }
    }
}

/// Migraciones versionadas y deterministas. Cada elemento lleva de la versión `n` a `n+1`.
enum Migrations {
    static let steps: [[String]] = [
        // v0 -> v1
        [
            """
            CREATE TABLE records (
                collection TEXT NOT NULL,
                id TEXT NOT NULL,
                sealed BLOB NOT NULL,
                PRIMARY KEY (collection, id)
            )
            """,
        ],
        // v1 -> v2: referencias a blobs con clave foránea y borrado en cascada
        [
            """
            CREATE TABLE blob_refs (
                collection TEXT NOT NULL,
                id TEXT NOT NULL,
                blob_hash TEXT NOT NULL,
                PRIMARY KEY (collection, id, blob_hash),
                FOREIGN KEY (collection, id) REFERENCES records (collection, id) ON DELETE CASCADE
            )
            """,
            "CREATE INDEX blob_refs_by_hash ON blob_refs (blob_hash)",
        ],
    ]

    static var latest: Int { steps.count }

    /// Migra hasta `target` (por defecto la última). Rechaza versiones futuras sin tocar el archivo.
    static func migrate(_ db: SQLiteDatabase, to target: Int = latest) throws {
        let current = try db.userVersion
        guard current >= 0, current <= latest else { throw StorageError.unsupportedSchemaVersion(current) }
        guard current < target else { return }
        try db.exec("BEGIN IMMEDIATE")
        do {
            for version in current..<target {
                for sql in steps[version] { try db.exec(sql) }
                try db.exec("PRAGMA user_version = \(version + 1)")
            }
            try db.exec("COMMIT")
        } catch {
            try? db.exec("ROLLBACK")
            throw error
        }
    }
}
