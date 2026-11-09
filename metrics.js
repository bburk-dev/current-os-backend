/**
 * TITAN OS V6.0.22 — OPERATIONAL TELEMETRY LAYER
 * Module: metrics.js
 * Purpose: In-memory tracking of business and operational metrics to prove 
 *          system adoption, scale, and administrative hours eliminated.
 */

// In-Memory Telemetry Singleton
const telemetry = {
  bootTime: Date.now(),
  voice_commands: 0,
  messages_processed: 0,
  photos_processed: 0,
  estimates_generated: 0,
  invoices_generated: 0,
  oracle_queries: 0,
  sites_updated: 0,
  database_mutations: 0
};

// Assuming 15 minutes of manual admin time saved per AI resolution/generation
const MINUTES_SAVED_PER_ACTION = 15; 

function incrementMetric(metricName, count = 1) {
  if (telemetry.hasOwnProperty(metricName)) {
    telemetry[metricName] += count;
  }
}

function getTelemetryReport() {
  const hoursSaved = (
    (telemetry.estimates_generated + 
     telemetry.invoices_generated + 
     telemetry.oracle_queries + 
     telemetry.sites_updated) * MINUTES_SAVED_PER_ACTION
  ) / 60;

  return `📊 *TITAN OS | OPERATIONAL TELEMETRY*\n` +
         `──────────────────────────────\n` +
         `*Interactions Processed*\n` +
         `• Messages: ${telemetry.messages_processed}\n` +
         `• Voice Notes: ${telemetry.voice_commands}\n` +
         `• Photos/Videos: ${telemetry.photos_processed}\n` +
         `──────────────────────────────\n` +
         `*Business Value Generated*\n` +
         `• Estimates Drafted: ${telemetry.estimates_generated}\n` +
         `• Invoices Issued: ${telemetry.invoices_generated}\n` +
         `• Oracle Queries Resolved: ${telemetry.oracle_queries}\n` +
         `• Site Ledgers Updated: ${telemetry.sites_updated}\n` +
         `• DB Mutations: ${telemetry.database_mutations}\n` +
         `──────────────────────────────\n` +
         `⏱️ *Admin Hours Eliminated:* ~${hoursSaved.toFixed(1)} hrs\n` +
         `_Uptime: ${((Date.now() - telemetry.bootTime) / 1000 / 60 / 60).toFixed(1)} hrs_`;
}

module.exports = {
  telemetry,
  incrementMetric,
  getTelemetryReport
};
