{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Titan OS V4.3 - System Environment & Core Security (Chunk 1 of 3)",
  "version": "4.3.0",
  "system_environment": {
    "node_version": "26.12.0",
    "runtime": "Node.js Express Web Service",
    "deployment_platform": "Render (titan-os-v4-3-1)",
    "port": 3000,
    "environment_variables": {
      "META_APP_SECRET": { "type": "string", "required": true, "sensitive": true },
      "WEBHOOK_VERIFY_TOKEN": { "type": "string", "required": true, "sensitive": true },
      "WHATSAPP_ACCESS_TOKEN": { "type": "string", "required": true, "sensitive": true },
      "WHATSAPP_PHONE_NUMBER_ID": { "type": "string", "required": true, "sensitive": false },
      "GEMINI_API_KEY": { "type": "string", "required": true, "sensitive": true },
      "GEMINI_MODEL": { "type": "string", "default": "gemini-3.5-flash", "required": true },
      "AIRTABLE_API_KEY": { "type": "string", "required": true, "sensitive": true },
      "AIRTABLE_BASE_ID": { "type": "string", "default": "apppNFEBAt2iQLVEP", "required": true },
      "SUPABASE_URL": { "type": "string", "required": true, "sensitive": false },
      "SUPABASE_SERVICE_ROLE_KEY": { "type": "string", "required": true, "sensitive": true },
      "SUPABASE_BUCKET": { "type": "string", "default": "inbound-media", "required": true },
      "AUTO_REPLY": { "type": "boolean", "default": true }
    }
  },
  "security_layer": {
    "hmac_sha256_validation": {
      "header_name": "x-hub-signature-256",
      "algorithm": "sha256",
      "raw_body_buffer_capture": true,
      "enforcement_action": {
        "missing_signature_status": 401,
        "invalid_signature_status": 401,
        "error_message": "Unauthorized: Invalid or missing X-Hub-Signature-256 header"
      }
    }
  },
  "webhook_endpoint": {
    "route": "/webhook",
    "verification_get_handler": {
      "query_parameters": {
        "hub_mode": "hub.mode",
        "hub_verify_token": "hub.verify_token",
        "hub_challenge": "hub.challenge"
      },
      "expected_mode": "subscribe",
      "success_status": 200,
      "failure_status": 403
    },
    "event_post_handler": {
      "root_path": "body.entry[0].changes[0].value",
      "extracted_data": {
        "message_object": "value.messages[0]",
        "sender_phone": "value.messages[0].from",
        "sender_wa_id": "value.contacts[0].wa_id",
        "message_id": "value.messages[0].id",
        "timestamp": "value.messages[0].timestamp",
        "message_type": "value.messages[0].type",
        "caption_text": "value.messages[0].text.body",
        "image_attachment": "value.messages[0].image",
        "video_attachment": "value.messages[0].video",
        "audio_attachment": "value.messages[0].audio"
      }
    }
  },
  "slash_command_engine": {
    "command_prefix": "/link",
    "trigger_condition": "caption_text.startsWith('/link ')",
    "execution_flow": {
      "step_1": "Extract <Site Name> string from caption after /link prefix",
      "step_2": "Query Airtable 'Sites' table matching {Site Name} = extracted name",
      "step_3": "Patch matched record with 'WhatsApp Group ID' = sender_phone (@g.us)",
      "step_4": "Send outbound WhatsApp confirmation text back to group",
      "step_5": "Terminate webhook processing loop early with HTTP 200"
    }
  }
}{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Titan OS V4.3 - Business Logic & AI Engine Schema (Chunk 2 of 3)",
  "version": "4.3.0",
  "worker_bouncer_security": {
    "target_table": "Worker",
    "e164_normalization": "Convert sender_phone to pure E.164 string (e.g., '+14379287172')",
    "lookup_query": "AND(OR({Phone E164} = normalized_phone, {WhatsApp Number} = normalized_phone), {Active} = TRUE())",
    "match_handling": {
      "on_success": {
        "extract": ["Full Name", "Role", "Default Project"],
        "proceed": true
      },
      "on_failure": {
        "action": "BLOCK",
        "log": "Unauthorized worker attempt blocked at zero token cost",
        "http_status": 200,
        "response": { "status": "BLOCKED", "reason": "Sender not registered or inactive in Worker table" }
      }
    }
  },
  "site_location_resolver": {
    "target_table": "Sites",
    "lookup_query": "{WhatsApp Group ID} = sender_phone",
    "match_handling": {
      "on_success": {
        "extract_fields": {
          "site_record_id": "id",
          "site_name": "fields['Site Name']",
          "preferred_workflow_mode": "fields['Workflow Mode']",
          "site_status": "fields['Site Status']"
        },
        "linked_site_array": ["$site_record_id"]
      },
      "on_failure": {
        "site_name": "Unlinked Location",
        "preferred_workflow_mode": "INSTALLATION",
        "linked_site_array": []
      }
    }
  },
  "supabase_media_archiver": {
    "bucket": "inbound-media",
    "privacy": "public: false",
    "storage_path": "YYYY/MM/${sanitized_message_id}.${file_extension}",
    "headers": {
      "Authorization": "Bearer ${SUPABASE_SERVICE_ROLE_KEY}",
      "apikey": "${SUPABASE_SERVICE_ROLE_KEY}",
      "x-upsert": "true"
    },
    "execution": {
      "step_1": "Fetch raw media binary stream from Meta Graph API using WHATSAPP_ACCESS_TOKEN",
      "step_2": "Sanitize message ID to prevent URL encoding character breaks",
      "step_3": "Stream Buffer directly to Supabase REST storage endpoint with apikey header",
      "step_4": "Return storage path reference string for database logging"
    }
  },
  "gemini_multimodal_engine": {
    "sdk": "@google/genai",
    "model": "gemini-3.5-flash",
    "temperature": 0.0,
    "supported_workflow_modes": ["INSTALLATION", "MAINTENANCE", "SPOT_VISIT"],
    "accepted_milestone_gates": [
      "1. Steel Structure",
      "2. Lower mesh",
      "3. Upper mesh",
      "5. Glass",
      "6. Turf and sand",
      "7. Silicone",
      "8. Net posts and net"
    ],
    "output_format": "STRICT_JSON",
    "json_schema_definition": {
      "workflow_mode": "ENUM('INSTALLATION', 'MAINTENANCE', 'SPOT_VISIT')",
      "mentioned_gates": "ARRAY_OF_STRINGS",
      "verification_basis": "ENUM('VISUAL_PROOF', 'WORKER_CLAIM')",
      "overall_status": "ENUM('CLEARED', 'NEEDS_ATTENTION', 'BLOCKED')",
      "worker_summary": "STRING",
      "status_observed": "STRING",
      "action_intent": "STRING"
    }
  }
}{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Titan OS V4.3 - Database Operations & Outbound Messaging (Chunk 3 of 3)",
  "version": "4.3.0",
  "airtable_inbound_messages_2_pipeline": {
    "target_table": "Inbound Messages 2",
    "fields_mapping": {
      "Message ID": "$webhook.message_id",
      "Worker Phone Raw": "$webhook.sender_phone",
      "Worker": ["$worker.record_id"],
      "Message Type": "$webhook.message_type",
      "Caption Text": "$webhook.caption_text",
      "Media Path": "$supabase.storage_path",
      "Raw Payload JSON": "$webhook.raw_json_string"
    }
  },
  "airtable_reports_2_pipeline": {
    "target_table": "Reports 2",
    "fields_mapping": {
      "Inbound Messages 2": ["$inbound_messages_2.record_id"],
      "Sites": "$site_location_resolver.linked_site_array",
      "Source Batch ID": "$webhook.sender_phone",
      "WhatsApp Reply Text": "$webhook.caption_text",
      "Mentioned Gates": "JOIN_WITH_COMMA($gemini.mentioned_gates)",
      "Verification Basis": "$gemini.verification_basis",
      "Workflow Mode": "$gemini.workflow_mode",
      "Overall Status": "$gemini.overall_status",
      "Worker Summary": "$gemini.worker_summary",
      "Status Observed": "$gemini.status_observed",
      "Action Intent": "$gemini.action_intent",
      "Clean JSON": "JSON.stringify($gemini.raw_output)"
    }
  },
  "outbound_whatsapp_notifier": {
    "condition": "process.env.AUTO_REPLY === 'true'",
    "endpoint": "https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages",
    "message_template": "🤖 Titan OS | ${mode_emoji} ${gemini.workflow_mode} Update\n\n📍 Site: ${site.site_name}\n👷 Worker: ${worker.full_name}\n⚡ Status: ${gemini.overall_status}\n\n📝 Summary:\n${gemini.worker_summary}",
    "headers": {
      "Authorization": "Bearer ${WHATSAPP_ACCESS_TOKEN}",
      "Content-Type": "application/json"
    }
  },
  "response_orchestration": {
    "on_success": {
      "http_status": 200,
      "body": {
        "status": "SUCCESS",
        "message": "Titan OS V4.3 pipeline executed successfully."
      }
    },
    "on_error": {
      "http_status": 500,
      "log_format": "ERROR: Titan OS Pipeline Error: ${error.stack}",
      "body": {
        "status": "INTERNAL_SERVER_ERROR",
        "message": "Failed to process Titan OS pipeline."
      }
    }
  }
}
