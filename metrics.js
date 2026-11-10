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
  database_mutations: 0,
  // NEW: North Star Metrics
  questions_resolved: 0, 
  site_visits_eliminated: 0,
  installations_supported: 0 
};

// Assuming 15 minutes of manual admin time saved per AI resolution/generation
const MINUTES_SAVED_PER_ACTION = 15; 

// Assuming 1 remote action (photo verification, complex Oracle query) saves a potential site visit
const ACTIONS_PER_SITE_VISIT_SAVED = 3;

function incrementMetric(metricName, count = 1) {
  if (telemetry.hasOwnProperty(metricName)) {
    telemetry[metricName] += count;
    
    // Auto-calculate derived North Star metrics based on raw interactions
    if (metricName === 'oracle_queries' || metricName === 'sites_updated') {
        telemetry.questions_resolved += count;
    }
    
    // Increment installations supported when a new site is updated or tracked
    if (metricName === 'sites_updated') {
       // Note: In a persistent database, this would be a unique count of active sites.
       // For in-memory telemetry, we track active engagement as support.
       telemetry.installations_supported += count; 
    }
  }
}

function getTelemetryReport() {
  const hoursSaved = (
    (telemetry.estimates_generated + 
     telemetry.invoices_generated + 
     telemetry.oracle_queries + 
     telemetry.sites_updated) * MINUTES_SAVED_PER_ACTION
  ) / 60;
  
  // Calculate Site Visits Eliminated based on volume of remote interactions
  const visitsEliminated = Math.floor((telemetry.photos_processed + telemetry.voice_commands) / ACTIONS_PER_SITE_VISIT_SAVED);
  telemetry.site_visits_eliminated = visitsEliminated;

  return `📊 *TITAN OS | OPERATIONAL TELEMETRY*\n` +
         `──────────────────────────────\n` +
         `*North Star Business Metrics*\n` +
         `• Site Visits Eliminated: ${telemetry.site_visits_eliminated}\n` +
         `• Admin Hours Eliminated: ~${hoursSaved.toFixed(1)} hrs\n` +
         `• Questions Resolved Remotely: ${telemetry.questions_resolved}\n` +
         `• Installations Supported: ${telemetry.installations_supported}\n` +
         `──────────────────────────────\n` +
         `*Interactions Processed*\n` +
         `• Messages: ${telemetry.messages_processed}\n` +
         `• Voice Notes: ${telemetry.voice_commands}\n` +
         `• Photos/Videos: ${telemetry.photos_processed}\n` +
         `──────────────────────────────\n` +
         `*System Execution*\n` +
         `• Estimates Drafted: ${telemetry.estimates_generated}\n` +
         `• Invoices Issued: ${telemetry.invoices_generated}\n` +
         `• DB Mutations: ${telemetry.database_mutations}\n` +
         `──────────────────────────────\n` +
         `_Uptime: ${((Date.now() - telemetry.bootTime) / 1000 / 60 / 60).toFixed(1)} hrs_`;
}

module.exports = {
  telemetry,
  incrementMetric,
  getTelemetryReport
};
