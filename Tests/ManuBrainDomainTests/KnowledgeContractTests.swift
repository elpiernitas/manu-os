import Foundation
import Testing
@testable import ManuBrainDomain

struct KnowledgeContractTests {
    private let entityID = try! UUIDv7(rawValue: "018f0000-0000-7000-8000-000000000001")
    private let humanID = try! UUIDv7(rawValue: "018f0000-0000-7000-8000-000000000002")
    private let modelID = try! UUIDv7(rawValue: "018f0000-0000-7000-8000-000000000003")
    private let fragmentID = try! UUIDv7(rawValue: "018f0000-0000-7000-8000-000000000004")

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
        classification: ClaimClassification = .fact,
        status: ClaimStatus = .active,
        confidence: Double? = nil,
        confidenceReason: String? = nil,
        validFrom: UTCTimestamp? = nil,
        validUntil: UTCTimestamp? = nil,
        supersedes: UUIDv7? = nil,
        creator: UUIDv7? = nil
    ) -> Claim {
        Claim(
            id: claimID,
            subjectEntityID: entityID,
            predicate: "project.name",
            objectValue: .string(value),
            classification: classification,
            confidence: confidence,
            confidenceReason: confidenceReason,
            status: status,
            validFrom: validFrom,
            validUntil: validUntil,
            recordedAt: validFrom ?? timestamp("2026-01-01T00:00:00Z"),
            supersedesClaimID: supersedes,
            createdByAgentID: creator ?? humanID
        )
    }

    private func evidence(for claimID: UUIDv7) -> EvidenceLink {
        EvidenceLink(
            id: id(900),
            claimID: claimID,
            fragmentID: fragmentID,
            role: .support,
            weight: 1,
            note: nil
        )
    }

    @Test("1. Accepts an active FACT with evidence")
    func activeFactWithEvidence() throws {
        let fact = claim(id: id(101), value: "X")
        try validateClaimEvidence(fact, evidenceLinks: [evidence(for: fact.id)], creator: human)
    }

    @Test("2. Rejects an active FACT without evidence")
    func activeFactWithoutEvidence() {
        let fact = claim(id: id(102), value: "X")
        #expect(throws: ContractError.evidenceRequired) {
            try validateClaimEvidence(fact, evidenceLinks: [], creator: human)
        }
    }

    @Test("3. Accepts a proposed HYPOTHESIS without evidence when confidence is explained")
    func proposedHypothesis() throws {
        let hypothesis = claim(
            id: id(103),
            value: "Possible",
            classification: .hypothesis,
            status: .proposed,
            confidence: 0.4,
            confidenceReason: "Synthetic fixture"
        )
        try validateClaimEvidence(hypothesis, evidenceLinks: [], creator: human)
    }

    @Test("4. Rejects an INFERENCE without confidence or reason")
    func inferenceRequiresConfidence() {
        let inference = claim(
            id: id(104),
            value: "Likely",
            classification: .inference,
            status: .proposed
        )
        #expect(throws: ContractError.confidenceRequired) {
            try validateClaimEvidence(inference, evidenceLinks: [], creator: human)
        }
    }

    @Test("5. Rejects an inverted validity range")
    func invertedValidity() {
        let fact = claim(
            id: id(105),
            value: "X",
            validFrom: timestamp("2026-09-09T00:00:00Z"),
            validUntil: timestamp("2026-06-01T00:00:00Z")
        )
        #expect(throws: ContractError.invalidValidityRange) {
            try validateClaimEvidence(fact, evidenceLinks: [evidence(for: fact.id)], creator: human)
        }
    }

    @Test("6. Rejects self-supersession and A-B-A cycles")
    func supersessionCycles() throws {
        let a = claim(id: id(106), value: "A")
        #expect(throws: ContractError.selfSupersession) {
            try supersedeClaim(a, with: a, at: timestamp("2026-09-01T00:00:00Z"), existingClaims: [a])
        }
        let b = claim(id: id(107), value: "B", supersedes: a.id)
        let cyclicA = claim(id: a.id, value: "A", supersedes: b.id)
        #expect(detectSupersessionCycle(in: [cyclicA, b]))
    }

    @Test("7. Superseding X with Everours closes X correctly")
    func supersedeProjectName() throws {
        let x = claim(id: id(108), value: "X", validFrom: timestamp("2026-06-01T00:00:00Z"))
        let everours = claim(id: id(109), value: "Everours", validFrom: timestamp("2026-09-09T00:00:00Z"))
        let result = try supersedeClaim(
            x,
            with: everours,
            at: timestamp("2026-09-09T00:00:00Z"),
            existingClaims: [x, everours]
        )
        #expect(result.previous.status == .superseded)
        #expect(result.previous.validUntil == timestamp("2026-09-09T00:00:00Z"))
        #expect(result.successor.supersedesClaimID == x.id)
    }

    @Test("8. Resolves X before the change and Everours after it")
    func resolvesCurrentProjectName() throws {
        let x = claim(id: id(110), value: "X", validFrom: timestamp("2026-06-01T00:00:00Z"))
        let everours = claim(id: id(111), value: "Everours", validFrom: timestamp("2026-09-09T00:00:00Z"))
        let result = try supersedeClaim(
            x,
            with: everours,
            at: timestamp("2026-09-09T00:00:00Z"),
            existingClaims: [x, everours]
        )
        let history = [result.previous, result.successor]
        #expect(resolveCurrentClaims(history, at: timestamp("2026-08-01T00:00:00Z")).first?.objectValue == .string("X"))
        #expect(resolveCurrentClaims(history, at: timestamp("2026-10-01T00:00:00Z")).first?.objectValue == .string("Everours"))
    }

    @Test("9. Historical storage keeps both claims")
    func preservesHistory() throws {
        let x = claim(id: id(112), value: "X")
        let everours = claim(id: id(113), value: "Everours")
        let result = try supersedeClaim(
            x,
            with: everours,
            at: timestamp("2026-09-09T00:00:00Z"),
            existingClaims: [x, everours]
        )
        #expect([result.previous, result.successor].count == 2)
        #expect(result.previous.objectValue == .string("X"))
        #expect(result.successor.objectValue == .string("Everours"))
    }

    @Test("10. Model output cannot become ACTIVE automatically")
    func modelCannotActivateClaim() {
        let output = claim(id: id(114), value: "Generated", creator: modelID)
        #expect(throws: ContractError.modelClaimMustBeProposed) {
            try validateClaimEvidence(output, evidenceLinks: [evidence(for: output.id)], creator: model)
        }
    }

    @Test("11. Strict decoding rejects unknown integrity fields")
    func rejectsUnknownFields() throws {
        let fact = claim(id: id(115), value: "X")
        let encoded = try JSONEncoder().encode(fact)
        var object = try #require(JSONSerialization.jsonObject(with: encoded) as? [String: Any])
        object["unexpected"] = true
        let modified = try JSONSerialization.data(withJSONObject: object)
        let allowed: Set<String> = [
            "id", "subjectEntityID", "predicate", "objectValue", "classification",
            "confidence", "confidenceReason", "status", "validFrom", "validUntil",
            "observedAt", "recordedAt", "supersedesClaimID", "createdByAgentID", "activityID",
        ]
        #expect(throws: ContractError.unknownFields(["unexpected"])) {
            try StrictJSON.decode(Claim.self, from: modified, allowedTopLevelKeys: allowed)
        }
    }

    @Test("12. Serialization round trip preserves semantic equality")
    func roundTrip() throws {
        let original = claim(
            id: id(116),
            value: "Everours",
            classification: .decision,
            validFrom: timestamp("2026-09-09T00:00:00Z")
        )
        let data = try JSONEncoder().encode(original)
        let decoded = try JSONDecoder().decode(Claim.self, from: data)
        #expect(decoded == original)
    }

    @Test("A discarded source never reports an available original")
    func discardedSourceHasNoOriginal() {
        let source = Source(
            id: id(200),
            kind: "screenshot",
            importedAt: timestamp("2026-09-28T10:00:00Z"),
            authorAgentID: humanID,
            retentionPolicy: .extractedOnly,
            originalRetained: false,
            originalHash: "sha256:fixture",
            sensitivity: .sensitive
        )
        #expect(!source.hasOriginal)
        #expect(throws: ContractError.originalNotRetained) {
            try source.requireOriginal()
        }
    }
}
