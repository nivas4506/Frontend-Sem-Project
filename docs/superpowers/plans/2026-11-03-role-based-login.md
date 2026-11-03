# Role-Based Login and Admin Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared User/Admin sign-in switch, seeded demo admin credentials, and a protected admin dashboard for managing local demo users.

**Architecture:** Keep the existing React and localStorage architecture. Extend `authService` with an idempotent seeded admin and protected user-management operations, let `AuthView` select the portal mode, and branch `App` to a focused `AdminView` when the authenticated session has the admin role.

**Tech Stack:** React 18, Vite 6, browser localStorage/sessionStorage, Node.js built-in test runner.

---

### Task 1: Add failing auth-service tests and test script

**Files:**
- Create: `test/authService.test.js`
- Modify: `package.json`

- [ ] **Step 1: Add a browser-storage test harness**

Create a small in-memory storage implementation in `test/authService.test.js` and assign it to `globalThis.localStorage` and `globalThis.sessionStorage` before importing the service.

```js
import test from 'node:test';
import assert from 'node:assert/strict';

class MemoryStorage {
  #values = new Map();
  getItem(key) { return this.#values.has(key) ? this.#values.get(key) : null; }
  setItem(key, value) { this.#values.set(key, String(value)); }
  removeItem(key) { this.#values.delete(key); }
  clear() { this.#values.clear(); }
}

globalThis.localStorage = new MemoryStorage();
globalThis.sessionStorage = new MemoryStorage();
const { authService } = await import('../src/services/authService.js');

test.beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  authService.ensureSeededAdmin();
});
```

- [ ] **Step 2: Write failing tests for seeded admin behavior**

Add tests that assert the seeded admin exists, repeated initialization does not duplicate it, valid credentials return `role: 'admin'`, and invalid credentials reject.

```js
test('seeds one stable admin account idempotently', () => {
  const first = authService.getRegisteredUsers().filter(user => user.role === 'admin');
  authService.ensureSeededAdmin();
  const second = authService.getRegisteredUsers().filter(user => user.role === 'admin');
  assert.equal(first.length, 1);
  assert.deepEqual(second, first);
});

test('signs in the seeded admin only with admin credentials', async () => {
  const session = await authService.signInWithEmail(
    'admin@socialconnect.local',
    'Admin@12345',
    'admin'
  );
  assert.equal(session.user.role, 'admin');
  await assert.rejects(
    authService.signInWithEmail('admin@socialconnect.local', 'Admin@12345', 'user'),
    /Admin portal credentials are required/
  );
});
```

- [ ] **Step 3: Add the test command**

Add this script to `package.json`:

```json
"test": "node --test test/*.test.js"
```

- [ ] **Step 4: Run the tests and verify they fail**

Run: `npm test`

Expected: FAIL because `ensureSeededAdmin` and the admin-mode sign-in behavior do not exist yet.

- [ ] **Step 5: Commit the test baseline**

```powershell
git add -- SEM-PROJECT-main/test/authService.test.js SEM-PROJECT-main/package.json
git commit -m "test: define role based auth behavior" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 2: Implement seeded admin authentication and user-management service methods

**Files:**
- Modify: `src/services/authService.js`
- Test: `test/authService.test.js`

- [ ] **Step 1: Add stable admin constants and idempotent initialization**

Define exported constants near the existing storage keys:

```js
export const DEMO_ADMIN_EMAIL = 'admin@socialconnect.local';
export const DEMO_ADMIN_PASSWORD = 'Admin@12345';
export const DEMO_ADMIN_ID = 'usr_demo_admin';
```

Add `ensureSeededAdmin()` to `authService`. It must add the admin only when no user has `DEMO_ADMIN_ID`, preserve all other users, and set `active: true`, `role: 'admin'`, `provider: 'local'`, and `onboardingCompleted: true`.

- [ ] **Step 2: Make authentication initialize and enforce active status**

Call `ensureSeededAdmin()` before reading users in `signInWithEmail`. Change the signature to `signInWithEmail(email, password, portal = 'user')`.

Reject inactive users before creating a session. In `portal === 'admin'`, reject non-admin accounts and require the seeded admin credentials. In `portal === 'user'`, reject admin accounts with an error explaining that the Admin portal mode must be selected. Keep ordinary user password behavior unchanged.

- [ ] **Step 3: Add protected admin operations**

Add these methods to `authService`:

```js
listManagedUsers() // returns a copy of registered users
setUserActive(userId, active) // rejects missing users and DEMO_ADMIN_ID
deleteManagedUser(userId) // rejects missing users and DEMO_ADMIN_ID
```

Each method must persist the complete updated array under `USERS_DB_KEY`, return the updated user or `true`, and throw explicit errors for invalid operations.

- [ ] **Step 4: Add service tests for status and deletion rules**

Cover deactivated-user login rejection, activation, deletion, missing-user errors, and protection of the seeded admin. Run `npm test` and verify all tests pass.

- [ ] **Step 5: Commit the service**

```powershell
git add -- SEM-PROJECT-main/src/services/authService.js SEM-PROJECT-main/test/authService.test.js
git commit -m "feat: add seeded admin authentication service" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 3: Add the User/Admin sign-in switch

**Files:**
- Modify: `src/components/AuthView.jsx`
- Modify: `src/App.jsx`
- Modify: `src/hooks/useAuth.js`
- Modify: `src/index.css` or `src/app.css` using the existing auth styles

- [ ] **Step 1: Add portal mode state and submit it**

In `AuthView`, add `portalMode` state defaulting to `'user'`, render accessible User/Admin buttons above the heading, and pass `portalMode` as the second argument to `onAuthenticate`. In Admin mode, hide sign-up/OAuth controls and show the seeded demo credentials/helper copy.

- [ ] **Step 2: Thread portal mode through auth hooks**

Change `useAuth.signIn` to accept `(email, password, portal = 'user')` and call `authService.signInWithEmail(email, password, portal)`. Call `authService.ensureSeededAdmin()` during initial auth setup or before rendering the auth screen so the admin account is available immediately.

- [ ] **Step 3: Update App authentication handling**

Change `handleAuthenticate(formData, mode, portalMode)` or the equivalent callback signature to pass portal mode to `signIn`; keep sign-up restricted to user mode. Update the `AuthView` prop callback without changing onboarding behavior.

- [ ] **Step 4: Add focused switch styles**

Use the existing dark auth card palette. The selected mode must have a clear active state, visible focus outline, and `aria-pressed` state. Keep the switch responsive and avoid changing the existing user login layout beyond the new control.

- [ ] **Step 5: Build and manually verify the sign-in states**

Run: `npm run build`

Then start the Vite app, verify User mode still supports sign-up and OAuth, verify Admin mode shows the demo credentials, and verify an admin login produces an admin session.

- [ ] **Step 6: Commit the shared login**

```powershell
git add -- SEM-PROJECT-main/src/components/AuthView.jsx SEM-PROJECT-main/src/App.jsx SEM-PROJECT-main/src/hooks/useAuth.js SEM-PROJECT-main/src/index.css SEM-PROJECT-main/src/app.css
git commit -m "feat: add user and admin portal login modes" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 4: Create the protected admin dashboard

**Files:**
- Create: `src/components/AdminView.jsx`
- Modify: `src/App.jsx`
- Modify: `src/app.css`
- Modify: `src/utils/toast.js` only if an existing toast helper cannot be imported directly

- [ ] **Step 1: Implement the dashboard component**

Create `AdminView({ user, onSignOut })` with local state for `users`, `query`, `loading`, and `error`. Load users from `authService.listManagedUsers()` on mount. Filter by lower-cased name/email and render the total count plus a table/card list with role, active state, and actions.

Use `authService.setUserActive` and `authService.deleteManagedUser` for actions. After each successful action, refresh the list and call the existing `toast` helper. Catch only these expected service errors and show their messages; do not silently ignore failures.

Disable action controls for the protected admin row and include a sign-out button.

- [ ] **Step 2: Add the App route guard**

After the `!session` branch and before onboarding, render:

```jsx
if (session.user.role === 'admin') {
  return <AdminView user={session.user} onSignOut={handleSignOut} />;
}
```

The admin branch must be role-based, not based on a client-selected login mode. Import `AdminView` in `App.jsx`.

- [ ] **Step 3: Style the admin layout**

Add focused styles for the dashboard header, stats card, search input, responsive user list, status badges, and destructive action button. Reuse existing typography, borders, spacing, and focus-visible rules.

- [ ] **Step 4: Verify protected behavior**

Run `npm test` and `npm run build`. In the browser, verify the admin can search, deactivate, reactivate, and delete a regular user; cannot delete/deactivate the admin; and signs out to the shared login screen. Verify a deactivated user cannot log in until reactivated.

- [ ] **Step 5: Commit the admin portal**

```powershell
git add -- SEM-PROJECT-main/src/components/AdminView.jsx SEM-PROJECT-main/src/App.jsx SEM-PROJECT-main/src/app.css
git commit -m "feat: add protected admin user management portal" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

### Task 5: Final verification and documentation

**Files:**
- Modify: `README.md`
- Verify: `docs/superpowers/specs/2026-11-03-role-based-login-design.md`

- [ ] **Step 1: Document the demo credentials and limitation**

Add an Accounts/Admin section to `README.md` listing the demo credentials and clearly state that authentication is localStorage/mock-only and the credentials are not for production.

- [ ] **Step 2: Run the complete focused validation**

Run:

```powershell
npm test
npm run build
```

Expected: all auth tests pass and Vite reports a successful production build.

- [ ] **Step 3: Check the final diff**

Run: `git --no-pager diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Commit documentation**

```powershell
git add -- SEM-PROJECT-main/README.md
git commit -m "docs: explain demo admin access" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```
