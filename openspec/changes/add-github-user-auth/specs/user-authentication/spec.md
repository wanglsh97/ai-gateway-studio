## ADDED Requirements

### Requirement: GitHub OAuth is the only user login method
The user-facing site SHALL authenticate users only through a configured GitHub OAuth App. The API SHALL use the GitHub numeric user ID as the immutable external identity and SHALL NOT provide local registration, password login, or password recovery.

#### Scenario: New GitHub user logs in
- **GIVEN** a visitor has no user Session and authorizes the configured GitHub OAuth App
- **WHEN** GitHub returns a valid callback and user profile
- **THEN** the API creates or updates one local User identified by GitHub numeric ID
- **AND** username, display name, avatar, and last-login time are refreshed
- **AND** the absence of an email does not prevent login

### Requirement: OAuth secrets and redirects are constrained
The API SHALL validate one-time OAuth state, use only configured callback URLs, allow post-login return only to approved same-origin paths, and SHALL NOT persist or log the authorization code, GitHub access token, client secret, or raw Session token. Development and production SHALL use separate OAuth Apps, and production login SHALL use an HTTPS domain callback.

#### Scenario: Callback contains an unsafe return target
- **GIVEN** an OAuth attempt contains an absolute, protocol-relative, or unapproved return target
- **WHEN** the callback completes
- **THEN** the API ignores or rejects the unsafe target
- **AND** it never redirects the browser off-site

#### Scenario: OAuth state does not match
- **GIVEN** the callback state is missing, expired, replayed, or different from the state Cookie
- **WHEN** the callback is requested
- **THEN** the API rejects the login without creating a UserSession

### Requirement: Application sessions are server-side and revocable
The API SHALL create an independent database UserSession for each successful login, store only a cryptographic hash of a high-entropy token, and set the raw token only in an HttpOnly Cookie. Each Session SHALL have a fixed 30-day expiry with no sliding renewal, and multiple devices SHALL be allowed concurrently.

#### Scenario: User logs out on one device
- **GIVEN** the same User has active Sessions on two devices
- **WHEN** the User logs out on one device
- **THEN** only the current UserSession is revoked and its Cookie is cleared
- **AND** the other device remains authenticated

#### Scenario: Fixed Session expiry is reached
- **GIVEN** a Session was created 30 days ago
- **WHEN** it is presented to a protected API
- **THEN** the API returns 401 and requires a new GitHub login
- **AND** activity before expiry does not extend the expiry time

### Requirement: Paid user capabilities require an authenticated User
Chat completion, image creation/status/download, and Prompt optimization SHALL require a valid UserSession. Home, login, model listing, liveness, and readiness SHALL remain public. The API SHALL derive user identity only from the Session and SHALL NOT trust a client-supplied user ID.

#### Scenario: Anonymous visitor calls Chat API directly
- **GIVEN** no valid UserSession Cookie exists
- **WHEN** the visitor posts a valid Chat request
- **THEN** the API returns 401 before creating a RequestLog or calling an Adapter

#### Scenario: Visitor opens a protected page
- **GIVEN** the visitor is not authenticated
- **WHEN** `/chat`, `/image`, or `/prompt` is opened
- **THEN** Web redirects to `/login` with an approved same-origin return path
- **AND** successful login returns the visitor to that page

### Requirement: Requests and image tasks have mandatory user ownership
Every newly accepted RequestLog and ImageGenerationTask SHALL have a non-null User relation. BillingRecord SHALL inherit user attribution through RequestLog rather than duplicating a user ID. Image task status and download SHALL be accessible only to the owning User.

#### Scenario: User requests another user's image task
- **GIVEN** an image task belongs to User A
- **WHEN** User B requests its status or image download using the task ID
- **THEN** the API returns 404 without revealing that the task exists

#### Scenario: Authenticated Prompt optimization is logged
- **GIVEN** a valid UserSession
- **WHEN** the User successfully submits Prompt optimization
- **THEN** the RequestLog is created with that User's platform ID before the provider call
- **AND** its BillingRecord is attributable through the RequestLog relation

### Requirement: Administrator logs identify the calling GitHub user
The authenticated administrator request-log list SHALL include a minimal GitHub user summary and support filtering by GitHub username or exact GitHub ID. Request detail MAY include display name and optional email. Dashboard aggregates and public responses SHALL NOT expose user email.

#### Scenario: Administrator filters logs by GitHub identity
- **GIVEN** requests exist for multiple Users
- **WHEN** the administrator filters by one username or exact GitHub ID
- **THEN** only matching request logs are returned
- **AND** each row contains enough identity summary to distinguish the caller

### Requirement: Existing IP limits remain unchanged
Adding user authentication SHALL NOT add a user-level rate limit or remove the existing IP-based limits for Chat, Image, Prompt optimization, or administrator login.

#### Scenario: Authenticated user exceeds an existing IP limit
- **GIVEN** a valid UserSession and a source IP that has exhausted an existing allowance
- **WHEN** another paid capability request is submitted
- **THEN** the existing 429 behavior applies
- **AND** authentication does not bypass the IP limit
