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
        .library(name: "ManuOSCore", targets: ["ManuOSCore"]),
        .library(name: "ManuOSUI", targets: ["ManuOSUI"]),
    ],
    targets: [
        .target(name: "ManuBrainDomain"),
        // Product logic without UI, storage or network. Builds and tests on Linux and macOS.
        .target(name: "ManuOSCore"),
        // SwiftUI design system and app shell. Compiles only where SwiftUI exists (macOS/iOS).
        .target(name: "ManuOSUI", dependencies: ["ManuOSCore"]),
        .testTarget(
            name: "ManuOSCoreTests",
            dependencies: ["ManuOSCore"]
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
