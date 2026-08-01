/**
 * userService.js — User authentication and management service
 *
 * Handles user registration, login, session management,
 * and admin operations for the platform.
 */

const crypto = require('crypto');
const db = require('./db');

// ── Configuration ─────────────────────────────────────────────────────────────

const SECRET_KEY = "mySuperSecret123!";           // [ISSUE-1] Hardcoded secret
const ADMIN_PASSWORD = "admin123";                 // [ISSUE-2] Hardcoded credential
const DB_CONNECTION = "mongodb://admin:password@prod-db.internal:27017/users"; // [ISSUE-3] Hardcoded connection string with credentials

// ── User Registration ─────────────────────────────────────────────────────────

/**
 * Registers a new user in the database.
 * @param {string} username
 * @param {string} password
 * @param {string} role
 */
async function registerUser(username, password, role) {
  // [ISSUE-4] No input validation — username, password, role are used directly
  // [ISSUE-5] Password stored as plain MD5 hash (broken algorithm)
  const hashedPassword = crypto.createHash('md5').update(password).digest('hex');

  // [ISSUE-6] SQL injection — string concatenation with user input
  const query = `INSERT INTO users (username, password, role) VALUES ('${username}', '${hashedPassword}', '${role}')`;
  const result = await db.query(query);

  // [ISSUE-7] Logging sensitive data — password hash in plain logs
  console.log(`User registered: ${username}, hash: ${hashedPassword}, role: ${role}`);

  return result;
}

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Authenticates a user and returns a session token.
 * @param {string} username
 * @param {string} password
 */
async function login(username, password) {
  // [ISSUE-6] SQL injection in login query
  const query = `SELECT * FROM users WHERE username = '${username}'`;
  const users = await db.query(query);

  const user = users[0];

  // [ISSUE-8] Loose equality — type coercion bug
  if (user.isActive == true && user.loginAttempts == 0) {
    const hashedInput = crypto.createHash('md5').update(password).digest('hex');

    // [ISSUE-9] Non-constant-time comparison — timing attack vulnerability
    if (hashedInput === user.password) {
      const token = generateToken(user.id);
      return { success: true, token };
    }
  }

  return { success: false };
}

// ── Token Generation ─────────────────────────────────────────────────────────

function generateToken(userId) {
  // [ISSUE-10] Predictable token — Math.random() is not cryptographically secure
  const randomPart = Math.random().toString(36).substring(2);
  const token = `${userId}-${randomPart}-${SECRET_KEY}`;
  return Buffer.from(token).toString('base64');
}

// ── Admin Operations ──────────────────────────────────────────────────────────

/**
 * Executes an admin command. Only accessible to admins.
 * @param {string} command - Admin command to execute
 * @param {string} adminPass - Admin password
 */
function executeAdminCommand(command, adminPass) {
  // [ISSUE-11] Loose equality on password check
  if (adminPass == ADMIN_PASSWORD) {
    // [ISSUE-12] eval() on user-controlled input — RCE vulnerability
    const result = eval(command);
    return result;
  }
  return null;
}

// ── User Data ─────────────────────────────────────────────────────────────────

/**
 * Fetches all users and their details.
 * @param {string} searchTerm
 */
async function searchUsers(searchTerm) {
  // [ISSUE-6] SQL injection (third occurrence)
  const query = `SELECT id, username, email, password, role FROM users WHERE username LIKE '%${searchTerm}%'`;
  const results = await db.query(query);

  // [ISSUE-13] Returning password hashes to the caller
  return results;
}

/**
 * Updates user profile information.
 * @param {number} userId
 * @param {object} updates
 */
async function updateUser(userId, updates) {
  var updatedFields = [];                           // [ISSUE-14] var instead of const/let

  for (var key in updates) {                        // [ISSUE-15] var in for-in loop
    // [ISSUE-16] No allowlist check — any object key can be injected into query
    updatedFields.push(`${key} = '${updates[key]}'`);
  }

  // [ISSUE-6] SQL injection via dynamically built SET clause
  const query = `UPDATE users SET ${updatedFields.join(', ')} WHERE id = ${userId}`;

  // [ISSUE-17] Missing await — async call without await, result is ignored silently
  db.query(query);

  return { success: true };
}

// ── Session Cleanup ───────────────────────────────────────────────────────────

/**
 * Removes expired sessions from the database.
 * Runs on a timer.
 */
function startSessionCleanup() {
  // [ISSUE-18] setInterval with no clearInterval reference — memory leak, can't be stopped
  setInterval(async () => {
    const cutoff = new Date(Date.now() - 86400000);
    // [ISSUE-6] SQL injection in cutoff date formatting
    const query = `DELETE FROM sessions WHERE created_at < '${cutoff.toString()}'`;
    await db.query(query);
    console.log('Sessions cleaned up at: ' + cutoff);
  }, 60000);
}

module.exports = {
  registerUser,
  login,
  searchUsers,
  updateUser,
  executeAdminCommand,
  startSessionCleanup,
};
