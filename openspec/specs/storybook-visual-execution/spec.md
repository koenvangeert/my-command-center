# storybook-visual-execution Specification

## Purpose

Keep complete visual regression coverage affordable as the story catalog grows, while providing verifiable runner failure checks and timing evidence for developers.

## Requirements

### Requirement: Complete visual and repeatability coverage
The canonical visual test command SHALL compare every declared case against its approved baseline and verify repeatability using two independently initialized captures per case. It SHALL retain existing readiness, diagnostic, pixel-tolerance, and failure-evidence behavior without updating approved baselines.

#### Scenario: Successful full-matrix run
- **WHEN** the canonical visual test command succeeds
- **THEN** every declared case has passed baseline comparison and repeatability verification
- **AND** the baseline-comparison capture is reused as the first repeatability sample, with only one additional full-matrix capture pass

#### Scenario: Unstable rendering
- **WHEN** a fresh capture differs from the initial capture beyond the existing tolerance
- **THEN** the command fails and retains repeatability evidence under the case identity

### Requirement: Bounded runner regression probes
The visual test command SHALL exercise real-command pixel-failure, update-evidence, unexpected-diagnostic, restoration, and invalid-input behavior using an explicit bounded representative case set. Unrelated additions to the catalog SHALL NOT increase the number of captures in these probes. Probe selection SHALL NOT narrow normal full-matrix validation or permit writes to approved baselines.

#### Scenario: Catalog grows
- **WHEN** unrelated valid cases are added to the visual manifest
- **THEN** full-matrix coverage includes the new cases
- **AND** runner regression probes retain their explicitly selected case count

#### Scenario: Probe coverage is invalid
- **WHEN** a required representative identity is missing, duplicated, or cannot exercise its declared fault
- **THEN** the self-test fails clearly instead of silently selecting another case or accepting an unexercised assertion

#### Scenario: Failure and update evidence
- **WHEN** probes inject a pixel change or unexpected diagnostic into disposable catalog output
- **THEN** the real command returns the expected failure status and review images
- **AND** the update probe preserves before, current, and difference evidence in disposable storage
- **AND** restoration is verified without modifying approved baselines or leaving catalog mutations behind

#### Scenario: Full validation remains strict
- **WHEN** the normal command encounters a missing, obsolete, or unexpected baseline, or a duplicate manifest identity anywhere in the full matrix
- **THEN** it fails even if the invalid case is not part of the representative probe set

### Requirement: Execution timing evidence
The visual commands SHALL publish machine-readable elapsed timings and concise progress summaries for full-matrix capture, repeatability, targeted regressions, and individual runner probes. Evidence SHALL identify case or probe, phase, status, and elapsed milliseconds without changing pass/fail semantics.

#### Scenario: Completed execution
- **WHEN** a visual command completes
- **THEN** its artifacts include total elapsed time, phase durations, completed capture counts, and per-case capture timings
- **AND** logs identify phase progress and the slowest captures

#### Scenario: Failed execution
- **WHEN** a visual command exits through a handled failure
- **THEN** it retains timing evidence for completed and failed work with failed or incomplete status
- **AND** timing reporting does not turn a failed verification into a success
