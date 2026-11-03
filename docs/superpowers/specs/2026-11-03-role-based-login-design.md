# Role-Based Login and Admin Portal Design

## Goal

Add a role-aware login experience to the existing React demo. Regular users should continue landing in the user portal, while a seeded administrator can choose the Admin portal from the same sign-in card and manage registered users.

## Approved scope

- Add a visible User/Admin switch to the shared sign-in card.
- Keep the default mode as User portal.
- Seed one demo administrator:
  - Email: `admin@socialconnect.local`
  - Password: `Admin@12345`
- Accept the seeded credentials only when Admin mode is selected.
- Route regular users to the existing portal.
- Route the admin to a protected admin dashboard.
- Provide admin user management:
  - Search by name or email.
  - View role and active status.
  - Activate/deactivate regular users.
  - Delete regular users.
- Prevent deletion or deactivation of the seeded admin.
- Reject deactivated users on their next login.
- Preserve the existing localStorage-based demo architecture.

## Architecture

### Authentication

Extend `authService` with a seeded-admin initializer and an admin-aware sign-in method. The initializer must be idempotent and must not overwrite changes to ordinary registered users. Admin sessions use the existing mock JWT shape with `role: 'admin'`.

The login component owns the selected portal mode and sends it with the submitted credentials. User mode uses the existing registration flow. Admin mode uses the admin sign-in path and never creates an account through sign-up or OAuth.

### Routing and protection

`App` will branch after authentication:

1. No session: render the shared `AuthView`.
2. Authenticated admin: render `AdminView`.
3. Authenticated user who has not completed onboarding: render `OnboardingView`.
4. Authenticated regular user: render the existing user `Shell`.

The admin branch must check `session.user.role === 'admin'` rather than trusting the selected login mode. A non-admin session must never render the admin dashboard.

### Admin data operations

Add narrowly scoped service operations for listing, updating status, and deleting users. Every operation must identify users by stable ID. The seeded admin ID is protected in the service layer as well as in the UI. Operations update the existing `scp_registered_users` store and return explicit success or error results for toast feedback.

The dashboard should use a focused component boundary (`AdminView`) and not modify the existing social feed state. Admin sign-out uses the existing `useAuth` sign-out flow.

## Error handling

- Invalid or missing admin credentials show the existing auth error banner.
- Deactivated users receive a clear sign-in error and do not receive a session.
- Admin actions against a missing user or the protected admin return an explicit error and show an error toast.
- No broad catch or silent fallback is introduced.

## Testing and verification

Add focused tests for:

- Idempotent seeded-admin creation.
- Correct admin credentials producing an admin session.
- Incorrect admin credentials being rejected.
- Deactivated users being rejected on login.
- Admin-only dashboard rendering.
- Admin status changes and deletion behavior.
- Protected admin account behavior.

Run the production build after the focused tests.

## Demo limitation

This project currently stores demo credentials in browser localStorage and uses mock JWTs. The supplied admin credentials are for local demonstration only and must not be used in production. A production implementation would move password verification and role enforcement to a trusted server.
