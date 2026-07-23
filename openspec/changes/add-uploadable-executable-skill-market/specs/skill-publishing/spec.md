## ADDED Requirements

### Requirement: Authenticated users upload traditional Skill packages directly to private OSS

Every GitHub-authenticated user SHALL be allowed to create a Skill upload. The API SHALL issue a short-lived credential scoped to one private OSS object, and the browser SHALL upload the ZIP without proxying its bytes through NestJS. A package MUST contain `SKILL.md` at its root, MUST be at most 20 MiB compressed and 200 MiB expanded, and MUST contain at most 2,000 files, 50 MiB per file, and 20 directory levels. Symbolic and hard links MUST be rejected.

#### Scenario: A valid package is finalized

- **GIVEN** an authenticated user obtained a credential for one staging object
- **WHEN** the browser uploads a conforming ZIP and finalizes the upload
- **THEN** the system records its OSS key, size, SHA-256 and package metadata without storing package bytes in PostgreSQL

#### Scenario: A package violates structural limits

- **GIVEN** an uploaded archive lacks a root `SKILL.md` or exceeds a configured package boundary
- **WHEN** the upload is finalized
- **THEN** the system rejects it before review or publication and marks its staging object for cleanup

### Requirement: Skill names are globally unique and owned by the first publisher

Each Skill SHALL have an immutable globally unique lowercase name and an internal UUID. The first uploader to obtain approval for a name SHALL own it. Market title, description, one platform-defined category and icon SHALL be stored separately from the package. Only the owner SHALL update or voluntarily delist the Skill; administrators SHALL retain global delist authority.

#### Scenario: Another user claims an existing name

- **GIVEN** a Skill name is already owned
- **WHEN** another authenticated user attempts to create or overwrite that name
- **THEN** the API rejects the operation without issuing a credential for the published object

### Requirement: Only the first publication requires administrator review

A new Skill SHALL remain `pending_review` until the fixed administrator approves or rejects it. Approval, rejection and administrator delisting SHALL create immutable `AdminAuditLog` records. After first approval, the owner SHALL be able to replace the same published OSS object and update market metadata without another review or retained revision.

#### Scenario: An administrator approves a first publication

- **GIVEN** a pending Skill has a valid package and market metadata
- **WHEN** the authenticated administrator approves it
- **THEN** it becomes `published`, appears in the market and records the audit action

#### Scenario: The owner replaces a published package

- **GIVEN** a Skill is already published
- **WHEN** its owner uploads a replacement package
- **THEN** the current OSS object and recorded SHA-256 are replaced and all users resolve the replacement on their next Agent Run without another review

### Requirement: The public market supports standard discovery without exposing script source

The public SDK-backed market SHALL provide paginated listing, keyword search over name, title, description and author, one fixed-category filter, and ordering by latest publication or add count. A detail response SHALL expose market metadata, sanitized rendered `SKILL.md`, file names, types and sizes. It MUST NOT expose script bodies or a raw package download.

#### Scenario: A user views a published Skill

- **GIVEN** a Skill is published
- **WHEN** a user opens its market detail
- **THEN** the page displays its metadata, sanitized `SKILL.md`, file tree and add state without returning the original ZIP or hidden script source

### Requirement: Delisting immediately prevents new activation

An owner or administrator SHALL be able to delist a published Skill. A delisted Skill MUST disappear from public discovery and MUST NOT activate in a new Agent Run for any user. Existing user-add rows SHALL remain visible as delisted until individually removed, and an already executing Run SHALL not be forcibly interrupted solely by delisting.

#### Scenario: An added Skill is delisted

- **GIVEN** users have added a published Skill
- **WHEN** the owner or administrator delists it
- **THEN** new activation attempts fail as unavailable while existing add records remain removable by their owners

