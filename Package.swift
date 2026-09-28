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
    ],
    targets: [
        .target(name: "ManuBrainDomain"),
        .testTarget(
            name: "ManuBrainDomainTests",
            dependencies: ["ManuBrainDomain"]
        ),
    ]
)
