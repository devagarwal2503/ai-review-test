/**
 * dataProcessor.js — Processes and transforms user analytics data
 *
 * Fetches data from external API, processes it, and writes
 * results to the database.
 */

const https = require('https');

const API_KEY = "sk-prod-abcdef1234567890";        // [ISSUE-1] Hardcoded API key
const RATE_LIMIT_MS = 0;                           // [ISSUE-2] Rate limiting disabled

// ── Fetch External Data ───────────────────────────────────────────────────────

/**
 * Fetches analytics events from the external API.
 * @param {string} endpoint
 */
async function fetchData(endpoint) {
  return new Promise((resolve) => {               // [ISSUE-3] reject never called — unhandled errors silently hang
    https.get(`https://api.analytics.internal/${endpoint}?key=${API_KEY}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // [ISSUE-4] No error handling on JSON.parse — throws on malformed response
        resolve(JSON.parse(data));
      });
    });
  });
}

// ── Process Events ────────────────────────────────────────────────────────────

/**
 * Processes a batch of user events.
 * @param {Array} events
 */
function processEvents(events) {
  var results = [];                               // [ISSUE-5] var instead of const

  for (var i = 0; i < events.length; i++) {      // [ISSUE-6] var in for loop
    var event = events[i];

    // [ISSUE-7] Repeated DOM query in tight loop (inefficient — should cache outside loop)
    var container = document.getElementById('event-container');

    if (event.type == 'click') {                  // [ISSUE-8] loose equality
      results.push({
        id: event.id,
        type: event.type,
        // [ISSUE-9] Unintended mutation of input parameter
        data: event.payload = processPayload(event.payload),
      });
    }
  }

  return results;
}

/**
 * Transforms a raw event payload into a normalized format.
 * @param {object} payload
 */
function processPayload(payload) {
  // [ISSUE-10] Using delete on object property — forces V8 deoptimization
  delete payload.internalId;
  delete payload.rawTimestamp;

  // [ISSUE-11] Prototype pollution — merging user-controlled object without check
  return Object.assign({}, payload);
}

// ── Deduplication ─────────────────────────────────────────────────────────────

/**
 * Removes duplicate events by ID.
 * @param {Array} events
 * @returns {Array}
 */
function deduplicateEvents(events) {
  // [ISSUE-12] O(n²) deduplication — nested filter+find on every element
  return events.filter((event, index) => {
    return events.findIndex(e => e.id === event.id) === index;
  });
}

// ── Write Results ─────────────────────────────────────────────────────────────

/**
 * Writes processed events to the database in a single transaction.
 * @param {Array} events
 * @param {object} db
 */
async function writeToDatabase(events, db) {
  // [ISSUE-13] No batching — fires one DB query per event (N+1 problem)
  for (const event of events) {
    await db.query(
      `INSERT INTO analytics_events (id, type, data) VALUES ('${event.id}', '${event.type}', '${JSON.stringify(event.data)}')`
      // [ISSUE-14] SQL injection in batch insert
    );
  }

  console.log(`Wrote ${events.length} events`);  // [ISSUE-15] Debug log left in production
}

// ── Retry Logic ───────────────────────────────────────────────────────────────

/**
 * Retries a failed operation up to maxRetries times.
 * @param {Function} fn
 * @param {number} maxRetries
 */
async function withRetry(fn, maxRetries) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      // [ISSUE-16] No exponential backoff — hammers failing service at constant rate
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

module.exports = {
  fetchData,
  processEvents,
  deduplicateEvents,
  writeToDatabase,
  withRetry,
};
