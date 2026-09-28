import Foundation
import Testing
@testable import ManuBrainDomain

/// Regression tests for defects found in the external review of PR #2.
/// Every fixture is synthetic.
struct ReviewRegressionTests {
    private let entityID = try! UUIDv7(rawValue: "018f0000-0000-7000-8000-000000000001")
    private let humanID = try! UUIDv7(rawValue: "018f0000-0000-7000-8000-000000000002")
    private let modelID = try! UUIDv7(rawValue: "018f0000-0000-7000-8000-000000000003")

    private var human: Agent {
        Agent(id: humanID, kind: .human, label: "Fixture Human", provider: nil, externalID: nil)
    }

    private var model: Agent {
        Agent(id: modelID, kind: .model, label: "Fixture Model", provider: "fixture", externalID: nil)
    }

    private func timestamp(_ value: String) -> UTCTimestamp {
        try! UTCTimestamp(rawValue: value)
    }

    private func id(_ suffix: Int) -> UUIDv7 {
        try! UUIDv7(rawValue: String(format: "018f0000-0000-7000-8000-%012d", suffix))
    }

    private func claim(
        id claimID: UUIDv7,
        value: String,
        status: ClaimStatus = .active,
        validFrom: String? = nil,
        validUntil: String? = nil,
        recordedAt: String = "2026-01-01T00:00:00Z",
        supersedes: UUIDv7? = nil,
        creator: UUIDv7? = nil
    ) -> Claim {
        Claim(
            id: claimID,
            subjectEntityID: entityID,
            predicate: "project.name",
            objectValue: .string(value),
            classification: .fact,
            status: status,
            validFrom: validFrom.map(timestamp),
            validUntil: validUntil.map(timestamp),
            recordedAt: timestamp(recordedAt),
            supersedesClaimID: supersedes,
            createdByAgentID: creator ?? humanID
        )
    }

    private func evidence(for claimID: UUIDv7) -> EvidenceLink {
        EvidenceLink(id: id(900), claimID: claimID, fragmentID: id(901), role: .support, weight: 1, note: nil)
    }

    // MARK: - Model output and creator

    @Test("A model claim cannot be validated by passing a different creator")
    func creatorMustMatchClaim() {
        let output = claim(id: id(301), value: "Generated", creator: modelID)
        #expect(throws: ContractError.creatorMismatch) {
            try validateClaimEvidence(output, evidenceLinks: [evidence(for: output.id)], creator: human)
        }
    }

    @Test(
        "A model can create only proposed claims",
        arguments: [
            ClaimStatus.active,
            .superseded,
            .contested,
            .rejected,
            .retracted,
        ]
    )
    func modelCannotCreateNonProposedClaims(status: ClaimStatus) {
        let output = claim(id: id(302), value: "Generated", status: status, creator: modelID)
        #expect(throws: ContractError.modelClaimMustBeProposed) {
            try validateClaimEvidence(output, evidenceLinks: [evidence(for: output.id)], creator: model)
        }
    }

    @Test("A model can still create a proposed claim")
    func modelCanPropose() throws {
        let output = claim(id: id(303), value: "Generated", status: .proposed, creator: modelID)
        try validateClaimEvidence(output, evidenceLinks: [], creator: model)
    }

    // MARK: - Supersession

    @Test("Superseding before the previous claim starts is rejected")
    func supersedeBeforeValidFrom() {
        let x = claim(id: id(310), value: "X", validFrom: "2026-06-01T00:00:00Z")
        let y = claim(id: id(311), value: "Y", validFrom: "2026-05-01T00:00:00Z")
        #expect(throws: ContractError.invalidValidityRange) {
            try supersedeClaim(x, with: y, at: timestamp("2026-05-01T00:00:00Z"), existingClaims: [x, y])
        }
    }

    @Test("Superseding never extends an earlier validUntil")
    func supersedeKeepsEarlierValidUntil() throws {
        let x = claim(
            id: id(312),
            value: "X",
            validFrom: "2026-06-01T00:00:00Z",
            validUntil: "2026-07-01T00:00:00Z"
        )
        let y = claim(id: id(313), value: "Y", validFrom: "2026-09-09T00:00:00Z")
        let result = try supersedeClaim(x, with: y, at: timestamp("2026-09-09T00:00:00Z"), existingClaims: [x, y])
        #expect(result.previous.validUntil == timestamp("2026-07-01T00:00:00Z"))
    }

    @Test(
        "Only active or contested claims can be superseded",
        arguments: [ClaimStatus.proposed, .rejected, .retracted, .superseded]
    )
    func nonVisibleClaimsCannotBeSuperseded(status: ClaimStatus) {
        let previous = claim(id: id(314), value: "R", status: status, validFrom: "2026-06-01T00:00:00Z")
        let successor = claim(id: id(315), value: "S", validFrom: "2026-09-09T00:00:00Z")
        #expect(throws: ContractError.claimNotSupersedable(status)) {
            try supersedeClaim(
                previous,
                with: successor,
                at: timestamp("2026-09-09T00:00:00Z"),
                existingClaims: [previous, successor]
            )
        }
    }

    @Test("Cycle detection handles duplicate claim IDs without trapping")
    func cycleDetectionWithDuplicateIDs() {
        let a = claim(id: id(320), value: "A", supersedes: id(321))
        let b = claim(id: id(321), value: "B")
        #expect(!detectSupersessionCycle(in: [a, a, b]))
        let aToB = claim(id: id(322), value: "A", supersedes: id(323))
        let aToC = claim(id: id(322), value: "A", supersedes: id(324))
        let cToA = claim(id: id(324), value: "C", supersedes: id(322))
        #expect(detectSupersessionCycle(in: [aToB, aToC, cToA]))
    }

    @Test("Longer supersession cycles are detected")
    func longerCycle() {
        let a = claim(id: id(330), value: "A", supersedes: id(331))
        let b = claim(id: id(331), value: "B", supersedes: id(332))
        let c = claim(id: id(332), value: "C", supersedes: id(330))
        #expect(detectSupersessionCycle(in: [a, b, c]))
        #expect(!detectSupersessionCycle(in: [a, b]))
    }

    // MARK: - Temporal resolution

    @Test("Contested claims are never resolved silently")
    func contestedClaimsStayVisible() {
        let a = claim(id: id(340), value: "A", status: .contested, recordedAt: "2026-01-01T00:00:00Z")
        let b = claim(id: id(341), value: "B", status: .contested, recordedAt: "2026-01-02T00:00:00Z")
        let current = resolveCurrentClaims([a, b], at: timestamp("2026-02-01T00:00:00Z"))
        #expect(current.map(\.id) == [a.id, b.id])
    }

    @Test("Proposed, rejected and retracted claims are not current")
    func hiddenStatusesAreNotCurrent() {
        let claims = [
            claim(id: id(350), value: "P", status: .proposed),
            claim(id: id(351), value: "R", status: .rejected),
            claim(id: id(352), value: "T", status: .retracted),
        ]
        #expect(resolveCurrentClaims(claims, at: timestamp("2026-02-01T00:00:00Z")).isEmpty)
    }

    // MARK: - Retention (ADR-0008)

    @Test(
        "A non-FULL policy never reports an original, even if flagged as retained",
        arguments: [RetentionPolicy.extractedOnly, .referenceOnly, .transient]
    )
    func retentionPolicyBoundsOriginal(policy: RetentionPolicy) {
        let source = Source(
            id: id(360),
            kind: "screenshot",
            importedAt: timestamp("2026-09-28T10:00:00Z"),
            rawBlobID: id(361),
            authorAgentID: humanID,
            retentionPolicy: policy,
            originalRetained: true,
            sensitivity: .sensitive
        )
        #expect(!source.hasOriginal)
        #expect(throws: ContractError.originalNotRetained) { try source.requireOriginal() }
    }

    @Test("A FULL source with a retained blob reports its original")
    func fullSourceHasOriginal() throws {
        let source = Source(
            id: id(362),
            kind: "chat-export",
            importedAt: timestamp("2026-09-28T10:00:00Z"),
            rawBlobID: id(363),
            authorAgentID: humanID,
            retentionPolicy: .full,
            originalRetained: true,
            sensitivity: .sensitive
        )
        #expect(source.hasOriginal)
        try source.requireOriginal()
    }

    // MARK: - Identifiers and timestamps

    @Test(
        "Invalid UUIDv7 values are rejected",
        arguments: [
            "018f0000-0000-4000-8000-000000000001",
            "018f0000-0000-7000-c000-000000000001",
            "018f0000000070008000000000000001",
            "not-a-uuid",
        ]
    )
    func rejectsInvalidUUIDv7(value: String) {
        #expect(throws: ContractError.invalidUUIDv7(value)) { try UUIDv7(rawValue: value) }
    }

    @Test("UUIDv7 is normalised to lower case")
    func normalisesUUIDv7() throws {
        let upper = try UUIDv7(rawValue: "018F0000-0000-7000-8000-00000000000A")
        #expect(upper.rawValue == "018f0000-0000-7000-8000-00000000000a")
    }

    @Test(
        "Non-UTC or impossible timestamps are rejected",
        arguments: [
            "2026-01-01T00:00:00+01:00",
            "2026-01-01T00:00:00+01:00Z",
            "2026-01-01 00:00:00Z",
            "2026-01-01T00:00:00z",
            "2026-02-30T00:00:00Z",
            "2026-01-01T25:00:00Z",
            "2026-13-01T00:00:00Z",
        ]
    )
    func rejectsInvalidTimestamps(value: String) {
        #expect(throws: ContractError.invalidUTCTimestamp(value)) { try UTCTimestamp(rawValue: value) }
    }

    @Test("Timestamps with and without fractional seconds compare by instant")
    func timestampEqualityFollowsInstant() throws {
        let plain = try UTCTimestamp(rawValue: "2026-01-01T00:00:00Z")
        let fractional = try UTCTimestamp(rawValue: "2026-01-01T00:00:00.000Z")
        #expect(plain == fractional)
        #expect(Set([plain, fractional]).count == 1)
        #expect(try UTCTimestamp(rawValue: "2026-01-01T00:00:00.500Z") > plain)
    }

    @Test("Decoding rejects an invalid timestamp inside a claim")
    func decodingRejectsInvalidTimestamp() throws {
        let json = """
        {"id":"018f0000-0000-7000-8000-000000000370","subjectEntityID":"018f0000-0000-7000-8000-000000000001",
         "predicate":"p","objectValue":{"kind":"string","value":"v"},"classification":"FACT","status":"ACTIVE",
         "recordedAt":"2026-01-01T00:00:00+01:00","createdByAgentID":"018f0000-0000-7000-8000-000000000002"}
        """
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(Claim.self, from: Data(json.utf8))
        }
    }
}
