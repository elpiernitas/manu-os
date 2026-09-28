// swift-tools-version: 6.1

import PackageDescription

let package = Package(
    name: "ManuBrain",
    platforms: [
        .macOS(.v13),
        .iOS(.v16),
    ],
    products: [
        .library(name: "ManuBrainDomain", targets: ["ManuBrainDomain"]),
        .library(name: "ManuBrainStorage", targets: ["ManuBrainStorage"]),
    ],
    dependencies: [
        // Argon2id de referencia (P-H-C). Fijado por revisión exacta; ver ADR-0012.
        .package(
            url: "https://github.com/P-H-C/phc-winner-argon2",
            revision: "f57e61e19229e23c4445b85494dbf7c07de721cb"
        ),
    ],
    targets: [
        .target(name: "ManuBrainDomain"),
        .target(
            name: "ManuBrainStorage",
            dependencies: [
                "ManuBrainDomain",
                .product(name: "argon2", package: "phc-winner-argon2"),
            ]
        ),
        .testTarget(
            name: "ManuBrainStorageTests",
            dependencies: ["ManuBrainStorage", "ManuBrainDomain"]
        ),
        .testTarget(
            name: "ManuBrainDomainTests",
            dependencies: ["ManuBrainDomain"]
        ),
        .testTarget(
            name: "ManuBrainDomainPublicAPITests",
            dependencies: ["ManuBrainDomain"]
        ),
    ]
)
