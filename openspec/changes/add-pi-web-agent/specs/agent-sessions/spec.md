## ADDED Requirements

### Requirement: Agent threads and messages are durable and owner-scoped
The system SHALL persist Agent threads, ordered messages, message parts, runs, events, and tool calls in PostgreSQL. Every read and mutation SHALL derive the owner from the authenticated GitHub session; the client MUST NOT choose or override an owner ID.

#### Scenario: Refresh restores a thread
- **GIVEN** a user has completed an Agent conversation
- **WHEN** the user refreshes the page and opens that thread
- **THEN** the server returns its ordered messages, reasoning parts, tool states, final answers, and run summaries

#### Scenario: User cannot read another user's thread
- **GIVEN** a thread belongs to user A
- **WHEN** authenticated user B requests its identifier
- **THEN** the server returns no thread data and does not reveal whether the identifier exists

### Requirement: Users can manage multiple historical threads
An authenticated user SHALL be able to list, create, view, rename, and permanently delete their Agent threads. Rename SHALL validate a bounded non-empty title. Delete SHALL require explicit UI confirmation and SHALL transactionally remove the thread's messages, runs, events, and tool calls.

#### Scenario: Rename a thread
- **GIVEN** a user owns an Agent thread
- **WHEN** the user submits a valid new title
- **THEN** the title is persisted and returned in subsequent thread lists

#### Scenario: Delete a thread
- **GIVEN** a user confirms deletion of an owned thread with completed runs
- **WHEN** the delete request succeeds
- **THEN** the thread and all subordinate Agent records are permanently removed without affecting gateway RequestLog or BillingRecord audit data

#### Scenario: Reject deletion of a running thread
- **GIVEN** a thread contains the user's active run
- **WHEN** the user attempts to delete it
- **THEN** the server rejects deletion until the run reaches a terminal state or is cancelled

### Requirement: Each user has at most one active Agent run
The server SHALL enforce at most one active Agent run across all threads owned by one user. Users MAY browse any historical thread while a run is active, but all Agent submission controls SHALL remain disabled until that run succeeds, fails, is cancelled, reaches a limit, or is interrupted.

#### Scenario: Concurrent run is rejected across threads
- **GIVEN** a user has an active run in thread A
- **WHEN** the same user attempts to start a run in thread B
- **THEN** the server rejects the second run without invoking a provider or tool and identifies the existing active run

#### Scenario: Another user can run independently
- **GIVEN** user A has an active run
- **WHEN** user B starts a valid run in their own thread
- **THEN** user B's run is evaluated independently under user B's limits

### Requirement: Running messages cannot be queued or steered in V1
While a user has an active Agent run, the Web application SHALL disable submission and the server SHALL reject additional prompts from that user. The V1 Agent MUST NOT queue messages or inject steering/follow-up messages into an active Pi loop.

#### Scenario: Submit while run is active
- **GIVEN** a user's Agent run is active
- **WHEN** a modified client submits another prompt
- **THEN** the server rejects it and leaves the active run and transcript unchanged

### Requirement: Agent session data is excluded from sharing
The V1 Agent SHALL NOT expose a public or authenticated share-link API and SHALL NOT make another user's thread accessible through a share token.

#### Scenario: No share action is available
- **GIVEN** a user views an Agent thread
- **WHEN** the available thread actions are rendered
- **THEN** only supported management actions appear and no share link can be created

