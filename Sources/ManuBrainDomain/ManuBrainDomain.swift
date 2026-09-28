import Foundation

public enum ContractError: Error, Equatable, Sendable {
    case invalidUUIDv7(String)
    case invalidUTCTimestamp(String)
    case invalidValidityRange
    case evidenceRequired
    case confidenceRequired
    case modelClaimMustBeProposed
    case selfSupersession
    case supersessionCycle
    case incompatibleSupersession
    case unknownFields([String])
    case originalNotRetained
}

public struct UUIDv7: RawRepresentable, Codable, Hashable, Sendable {
    public let rawValue: String

    public init(rawValue: String) throws {
        let pattern = #"^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$"#
        guard rawValue.lowercased().range(of: pattern, options: .regularExpression) != nil else {
            throw ContractError.invalidUUIDv7(rawValue)
        }
        self.rawValue = rawValue.lowercased()
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)
        do {
            try self.init(rawValue: value)
        } catch {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Expected a UUIDv7"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }
}

public struct UTCTimestamp: RawRepresentable, Codable, Hashable, Comparable, Sendable {
    public let rawValue: String
    public let date: Date

    public init(rawValue: String) throws {
        guard rawValue.hasSuffix("Z") else {
            throw ContractError.invalidUTCTimestamp(rawValue)
        }
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let parsed = formatter.date(from: rawValue) ?? {
            formatter.formatOptions = [.withInternetDateTime]
            return formatter.date(from: rawValue)
        }()
        guard let parsed else {
            throw ContractError.invalidUTCTimestamp(rawValue)
        }
        self.rawValue = rawValue
        self.date = parsed
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let value = try container.decode(String.self)
        do {
            try self.init(rawValue: value)
        } catch {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Expected an ISO-8601 UTC timestamp ending in Z"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        try container.encode(rawValue)
    }

    public static func < (lhs: UTCTimestamp, rhs: UTCTimestamp) -> Bool {
        lhs.date < rhs.date
    }
}

public enum JSONValue: Codable, Equatable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Unsupported JSON value"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case let .string(value): try container.encode(value)
        case let .number(value): try container.encode(value)
        case let .bool(value): try container.encode(value)
        case let .object(value): try container.encode(value)
        case let .array(value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }
}

public enum RetentionPolicy: String, Codable, Sendable {
    case full = "FULL"
    case extractedOnly = "EXTRACTED_ONLY"
    case referenceOnly = "REFERENCE_ONLY"
    case transient = "TRANSIENT"
}

public enum Sensitivity: String, Codable, Sendable {
    case normal = "NORMAL"
    case personal = "PERSONAL"
    case sensitive = "SENSITIVE"
}

public struct Source: Codable, Equatable, Sendable {
    public let id: UUIDv7
    public let kind: String
    public let provider: String?
    public let importedAt: UTCTimestamp
    public let contentHash: String?
    public let rawBlobID: UUIDv7?
    public let authorAgentID: UUIDv7
    public let metadata: [String: JSONValue]
    public let retentionPolicy: RetentionPolicy
    public let originalRetained: Bool
    public let originalHash: String?
    public let sensitivity: Sensitivity

    public init(
        id: UUIDv7,
        kind: String,
        provider: String? = nil,
        importedAt: UTCTimestamp,
        contentHash: String? = nil,
        rawBlobID: UUIDv7? = nil,
        authorAgentID: UUIDv7,
        metadata: [String: JSONValue] = [:],
        retentionPolicy: RetentionPolicy,
        originalRetained: Bool,
        originalHash: String? = nil,
        sensitivity: Sensitivity
    ) {
        self.id = id
        self.kind = kind
        self.provider = provider
        self.importedAt = importedAt
        self.contentHash = contentHash
        self.rawBlobID = rawBlobID
        self.authorAgentID = authorAgentID
        self.metadata = metadata
        self.retentionPolicy = retentionPolicy
        self.originalRetained = originalRetained
        self.originalHash = originalHash
        self.sensitivity = sensitivity
    }

    public var hasOriginal: Bool {
        originalRetained && rawBlobID != nil
    }

    public func requireOriginal() throws {
        guard hasOriginal else { throw ContractError.originalNotRetained }
    }
}

public struct SourceItem: Codable, Equatable, Sendable {
    public let id: UUIDv7
    public let sourceID: UUIDv7
    public let parentItemID: UUIDv7?
    public let occurredAt: UTCTimestamp?
    public let authorAgentID: UUIDv7
    public let rawText: String?
    public let contentHash: String
    public let metadata: [String: JSONValue]
    public let sensitivity: Sensitivity
}

public struct Fragment: Codable, Equatable, Sendable {
    public let id: UUIDv7
    public let sourceItemID: UUIDv7
    public let selector: [String: JSONValue]
    public let excerptHash: String
    public let derivedFromOriginal: Bool
}

public struct SourceDeletionEvent: Codable, Equatable, Sendable {
    public enum Result: String, Codable, Sendable {
        case requested = "REQUESTED"
        case completed = "COMPLETED"
        case failed = "FAILED"
        case notRetained = "NOT_RETAINED"
    }

    public let id: UUIDv7
    public let sourceID: UUIDv7
    public let scope: String
    public let requestedAt: UTCTimestamp
    public let confirmedByAgentID: UUIDv7
    public let result: Result
    public let completedAt: UTCTimestamp?
    public let note: String?
}

public enum AgentKind: String, Codable, Sendable {
    case human = "HUMAN"
    case integration = "INTEGRATION"
    case model = "MODEL"
    case component = "COMPONENT"
}

public struct Agent: Codable, Equatable, Sendable {
    public let id: UUIDv7
    public let kind: AgentKind
    public let label: String
    public let provider: String?
    public let externalID: String?

    public init(id: UUIDv7, kind: AgentKind, label: String, provider: String?, externalID: String?) {
        self.id = id
        self.kind = kind
        self.label = label
        self.provider = provider
        self.externalID = externalID
    }
}

public struct Activity: Codable, Equatable, Sendable {
    public enum Status: String, Codable, Sendable {
        case started = "STARTED"
        case completed = "COMPLETED"
        case failed = "FAILED"
    }

    public let id: UUIDv7
    public let kind: String
    public let toolName: String?
    public let toolVersion: String?
    public let modelID: String?
    public let promptHash: String?
    public let parameters: [String: JSONValue]
    public let startedAt: UTCTimestamp
    public let endedAt: UTCTimestamp?
    public let status: Status
}

public struct Entity: Codable, Equatable, Sendable {
    public enum Status: String, Codable, Sendable {
        case active = "ACTIVE"
        case archived = "ARCHIVED"
    }

    public let id: UUIDv7
    public let entityType: String
    public let canonicalLabel: String
    public let status: Status
    public let createdAt: UTCTimestamp
    public let updatedAt: UTCTimestamp
}

public enum ClaimClassification: String, Codable, Sendable {
    case fact = "FACT"
    case inference = "INFERENCE"
    case preference = "PREFERENCE"
    case decision = "DECISION"
    case memory = "MEMORY"
    case hypothesis = "HYPOTHESIS"
}

public enum ClaimStatus: String, Codable, Sendable {
    case proposed = "PROPOSED"
    case active = "ACTIVE"
    case superseded = "SUPERSEDED"
    case contested = "CONTESTED"
    case rejected = "REJECTED"
    case retracted = "RETRACTED"
}

public struct Money: Codable, Equatable, Sendable {
    public let amount: Double
    public let currency: String
}

public struct LocationValue: Codable, Equatable, Sendable {
    public let latitude: Double
    public let longitude: Double
    public let label: String?
}

public struct TypedJSON: Codable, Equatable, Sendable {
    public let schema: String
    public let version: Int
    public let value: JSONValue
}

public enum ClaimValue: Codable, Equatable, Sendable {
    case entityReference(UUIDv7)
    case string(String)
    case number(Double)
    case boolean(Bool)
    case date(String)
    case dateTime(UTCTimestamp)
    case durationSeconds(Double)
    case money(Money)
    case location(LocationValue)
    case json(TypedJSON)

    private enum CodingKeys: String, CodingKey { case kind, value }
    private enum Kind: String, Codable {
        case entityReference, string, number, boolean, date, dateTime
        case durationSeconds, money, location, json
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(Kind.self, forKey: .kind) {
        case .entityReference:
            self = .entityReference(try container.decode(UUIDv7.self, forKey: .value))
        case .string:
            self = .string(try container.decode(String.self, forKey: .value))
        case .number:
            self = .number(try container.decode(Double.self, forKey: .value))
        case .boolean:
            self = .boolean(try container.decode(Bool.self, forKey: .value))
        case .date:
            self = .date(try container.decode(String.self, forKey: .value))
        case .dateTime:
            self = .dateTime(try container.decode(UTCTimestamp.self, forKey: .value))
        case .durationSeconds:
            self = .durationSeconds(try container.decode(Double.self, forKey: .value))
        case .money:
            self = .money(try container.decode(Money.self, forKey: .value))
        case .location:
            self = .location(try container.decode(LocationValue.self, forKey: .value))
        case .json:
            self = .json(try container.decode(TypedJSON.self, forKey: .value))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .entityReference(value):
            try container.encode(Kind.entityReference, forKey: .kind)
            try container.encode(value, forKey: .value)
        case let .string(value):
            try container.encode(Kind.string, forKey: .kind)
            try container.encode(value, forKey: .value)
        case let .number(value):
            try container.encode(Kind.number, forKey: .kind)
            try container.encode(value, forKey: .value)
        case let .boolean(value):
            try container.encode(Kind.boolean, forKey: .kind)
            try container.encode(value, forKey: .value)
        case let .date(value):
            try container.encode(Kind.date, forKey: .kind)
            try container.encode(value, forKey: .value)
        case let .dateTime(value):
            try container.encode(Kind.dateTime, forKey: .kind)
            try container.encode(value, forKey: .value)
        case let .durationSeconds(value):
            try container.encode(Kind.durationSeconds, forKey: .kind)
            try container.encode(value, forKey: .value)
        case let .money(value):
            try container.encode(Kind.money, forKey: .kind)
            try container.encode(value, forKey: .value)
        case let .location(value):
            try container.encode(Kind.location, forKey: .kind)
            try container.encode(value, forKey: .value)
        case let .json(value):
            try container.encode(Kind.json, forKey: .kind)
            try container.encode(value, forKey: .value)
        }
    }
}

public struct Claim: Codable, Equatable, Sendable {
    public let id: UUIDv7
    public let subjectEntityID: UUIDv7
    public let predicate: String
    public let objectValue: ClaimValue
    public let classification: ClaimClassification
    public let confidence: Double?
    public let confidenceReason: String?
    public let status: ClaimStatus
    public let validFrom: UTCTimestamp?
    public let validUntil: UTCTimestamp?
    public let observedAt: UTCTimestamp?
    public let recordedAt: UTCTimestamp
    public let supersedesClaimID: UUIDv7?
    public let createdByAgentID: UUIDv7
    public let activityID: UUIDv7?

    public init(
        id: UUIDv7,
        subjectEntityID: UUIDv7,
        predicate: String,
        objectValue: ClaimValue,
        classification: ClaimClassification,
        confidence: Double? = nil,
        confidenceReason: String? = nil,
        status: ClaimStatus,
        validFrom: UTCTimestamp? = nil,
        validUntil: UTCTimestamp? = nil,
        observedAt: UTCTimestamp? = nil,
        recordedAt: UTCTimestamp,
        supersedesClaimID: UUIDv7? = nil,
        createdByAgentID: UUIDv7,
        activityID: UUIDv7? = nil
    ) {
        self.id = id
        self.subjectEntityID = subjectEntityID
        self.predicate = predicate
        self.objectValue = objectValue
        self.classification = classification
        self.confidence = confidence
        self.confidenceReason = confidenceReason
        self.status = status
        self.validFrom = validFrom
        self.validUntil = validUntil
        self.observedAt = observedAt
        self.recordedAt = recordedAt
        self.supersedesClaimID = supersedesClaimID
        self.createdByAgentID = createdByAgentID
        self.activityID = activityID
    }

    public func replacing(
        status: ClaimStatus? = nil,
        validUntil: UTCTimestamp? = nil,
        supersedesClaimID: UUIDv7? = nil
    ) -> Claim {
        Claim(
            id: id,
            subjectEntityID: subjectEntityID,
            predicate: predicate,
            objectValue: objectValue,
            classification: classification,
            confidence: confidence,
            confidenceReason: confidenceReason,
            status: status ?? self.status,
            validFrom: validFrom,
            validUntil: validUntil ?? self.validUntil,
            observedAt: observedAt,
            recordedAt: recordedAt,
            supersedesClaimID: supersedesClaimID ?? self.supersedesClaimID,
            createdByAgentID: createdByAgentID,
            activityID: activityID
        )
    }
}

public struct EvidenceLink: Codable, Equatable, Sendable {
    public enum Role: String, Codable, Sendable {
        case support = "SUPPORT"
        case contradict = "CONTRADICT"
    }

    public let id: UUIDv7
    public let claimID: UUIDv7
    public let fragmentID: UUIDv7
    public let role: Role
    public let weight: Double?
    public let note: String?

    public init(
        id: UUIDv7,
        claimID: UUIDv7,
        fragmentID: UUIDv7,
        role: Role,
        weight: Double?,
        note: String?
    ) {
        self.id = id
        self.claimID = claimID
        self.fragmentID = fragmentID
        self.role = role
        self.weight = weight
        self.note = note
    }
}

public func validateClaimEvidence(
    _ claim: Claim,
    evidenceLinks: [EvidenceLink],
    creator: Agent
) throws {
    if let from = claim.validFrom, let until = claim.validUntil, until < from {
        throw ContractError.invalidValidityRange
    }
    if claim.classification == .inference || claim.classification == .hypothesis {
        guard let confidence = claim.confidence,
              (0...1).contains(confidence),
              let reason = claim.confidenceReason,
              !reason.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        else {
            throw ContractError.confidenceRequired
        }
    }
    let supportingEvidence = evidenceLinks.contains {
        $0.claimID == claim.id && $0.role == .support
    }
    if claim.status == .active,
       claim.classification != .hypothesis,
       !supportingEvidence
    {
        throw ContractError.evidenceRequired
    }
    if creator.kind == .model, claim.status == .active {
        throw ContractError.modelClaimMustBeProposed
    }
}

public func detectSupersessionCycle(in claims: [Claim]) -> Bool {
    let next = Dictionary(uniqueKeysWithValues: claims.compactMap { claim in
        claim.supersedesClaimID.map { (claim.id, $0) }
    })
    for start in next.keys {
        var seen = Set<UUIDv7>()
        var cursor: UUIDv7? = start
        while let current = cursor {
            guard seen.insert(current).inserted else { return true }
            cursor = next[current]
        }
    }
    return false
}

public struct SupersessionResult: Equatable, Sendable {
    public let previous: Claim
    public let successor: Claim
}

public func supersedeClaim(
    _ previous: Claim,
    with successor: Claim,
    at timestamp: UTCTimestamp,
    existingClaims: [Claim]
) throws -> SupersessionResult {
    guard previous.id != successor.id else {
        throw ContractError.selfSupersession
    }
    guard previous.subjectEntityID == successor.subjectEntityID,
          previous.predicate == successor.predicate
    else {
        throw ContractError.incompatibleSupersession
    }
    let updatedPrevious = previous.replacing(status: .superseded, validUntil: timestamp)
    let updatedSuccessor = successor.replacing(supersedesClaimID: previous.id)
    let candidates = existingClaims.filter { $0.id != previous.id && $0.id != successor.id }
        + [updatedPrevious, updatedSuccessor]
    guard !detectSupersessionCycle(in: candidates) else {
        throw ContractError.supersessionCycle
    }
    return SupersessionResult(previous: updatedPrevious, successor: updatedSuccessor)
}

public func resolveCurrentClaims(
    _ claims: [Claim],
    at timestamp: UTCTimestamp
) -> [Claim] {
    let visible = claims.filter { claim in
        guard claim.status != .proposed,
              claim.status != .rejected,
              claim.status != .retracted
        else { return false }
        if let from = claim.validFrom, timestamp < from { return false }
        if let until = claim.validUntil, !(timestamp < until) { return false }
        return true
    }
    let grouped = Dictionary(grouping: visible) {
        "\($0.subjectEntityID.rawValue)|\($0.predicate)"
    }
    return grouped.values.compactMap { group in
        group.max { $0.recordedAt < $1.recordedAt }
    }.sorted { $0.id.rawValue < $1.id.rawValue }
}

public enum StrictJSON {
    public static func decode<T: Decodable>(
        _ type: T.Type,
        from data: Data,
        allowedTopLevelKeys: Set<String>
    ) throws -> T {
        let object = try JSONSerialization.jsonObject(with: data)
        guard let dictionary = object as? [String: Any] else {
            return try JSONDecoder().decode(type, from: data)
        }
        let unknown = Set(dictionary.keys).subtracting(allowedTopLevelKeys)
        guard unknown.isEmpty else {
            throw ContractError.unknownFields(unknown.sorted())
        }
        return try JSONDecoder().decode(type, from: data)
    }
}
