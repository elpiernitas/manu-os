import Testing
import ManuBrainDomain // intentionally not @testable: this target sees only the public API

/// Future iPhone and Mac apps consume ManuBrainDomain as a separate module.
/// This target fails to compile if a public contract cannot be constructed
/// without decoding JSON.
struct PublicAPITests {
    @Test("Every public contract can be constructed from another module")
    func publicInitialisersExist() throws {
        let id = try UUIDv7(rawValue: "018f0000-0000-7000-8000-000000000001")
        let at = try UTCTimestamp(rawValue: "2026-01-01T00:00:00Z")

        let source = Source(
            id: id,
            kind: "synthetic",
            importedAt: at,
            authorAgentID: id,
            retentionPolicy: .extractedOnly,
            originalRetained: false,
            sensitivity: .normal
        )
        let item = SourceItem(id: id, sourceID: source.id, authorAgentID: id, contentHash: "h", sensitivity: .normal)
        let fragment = Fragment(
            id: id,
            sourceItemID: item.id,
            selector: [:],
            excerptHash: "h",
            derivedFromOriginal: false
        )
        let deletion = SourceDeletionEvent(
            id: id,
            sourceID: source.id,
            scope: "MANU_OS",
            requestedAt: at,
            confirmedByAgentID: id,
            result: .notRetained
        )
        let entity = Entity(
            id: id,
            entityType: "project",
            canonicalLabel: "Synthetic",
            status: .active,
            createdAt: at,
            updatedAt: at
        )
        let activity = Activity(id: id, kind: "parser", startedAt: at, status: .completed)
        let values: [ClaimValue] = [
            .money(Money(amount: 1, currency: "EUR")),
            .location(LocationValue(latitude: 0, longitude: 0)),
            .json(TypedJSON(schema: "synthetic", version: 1, value: .null)),
        ]

        #expect(!source.hasOriginal)
        #expect(fragment.sourceItemID == item.id)
        #expect(deletion.result == .notRetained)
        #expect(entity.status == .active)
        #expect(activity.status == .completed)
        #expect(values.count == 3)
    }
}
