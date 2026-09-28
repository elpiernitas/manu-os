import Foundation
import ManuBrainDomain

public enum StorageCollections {
    public static let source = "source"
    public static let sourceDeletionEvent = "source_deletion_event"
}

/// Ejecuta un `SourceDeletionEvent` (ADR-0008, ADR-0011 §7) contra los puertos.
/// Orden: (1) borra blobs exclusivos de la fuente (idempotente); (2) en una transacción borra
/// el registro y guarda el evento COMPLETED; (3) `VACUUM`. Si (1) falla se guarda FAILED y el
/// registro se conserva para poder reintentar. No garantiza borrado físico del medio.
public struct SourceDeletionService {
    private let store: LocalStore
    private let blobs: BlobStore
    private let clock: () -> Date

    public init(store: LocalStore, blobs: BlobStore, clock: @escaping () -> Date = Date.init) {
        self.store = store
        self.blobs = blobs
        self.clock = clock
    }

    private func now() throws -> UTCTimestamp {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return try UTCTimestamp(rawValue: f.string(from: clock()))
    }

    private func finished(_ e: SourceDeletionEvent, _ result: SourceDeletionEvent.Result, note: String?) throws -> SourceDeletionEvent {
        SourceDeletionEvent(
            id: e.id, sourceID: e.sourceID, scope: e.scope, requestedAt: e.requestedAt,
            confirmedByAgentID: e.confirmedByAgentID, result: result,
            completedAt: try now(), note: note ?? e.note
        )
    }

    private func save(_ e: SourceDeletionEvent, in tx: LocalStoreTransaction) throws {
        try tx.put(collection: StorageCollections.sourceDeletionEvent, id: e.id.rawValue, plaintext: try JSONEncoder().encode(e))
    }

    @discardableResult
    public func apply(_ event: SourceDeletionEvent) throws -> SourceDeletionEvent {
        guard event.result == .requested else { throw StorageError.invalidDeletionEvent }
        let sid = event.sourceID.rawValue
        let plan: [BlobID]? = try store.transaction { tx in
            guard try tx.get(collection: StorageCollections.source, id: sid) != nil else { return nil }
            return try tx.blobs(forCollection: StorageCollections.source, id: sid).filter {
                try !tx.isBlobReferenced($0, excludingCollection: StorageCollections.source, id: sid)
            }
        }
        guard let exclusive = plan else {
            let result = try finished(event, .notRetained, note: "source not found")
            try store.transaction { try save(result, in: $0) }
            return result
        }
        do {
            for blob in exclusive { try blobs.delete(blob) }
        } catch {
            let failed = try finished(event, .failed, note: "blob deletion failed")
            try store.transaction { try save(failed, in: $0) }
            throw error
        }
        let done = try finished(event, .completed, note: nil)
        try store.transaction { tx in
            try tx.delete(collection: StorageCollections.source, id: sid)
            try save(done, in: tx)
        }
        try store.compact()
        return done
    }
}
