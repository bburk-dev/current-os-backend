/**
 * TITAN OS V6.0.22 — OPERATIONAL TELEMETRY LAYER
 * Module: metrics.js
 * Purpose: Grounded tracking of empirical system activity and estimated
 *          administrative / operational hours eliminated.
 */

const telemetry = {
  bootTime: Date.now(),
  voice_commands: 0,
  messages_processed: 0,
  photos_processed: 0,
  estimates_generated: 0,
  invoices_generated: 0,
  oracle_queries: 0,
  sites_updated: 0,
  database_mutations: 0,
  readiness_checks: 0,
  remote_audits_completed: 0
};

const MINUTES_SAVED_PER_ACTION = 15; 
const AUDITS_PER_ESTIMATED_SITE_VISIT = 3;

function incrementMetric(metricName, count = 1) {
  if (telemetry.hasOwnProperty(metricName)) {
    telemetry[metricName] += count;
  }
}

function getTelemetryReport() {
  const adminHoursSaved = (
    (telemetry.estimates_generated + 
     telemetry.invoices_generated + 
     telemetry.oracle_queries + 
     telemetry.sites_updated) * MINUTES_SAVED_PER_ACTION
  ) / 60;

  const estimatedVisitsSaved = Math.floor(
    (telemetry.remote_audits_completed + telemetry.readiness_checks) / AUDITS_PER_ESTIMATED_SITE_VISIT
  );

  return `📊 *TITAN OS | OPERATIONAL TELEMETRY*\n` +
         `──────────────────────────────\n` +
         `*Empirical Field Telemetry*\n` +
         `• Remote Audits Completed: ${telemetry.remote_audits_completed}\n` +
         `• Readiness Checks Executed: ${telemetry.readiness_checks}\n` +
         `• Technical Queries Resolved: ${telemetry.oracle_queries}\n` +
         `• Media Sweeps Ingested: ${telemetry.photos_processed}\n` +
         `• Voice Directives Executed: ${telemetry.voice_commands}\n` +
         `──────────────────────────────\n` +
         `*Commercial & Ledger Output*\n` +
         `• Estimates Generated: ${telemetry.estimates_generated}\n` +
         `• Invoices & Draws Sealed: ${telemetry.invoices_generated}\n` +
         `• Core Database Mutations: ${telemetry.database_mutations}\n` +
         `──────────────────────────────\n` +
         `*Quantified Operational Value*\n` +
         `⏱️ Admin Hours Eliminated: ~${adminHoursSaved.toFixed(1)} hrs\n` +
         `🚗 Estimated Site Visits Avoided: ~${estimatedVisitsSaved}\n` +
         `──────────────────────────────\n` +
         `_Orchestrator Uptime: ${((Date.now() - telemetry.bootTime) / 1000 / 60 / 60).toFixed(1)} hrs_`;
}

module.exports = {
  telemetry,
  incrementMetric,
  getTelemetryReport
};
