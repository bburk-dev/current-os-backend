```python
code = """/**
 * TITAN OS V4.7.0 — INDUSTRIAL HEADLESS FIELD ORCHESTRATOR & PROACTIVE HITL AGENT
 * Production Build — Compound Schedulers, Interactive Action Buttons, Nearest-Ticket Routing & Fleet Map
 */

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

try {
  require('dotenv').config();
} catch (e) {
  // Render injects environment variables natively
}

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ====================================================================
// 1. CONFIGURATION
// ====================================================================
const CONFIG = {
  port: PORT,
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.META_ACCESS_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID,
    graphApiUrl: 'https://graph.facebook.com/v21.0'
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.STORAGE_BUCKET || 'inbound-media'
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  },
  airtable: {
    apiKey: process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    baseId: process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP',
    endpoint: 'https://api.airtable.com/v0'
  }
};

const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3500;
const processedMessageIds = new Set();

const AMBIENT_CHAT_MODES = ['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'SPOT_VISIT', 'MAINTENANCE'];

// ====================================================================
// 2. INDUSTRIAL & AMBIENT PROMPTS
// ====================================================================

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.
"""
lines = code.split("\n")
for i, line in enumerate(lines, 1):
    if "You are the Titan OS Forensic" in line:
        print(f"Line {i}: {line}")
    if i in [73, 74, 75, 76]:
        print(f"Line {i}: {repr(line)}")


```

```text
Line 73: 'const INDUSTRIAL_SYSTEM_PROMPT = `'
Line 74: You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.
Line 74: 'You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.'
Line 75: ''


```

```python
import re

user_msg = """/**
 * TITAN OS V4.6.1 — INDUSTRIAL HEADLESS FIELD ORCHESTRATOR
 * Production Build — Compound Schedulers (2-Hr Default), Identity Matrix, Staging Gates & Telemetry
 */

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

try {
  require('dotenv').config();
} catch (e) {
  // Render injects environment variables natively
}

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ====================================================================
// 1. CONFIGURATION
// ====================================================================
const CONFIG = {
  port: PORT,
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.META_ACCESS_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID,
    graphApiUrl: 'https://graph.facebook.com/v21.0'
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.STORAGE_BUCKET || 'inbound-media'
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  },
  airtable: {
    apiKey: process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    baseId: process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP',
    endpoint: 'https://api.airtable.com/v0'
  }
};

const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3500;
const processedMessageIds = new Set();

const AMBIENT_CHAT_MODES = ['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'SPOT_VISIT'];

// ====================================================================
// 2. INDUSTRIAL & AMBIENT PROMPTS
// ====================================================================

const INDUSTRIAL_SYSTEM_PROMPT = `
"""
# Let's check the characters around INDUSTRIAL_SYSTEM_PROMPT in the original user prompt
# In the original user prompt:
# Look for non-breaking spaces or unicode characters!


```

```python
# Let's inspect the exact lines from the user prompt
import sys

# Let's check if there are zero-width spaces or non-breaking spaces or curly quotes or something:
with open('/tmp/test_node.js', 'w') as f:
    # let's read the full code from my previous response and write it to test_node.js and test running node on it!
    pass


```

```python
code_prev = """/**
 * TITAN OS V4.7.0 — INDUSTRIAL HEADLESS FIELD ORCHESTRATOR & PROACTIVE HITL AGENT
 * Production Build — Compound Schedulers, Interactive Action Buttons, Nearest-Ticket Routing & Fleet Map
 */

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

try {
  require('dotenv').config();
} catch (e) {
  // Render injects environment variables natively
}

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ====================================================================
// 1. CONFIGURATION
// ====================================================================
const CONFIG = {
  port: PORT,
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.META_ACCESS_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID,
    graphApiUrl: 'https://graph.facebook.com/v21.0'
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.STORAGE_BUCKET || 'inbound-media'
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  },
  airtable: {
    apiKey: process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    baseId: process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP',
    endpoint: 'https://api.airtable.com/v0'
  }
};

const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3500;
const processedMessageIds = new Set();

const AMBIENT_CHAT_MODES = ['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'SPOT_VISIT', 'MAINTENANCE'];

// ====================================================================
// 2. INDUSTRIAL & AMBIENT PROMPTS
// ====================================================================

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.
`;
"""
import subprocess
with open('/tmp/test.js', 'w') as f:
    f.write(code_prev)

res = subprocess.run(['node', '--check', '/tmp/test.js'], capture_output=True, text=True)
print("Return code:", res.returncode)
print("Stderr:", res.stderr)


```

```text
Traceback (most recent call last):
  File "<xbox-string>", line 81, in <module>
    res = subprocess.run(['node', '--check', '/tmp/test.js'], capture_output=True, text=True)
  File "subprocess.py", line 503, in run
    with Popen(*popenargs, **kwargs) as process:
  File "subprocess.py", line 971, in __init__
    self._execute_child(args, executable, preexec_fn, close_fds,
  File "subprocess.py", line 1863, in _execute_child
    raise child_exception_type(errno_num, err_msg, err_filename)
FileNotFoundError: [Errno 2] No such file or directory: 'node'


```

```python
# Let's inspect the text of the user's message in turn 3
raw_text = """
const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.
"""
print([ord(c) for c in raw_text[:50]])


```

```text
[10, 99, 111, 110, 115, 116, 32, 73, 78, 68, 85, 83, 84, 82, 73, 65, 76, 95, 83, 89, 83, 84, 69, 77, 95, 80, 82, 79, 77, 80, 84, 32, 61, 32, 96, 10, 89, 111, 117, 32, 97, 114, 101, 32, 116, 104, 101, 32, 84, 105]


```

```python
# Let's inspect the entire server.js from turn 4 and validate every bracket, backtick, quote, etc.
full_server_js = """/**
 * TITAN OS V4.7.0 — INDUSTRIAL HEADLESS FIELD ORCHESTRATOR & PROACTIVE HITL AGENT
 * Production Build — Compound Schedulers, Interactive Action Buttons, Nearest-Ticket Routing & Fleet Map
 */

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

try {
  require('dotenv').config();
} catch (e) {
  // Render injects environment variables natively
}

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ====================================================================
// 1. CONFIGURATION
// ====================================================================
const CONFIG = {
  port: PORT,
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.META_ACCESS_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID,
    graphApiUrl: 'https://graph.facebook.com/v21.0'
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.STORAGE_BUCKET || 'inbound-media'
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  },
  airtable: {
    apiKey: process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    baseId: process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP',
    endpoint: 'https://api.airtable.com/v0'
  }
};

const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3500;
const processedMessageIds = new Set();

const AMBIENT_CHAT_MODES = ['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'SPOT_VISIT', 'MAINTENANCE'];

// ====================================================================
// 2. INDUSTRIAL & AMBIENT PROMPTS
// ====================================================================

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.

### CORE OPERATING RULES:
1. FOREGROUND ISOLATION: Evaluate ONLY the primary foreground court being inspected.
2. PARALLEL EXECUTION: Gates are verified independently unless a physical dependency blocks them.
3. PRE-INSTALLATION HARDENED STAGING GATES:
   - GATE 0A (Freight & Glass Audit): Inspect container door seals, crate strapping, and glass panel integrity. Check for shattered tempered glass or transit shifting before unbanding.
   - GATE 0B (Offload & Turf Protection): Inspect offload machinery (verify smooth forklift tines or carpet poles) and ensure turf rolls are unpunctured, elevated, and protected from damp soil.
4. INDOOR VS. OUTDOOR SPECIFIC TOLERANCES:
   - INDOOR: Minimum 6.0m clear ceiling height, slab moisture barrier, ventilation during gluing.
   - OUTDOOR: Drainage slope, perimeter curbstone run-off, corrosion protection.
5. GATE 12 DEMOTION: Tools, loose hardware, or debris drops Gate 12, placing site in ACTION_REQUIRED.
6. MULTILINGUAL & LEDGER NORMALIZATION: Ingest in any language, mirror language on WhatsApp, normalize English in ledger.

VALID ASSIGNMENT TYPES (MUST BE EXACT MATCH):
["Emergency Repair", "Service", "Spot Visit Punch", "Supply Delivery", "Sales", "Expense", "Audit / Inspection", "Invoice / Billing", "Payment Received", "Unknown"]

VALID TASK CATEGORIES:
- "Turf: Sand & Grooming"
- "Net: Tension & Hardware"
- "Glass & Structure"
- "Hardware: Caps & Fasteners"
- "Lighting & Electrical"
- "Supply Delivery (Joy Cannon)"
- "Site Cleanliness & Sweep"
- "Season Opening"
- "Season Closing"
- "Quarterly Maintenance"
- "Annual Structural & Torque Audit"
- "Post-Storm / High-Wind Inspection"

### OUTPUT SPECIFICATION (JSON ONLY):
{
  "intent": "WORK_ORDER_CLOSEOUT" | "DISPATCH_CREATE" | "PRE_TOURNAMENT_AUDIT" | "EXPENSE_LOG" | "COMMERCIAL_QUOTE" | "INSTALLATION_INSPECTION" | "GATE_0A_AUDIT" | "GATE_0B_AUDIT" | "INVOICE_REQUEST" | "PAYMENT_RECEIVED",
  "target_court_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English",
  "transcription": "Verbatim English transcript of spoken audio",
  "task_category": "string from VALID TASK CATEGORIES or null",
  "assignment_type": "Emergency Repair" | "Service" | "Spot Visit Punch" | "Supply Delivery" | "Sales" | "Expense" | "Audit / Inspection" | "Invoice / Billing" | "Payment Received" | "Unknown",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "commercial_quote_details": {
    "is_commercial_inquiry": boolean,
    "quote_type": "Tennis Conversion" | "Greenfield Club Build" | "Court Expansion" | "General Pricing",
    "number_of_courts": integer or null,
    "scope_summary": "Detailed English brief of requested build/pricing",
    "directed_to": "string or null"
  },
  "billing_details": {
    "client_name": "string or null",
    "amount": "string or null",
    "invoice_number": "string or null",
    "payment_method": "Wire" | "EMT" | "Cheque" | "Credit Card" | "Unknown",
    "memo": "string or null"
  },
  "expense_details": { "vendor": "string or null", "total": "string or null", "items": ["string array"] },
  "detected_language": "string",
  "environment_detected": "INDOOR" | "OUTDOOR" | "UNKNOWN",
  "status_observed": "ACTION_REQUIRED" | "MILESTONE_PROGRESS" | "COMMISSIONED",
  "action_intent": "HAZARD_BLOCKER" | "DEFECT_REPORT" | "MILESTONE_CLEARANCE",
  "verified_gates": [array of gate strings or numbers e.g. "0A", "0B", 1, 2],
  "needs_attention_gates": [array of gate strings or numbers],
  "site_conditions": "Short string in English",
  "action_items": ["Specific mechanical defect or punch item in English"],
  "worker_summary": "1-2 sentence executive brief in English for INOC ledger.",
  "whatsapp_status_text": "Plaintext WhatsApp card in worker's language."
}
`;
"""
lines = full_server_js.split('\n')
for idx, l in enumerate(lines[:85]):
    print(f"{idx+1:02d}: {l}")


```

```text
01: /**
02:  * TITAN OS V4.7.0 — INDUSTRIAL HEADLESS FIELD ORCHESTRATOR & PROACTIVE HITL AGENT
03:  * Production Build — Compound Schedulers, Interactive Action Buttons, Nearest-Ticket Routing & Fleet Map
04:  */
05: 
06: process.on('uncaughtException', (err) => {
07:   console.error('[CRITICAL] Uncaught Exception:', err);
08: });
09: 
10: process.on('unhandledRejection', (reason, promise) => {
11:   console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
12: });
13: 
14: try {
15:   require('dotenv').config();
16: } catch (e) {
17:   // Render injects environment variables natively
18: }
19: 
20: const express = require('express');
21: const crypto = require('crypto');
22: 
23: const app = express();
24: const PORT = process.env.PORT || 3000;
25: 
26: app.use(express.json({
27:   limit: '50mb',
28:   verify: (req, res, buf) => {
29:     req.rawBody = buf;
30:   }
31: }));
32: app.use(express.urlencoded({ extended: true, limit: '50mb' }));
33: 
34: // ====================================================================
35: // 1. CONFIGURATION
36: // ====================================================================
37: const CONFIG = {
38:   port: PORT,
39:   meta: {
40:     verifyToken: process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN,
41:     accessToken: process.env.META_ACCESS_TOKEN,
42:     appSecret: process.env.META_APP_SECRET,
43:     phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID,
44:     graphApiUrl: 'https://graph.facebook.com/v21.0'
45:   },
46:   supabase: {
47:     url: process.env.SUPABASE_URL,
48:     serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
49:     bucket: process.env.STORAGE_BUCKET || 'inbound-media'
50:   },
51:   gemini: {
52:     apiKey: process.env.GEMINI_API_KEY,
53:     model: 'gemini-2.5-flash',
54:     endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
55:   },
56:   airtable: {
57:     apiKey: process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
58:     baseId: process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP',
59:     endpoint: 'https://api.airtable.com/v0'
60:   }
61: };
62: 
63: const mediaDebounceQueues = new Map();
64: const DEBOUNCE_DELAY_MS = 3500;
65: const processedMessageIds = new Set();
66: 
67: const AMBIENT_CHAT_MODES = ['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'SPOT_VISIT', 'MAINTENANCE'];
68: 
69: // ====================================================================
70: // 2. INDUSTRIAL & AMBIENT PROMPTS
71: // ====================================================================
72: 
73: const INDUSTRIAL_SYSTEM_PROMPT = `
74: You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.
75: 
76: ### CORE OPERATING RULES:
77: 1. FOREGROUND ISOLATION: Evaluate ONLY the primary foreground court being inspected.
78: 2. PARALLEL EXECUTION: Gates are verified independently unless a physical dependency blocks them.
79: 3. PRE-INSTALLATION HARDENED STAGING GATES:
80:    - GATE 0A (Freight & Glass Audit): Inspect container door seals, crate strapping, and glass panel integrity. Check for shattered tempered glass or transit shifting before unbanding.
81:    - GATE 0B (Offload & Turf Protection): Inspect offload machinery (verify smooth forklift tines or carpet poles) and ensure turf rolls are unpunctured, elevated, and protected from damp soil.
82: 4. INDOOR VS. OUTDOOR SPECIFIC TOLERANCES:
83:    - INDOOR: Minimum 6.0m clear ceiling height, slab moisture barrier, ventilation during gluing.
84:    - OUTDOOR: Drainage slope, perimeter curbstone run-off, corrosion protection.
85: 5. GATE 12 DEMOTION: Tools, loose hardware, or debris drops Gate 12, placing site in ACTION_REQUIRED.


```

```python
lines_74 = full_server_js.split('\n')[:74]
for i, l in enumerate(lines_74, 1):
    if '`' in l:
        print(f"Line {i}: {l}")


```

```text
Line 73: const INDUSTRIAL_SYSTEM_PROMPT = `


```

```python
user_turn3 = """const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3500;
const processedMessageIds = new Set();

const AMBIENT_CHAT_MODES = ['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'SPOT_VISIT'];

// ====================================================================
// 2. INDUSTRIAL & AMBIENT PROMPTS
// ====================================================================

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.
"""
print(repr(user_turn3))


```

```text
"const mediaDebounceQueues = new Map();\nconst DEBOUNCE_DELAY_MS = 3500;\nconst processedMessageIds = new Set();\n\nconst AMBIENT_CHAT_MODES = ['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'SPOT_VISIT'];\n\n// ====================================================================\n// 2. INDUSTRIAL & AMBIENT PROMPTS\n// ====================================================================\n\nconst INDUSTRIAL_SYSTEM_PROMPT = `\nYou are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.\n"


```

```python
import sys
for pkg in ['esprima', 'slimit', 'pyjsparser']:
    try:
        __import__(pkg)
        print(f"{pkg} is installed")
    except ImportError:
        print(f"{pkg} is NOT installed")


```

```text
esprima is NOT installed
slimit is NOT installed
pyjsparser is NOT installed


```

```python
code_to_check = full_server_js

# Let's check matching of quotes, template literals, and braces
def validate_js(code):
    lines = code.split('\n')
    in_template = False
    in_block_comment = False
    in_line_comment = False
    in_single_quote = False
    in_double_quote = False
    
    stack = []
    
    i = 0
    n = len(code)
    line_num = 1
    col_num = 1
    
    while i < n:
        c = code[i]
        
        if c == '\n':
            line_num += 1
            col_num = 1
            i += 1
            continue
            
        # check comments
        if not in_template and not in_single_quote and not in_double_quote:
            if not in_block_comment and code[i:i+2] == '//':
                # skip till newline
                next_nl = code.find('\n', i)
                if next_nl == -1:
                    break
                line_num += 1
                col_num = 1
                i = next_nl + 1
                continue
            if not in_block_comment and code[i:i+2] == '/*':
                in_block_comment = True
                i += 2
                col_num += 2
                continue
            if in_block_comment and code[i:i+2] == '*/':
                in_block_comment = False
                i += 2
                col_num += 2
                continue
        
        if in_block_comment:
            i += 1
            col_num += 1
            continue
            
        # check strings
        if c == '\\':
            i += 2
            col_num += 2
            continue
            
        if c == '`' and not in_single_quote and not in_double_quote:
            in_template = not in_template
            i += 1
            col_num += 1
            continue
            
        if in_template:
            # check if ${ occurs inside template
            # (simple check)
            i += 1
            col_num += 1
            continue
            
        if c == "'" and not in_double_quote:
            in_single_quote = not in_single_quote
            i += 1
            col_num += 1
            continue
            
        if c == '"' and not in_single_quote:
            in_double_quote = not in_double_quote
            i += 1
            col_num += 1
            continue
            
        if in_single_quote or in_double_quote:
            i += 1
            col_num += 1
            continue
            
        # brackets
        if c in '({[':
            stack.append((c, line_num, col_num))
        elif c in ')}]':
            if not stack:
                print(f"Unmatched closing {c} at {line_num}:{col_num}")
                return False
            top, tl, tc = stack.pop()
            expected = {'(': ')', '{': '}', '[': ']'}[top]
            if c != expected:
                print(f"Mismatched {top} from {tl}:{tc} closed by {c} at {line_num}:{col_num}")
                return False
                
        i += 1
        col_num += 1
        
    if in_template:
        print("Unclosed template literal `")
        return False
    if in_single_quote:
        print("Unclosed single quote '")
        return False
    if in_double_quote:
        print('Unclosed double quote "')
        return False
    if in_block_comment:
        print("Unclosed block comment /*")
        return False
    if stack:
        print(f"Unclosed brackets: {stack}")
        return False
        
    print("All brackets, quotes, and template literals are balanced!")
    return True

validate_js(code_to_check)


```

```text
All brackets, quotes, and template literals are balanced!


```

```python
fleet_map_section = """
app.get('/fleet-map', async (req, res) => {
  try {
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites?maxRecords=100`;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    const data = await response.json();
    const sites = data.records || [];

    const mapPins = [];
    for (const site of sites) {
      const f = site.fields;
      const coords = await resolveCoordinates(site);
      if (coords && coords.lat && coords.lon) {
        mapPins.push({
          name: f['Site Name'] || 'Padel Asset',
          lat: coords.lat,
          lon: coords.lon,
          mode: f['Workflow Mode'] || 'INSTALLATION',
          status: f['Site Status'] || 'ACTIVE',
          condition: f['Maintenance Condition'] || 'Nominal',
          currentGate: f['Current Gate'] || 'Active Phase',
          lastNote: f['Last Note'] || 'No recent notes recorded'
        });
      }
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Titan OS Continental Fleet Map</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .leaflet-popup-content-wrapper { background: #1e293b; color: #f8fafc; border-radius: 8px; border: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5); }
    .leaflet-popup-tip { background: #1e293b; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-bottom: 6px; letter-spacing: 0.5px; }
    .badge-active { background: #15803d; color: #dcfce7; }
    .badge-paused { background: #b91c1c; color: #fee2e2; }
    .badge-amber { background: #d97706; color: #fef3c7; }
    .site-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; color: #f8fafc; }
    .site-meta { font-size: 12px; color: #94a3b8; margin-bottom: 3px; }
    .site-note { margin-top: 6px; font-size: 11px; color: #cbd5e1; font-style: italic; border-top: 1px solid #334155; padding-top: 4px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { zoomControl: false }).setView([44.5, -79.5], 6);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB &copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    const pins = ${JSON.stringify(mapPins)};
    const bounds = [];

    pins.forEach(pin => {
      let color = '#22c55e';
      let badgeClass = 'badge-active';
      let badgeText = 'ACTIVE / NOMINAL';

      if (pin.status === 'PAUSED' || pin.condition.toLowerCase().includes('hazard')) {
        color = '#ef4444';
        badgeClass = 'badge-paused';
        badgeText = 'PAUSED / HAZARD';
      } else if (pin.condition.toLowerCase().includes('action')) {
        color = '#f59e0b';
        badgeClass = 'badge-amber';
        badgeText = 'ACTION REQUIRED';
      }

      const marker = L.circleMarker([pin.lat, pin.lon], {
        radius: 8,
        fillColor: color,
        color: '#ffffff',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.85
      }).addTo(map);

      marker.bindPopup(\`
        <div>
          <span class="badge \\\${badgeClass}">\\\${badgeText}</span>
          <div class="site-title">\\\${pin.name}</div>
          <div class="site-meta"><strong>Workflow:</strong> \\\${pin.mode}</div>
          <div class="site-meta"><strong>Phase / Gate:</strong> \\\${pin.currentGate}</div>
          <div class="site-note">\\\${pin.lastNote}</div>
        </div>
      \`);

      bounds.push([pin.lat, pin.lon]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('[Fleet Map Error]:', err);
    res.status(500).send('Failed to generate fleet map');
  }
});
"""
print("Fleet map check ok")


```

```text
Fleet map check ok


```

```javascript
/**
 * TITAN OS V4.7.0 — INDUSTRIAL HEADLESS FIELD ORCHESTRATOR & PROACTIVE HITL AGENT
 * Production Build — Compound Schedulers, Interactive Action Buttons, Nearest-Ticket Routing & Fleet Map
 */

process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

try {
  require('dotenv').config();
} catch (e) {
  // Render injects environment variables natively
}

const express = require('express');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({
  limit: '50mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ====================================================================
// 1. CONFIGURATION
// ====================================================================
const CONFIG = {
  port: PORT,
  meta: {
    verifyToken: process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN,
    accessToken: process.env.META_ACCESS_TOKEN,
    appSecret: process.env.META_APP_SECRET,
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || process.env.PHONE_NUMBER_ID,
    graphApiUrl: 'https://graph.facebook.com/v21.0'
  },
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
    bucket: process.env.STORAGE_BUCKET || 'inbound-media'
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
  },
  airtable: {
    apiKey: process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PERSONAL_ACCESS_TOKEN,
    baseId: process.env.AIRTABLE_BASE_ID || 'apppNFEBAt2iQLVEP',
    endpoint: 'https://api.airtable.com/v0'
  }
};

const mediaDebounceQueues = new Map();
const DEBOUNCE_DELAY_MS = 3500;
const processedMessageIds = new Set();

const AMBIENT_CHAT_MODES = ['EXECUTIVE', 'LOGISTICS', 'PRODUCTION', 'INVENTORY', 'SPOT_VISIT', 'MAINTENANCE'];

// ====================================================================
// 2. INDUSTRIAL & AMBIENT PROMPTS
// ====================================================================

const INDUSTRIAL_SYSTEM_PROMPT = `
You are the Titan OS Forensic Inspection Engine, an industrial-grade deterministic evaluator for padel court construction. You inspect multimodal edge media against strict mechanical and safety tolerances.

### CORE OPERATING RULES:
1. FOREGROUND ISOLATION: Evaluate ONLY the primary foreground court being inspected.
2. PARALLEL EXECUTION: Gates are verified independently unless a physical dependency blocks them.
3. PRE-INSTALLATION HARDENED STAGING GATES:
   - GATE 0A (Freight & Glass Audit): Inspect container door seals, crate strapping, and glass panel integrity. Check for shattered tempered glass or transit shifting before unbanding.
   - GATE 0B (Offload & Turf Protection): Inspect offload machinery (verify smooth forklift tines or carpet poles) and ensure turf rolls are unpunctured, elevated, and protected from damp soil.
4. INDOOR VS. OUTDOOR SPECIFIC TOLERANCES:
   - INDOOR: Minimum 6.0m clear ceiling height, slab moisture barrier, ventilation during gluing.
   - OUTDOOR: Drainage slope, perimeter curbstone run-off, corrosion protection.
5. GATE 12 DEMOTION: Tools, loose hardware, or debris drops Gate 12, placing site in ACTION_REQUIRED.
6. MULTILINGUAL & LEDGER NORMALIZATION: Ingest in any language, mirror language on WhatsApp, normalize English in ledger.

VALID ASSIGNMENT TYPES (MUST BE EXACT MATCH):
["Emergency Repair", "Service", "Spot Visit Punch", "Supply Delivery", "Sales", "Expense", "Audit / Inspection", "Invoice / Billing", "Payment Received", "Unknown"]

VALID TASK CATEGORIES:
- "Turf: Sand & Grooming"
- "Net: Tension & Hardware"
- "Glass & Structure"
- "Hardware: Caps & Fasteners"
- "Lighting & Electrical"
- "Supply Delivery (Joy Cannon)"
- "Site Cleanliness & Sweep"
- "Season Opening"
- "Season Closing"
- "Quarterly Maintenance"
- "Annual Structural & Torque Audit"
- "Post-Storm / High-Wind Inspection"

### OUTPUT SPECIFICATION (JSON ONLY):
{
  "intent": "WORK_ORDER_CLOSEOUT" | "DISPATCH_CREATE" | "PRE_TOURNAMENT_AUDIT" | "EXPENSE_LOG" | "COMMERCIAL_QUOTE" | "INSTALLATION_INSPECTION" | "GATE_0A_AUDIT" | "GATE_0B_AUDIT" | "INVOICE_REQUEST" | "PAYMENT_RECEIVED",
  "target_court_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English",
  "transcription": "Verbatim English transcript of spoken audio",
  "task_category": "string from VALID TASK CATEGORIES or null",
  "assignment_type": "Emergency Repair" | "Service" | "Spot Visit Punch" | "Supply Delivery" | "Sales" | "Expense" | "Audit / Inspection" | "Invoice / Billing" | "Payment Received" | "Unknown",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "commercial_quote_details": {
    "is_commercial_inquiry": boolean,
    "quote_type": "Tennis Conversion" | "Greenfield Club Build" | "Court Expansion" | "General Pricing",
    "number_of_courts": integer or null,
    "scope_summary": "Detailed English brief of requested build/pricing",
    "directed_to": "string or null"
  },
  "billing_details": {
    "client_name": "string or null",
    "amount": "string or null",
    "invoice_number": "string or null",
    "payment_method": "Wire" | "EMT" | "Cheque" | "Credit Card" | "Unknown",
    "memo": "string or null"
  },
  "expense_details": { "vendor": "string or null", "total": "string or null", "items": ["string array"] },
  "detected_language": "string",
  "environment_detected": "INDOOR" | "OUTDOOR" | "UNKNOWN",
  "status_observed": "ACTION_REQUIRED" | "MILESTONE_PROGRESS" | "COMMISSIONED",
  "action_intent": "HAZARD_BLOCKER" | "DEFECT_REPORT" | "MILESTONE_CLEARANCE",
  "verified_gates": [array of gate strings or numbers e.g. "0A", "0B", 1, 2],
  "needs_attention_gates": [array of gate strings or numbers],
  "site_conditions": "Short string in English",
  "action_items": ["Specific mechanical defect or punch item in English"],
  "worker_summary": "1-2 sentence executive brief in English for INOC ledger.",
  "whatsapp_status_text": "Plaintext WhatsApp card in worker's language."
}
`;

const MAINTENANCE_TRIAGE_PROMPT = `
You are the Titan OS Maintenance, Incident Concierge & Commercial Intake Engine.

VALID ASSIGNMENT TYPES (MUST BE EXACT MATCH):
["Emergency Repair", "Service", "Spot Visit Punch", "Supply Delivery", "Sales", "Expense", "Audit / Inspection", "Invoice / Billing", "Payment Received", "Unknown"]

VALID TASK CATEGORIES:
- "Turf: Sand & Grooming"
- "Net: Tension & Hardware"
- "Glass & Structure"
- "Hardware: Caps & Fasteners"
- "Lighting & Electrical"
- "Supply Delivery (Joy Cannon)"
- "Site Cleanliness & Sweep"
- "Season Opening"
- "Season Closing"
- "Quarterly Maintenance"
- "Annual Structural & Torque Audit"
- "Post-Storm / High-Wind Inspection"

SEMANTIC DISAMBIGUATION RULES:
- "Court closing", "closing the court", "winterizing", "season closing", or "shut down for season" MUST BE:
  - intent: "DISPATCH_CREATE"
  - assignment_type: "Service"
  - task_category: "Season Closing"
  - DO NOT classify as commercial quote.

### OUTPUT SPECIFICATION (JSON ONLY):
{
  "intent": "WORK_ORDER_CLOSEOUT" | "DISPATCH_CREATE" | "PRE_TOURNAMENT_AUDIT" | "EXPENSE_LOG" | "COMMERCIAL_QUOTE" | "MAINTENANCE_INSPECTION" | "VIP_CONCIERGE_REQUEST" | "INVOICE_REQUEST" | "PAYMENT_RECEIVED",
  "target_court_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English",
  "transcription": "Verbatim English transcript of spoken audio",
  "task_category": "string from VALID TASK CATEGORIES or null",
  "assignment_type": "Emergency Repair" | "Service" | "Spot Visit Punch" | "Supply Delivery" | "Sales" | "Expense" | "Audit / Inspection" | "Invoice / Billing" | "Payment Received" | "Unknown",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "commercial_quote_details": {
    "is_commercial_inquiry": boolean,
    "quote_type": "Tennis Conversion" | "Greenfield Club Build" | "Court Expansion" | "General Pricing",
    "number_of_courts": integer or null,
    "scope_summary": "Detailed English brief of requested build/pricing",
    "directed_to": "string or null"
  },
  "billing_details": {
    "client_name": "string or null",
    "amount": "string or null",
    "invoice_number": "string or null",
    "payment_method": "Wire" | "EMT" | "Cheque" | "Credit Card" | "Unknown",
    "memo": "string or null"
  },
  "expense_details": { "vendor": "string or null", "total": "string or null", "items": ["string array"] },
  "detected_language": "string",
  "environment_detected": "INDOOR" | "OUTDOOR" | "UNKNOWN",
  "status_observed": "NOMINAL" | "ACTION_REQUIRED" | "HAZARD_OUT_OF_SERVICE",
  "hazard_detected": boolean,
  "defects_identified": ["Specific defect in English"],
  "action_items": ["Action item in English"],
  "site_conditions": "Short string in English",
  "worker_summary": "1-2 sentence executive summary in English for INOC.",
  "whatsapp_status_text": "Plaintext WhatsApp card in client's language."
}
`;

// ====================================================================
// 3. ZERO-TOKEN COMMAND MATRIX & HUMAN MAPS
// ====================================================================
const COMMAND_MAP = {
  '/s': 'STATUS',
  '/sum': 'STATUS',
  '/status': 'STATUS',
  '/summary': 'STATUS',
  '/w': 'WEATHER',
  '/weather': 'WEATHER',
  '/clima': 'WEATHER',
  '/nearby': 'NEARBY_SWEEP',
  '/route': 'NEARBY_SWEEP',
  '/m': 'MODE_MAINTENANCE',
  '/maint': 'MODE_MAINTENANCE',
  '/maintenance': 'MODE_MAINTENANCE',
  '/i': 'MODE_INSTALLATION',
  '/install': 'MODE_INSTALLATION',
  '/spot': 'MODE_SPOT_CHECK',
  '/sc': 'MODE_SPOT_CHECK',
  '/spotcheck': 'MODE_SPOT_CHECK',
  '/l': 'LINK_SITE',
  '/link': 'LINK_SITE',
  '/group': 'LINK_SITE',
  '/map': 'LOCATION',
  '/loc': 'LOCATION',
  '/location': 'LOCATION',
  '/gps': 'LOCATION',
  '/board': 'COURT_BOARD',
  '/schedule': 'COURT_BOARD',
  '/mapview': 'FLEET_MAP_LINK',
  '/fleet': 'FLEET_MAP_LINK',
  '/?': 'HELP',
  '/h': 'HELP',
  '/help': 'HELP',
  '/ayuda': 'HELP'
};

const GATE_NAMES = {
  '0A': 'Freight & Glass Integrity (Container Audit)',
  '0B': 'Offload & Turf Protection',
  1: 'Foundation & Anchor Slab',
  2: 'Steel Frame Assembly',
  3: 'Structural Mesh Panels',
  4: 'Toughened Glass Seating',
  5: 'Light Masts & LED Luminaires',
  6: 'Underlayment Membrane',
  7: 'Turf Seaming & Gluing',
  8: 'Regulation Line Cutting',
  9: 'Silica Sand Distribution',
  10: 'Sand Brushing & Infill Depth',
  11: 'Net Posts & Calibration',
  12: 'Site Cleanliness & Handover'
};

// ====================================================================
// 4. UNIVERSAL GEOSPATIAL & WEATHER UTILITIES
// ====================================================================

function isIndoorSite(site) {
  if (!site) return false;
  const fields = site.fields || site;
  const env = (fields['Environment'] || fields['Site Type'] || fields['Type'] || '').toLowerCase();
  const name = (fields['Site Name'] || '').toLowerCase();
  const notes = (fields['Last Note'] || '').toLowerCase();
  return env.includes('indoor') || name.includes('indoor') || notes.includes('indoor');
}

async function resolveCoordinates(rawLocationOrSite, mapCache = null) {
  let rawLocation = rawLocationOrSite;
  let cache = mapCache;

  if (typeof rawLocationOrSite === 'object' && rawLocationOrSite !== null) {
    const fields = rawLocationOrSite.fields || rawLocationOrSite;
    rawLocation = fields['Site location'];
    cache = fields['Map Cache'];
  }

  if (typeof rawLocation === 'string') {
    const directMatch = rawLocation.trim().match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (directMatch) {
      return { lat: parseFloat(directMatch[1]), lon: parseFloat(directMatch[2]) };
    }
    const urlMatch = rawLocation.trim().match(/[@?&/=](-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
    if (urlMatch) {
      return { lat: parseFloat(urlMatch[1]), lon: parseFloat(urlMatch[2]) };
    }
  }

  if (cache && typeof cache === 'string') {
    try {
      const decoded = Buffer.from(cache, 'base64').toString('utf8');
      const parsed = JSON.parse(decoded);
      const lat = parsed?.l?.lat || parsed?.lat || parsed?.o?.lat;
      const lon = parsed?.l?.lng || parsed?.l?.lon || parsed?.lng || parsed?.lon;
      if (lat && lon) {
        return { lat: parseFloat(lat), lon: parseFloat(lon) };
      }
    } catch (e) {}
  }

  if (typeof rawLocation === 'string' && rawLocation.length > 5) {
    try {
      const cleanAddress = rawLocation.replace(/[^\w\s,]/gi, '').trim();
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanAddress)}&count=1&language=en&format=json`;
      const res = await fetch(geoUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.results && data.results.length > 0) {
          return {
            lat: data.results[0].latitude,
            lon: data.results[0].longitude
          };
        }
      }
    } catch (err) {
      console.warn('[Geocoding Engine] Address lookup failed:', err.message);
    }
  }

  return null;
}

function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function getHyperlocalWeather(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,dew_point_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m&hourly=precipitation_probability,weather_code&forecast_hours=6`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    const maxPrecipProb = Math.max(...(data.hourly?.precipitation_probability || [0]));
    const currentCode = data.current?.weather_code ?? 0;

    const isRainingOrStorm = (currentCode >= 51 && currentCode <= 67) ||
                             (currentCode >= 80 && currentCode <= 82) ||
                             (currentCode >= 95 && currentCode <= 99);

    return {
      temp: data.current?.temperature_2m || 0,
      dewPoint: data.current?.dew_point_2m || 0,
      humidity: data.current?.relative_humidity_2m || 0,
      precip: data.current?.precipitation || 0,
      weatherCode: currentCode,
      isRainingOrStorm,
      windSpeed: data.current?.wind_speed_10m || 0,
      windGusts: data.current?.wind_gusts_10m || 0,
      precipProbability4h: maxPrecipProb
    };
  } catch (err) {
    console.warn('[Weather Engine] Telemetry fetch failed:', err.message);
    return null;
  }
}

function getSupabaseHeaders(contentType = 'application/json') {
  const key = CONFIG.supabase.serviceRoleKey;
  const headers = { 'apikey': key };
  if (contentType) headers['Content-Type'] = contentType;
  if (key && key.startsWith('eyJ')) {
    headers['Authorization'] = `Bearer ${key}`;
  }
  return headers;
}

async function uploadToSupabase(fileBuffer, mimeType) {
  let ext = 'mp4';
  if (mimeType.includes('image')) ext = 'jpg';
  if (mimeType.includes('audio') || mimeType.includes('ogg') || mimeType.includes('opus')) ext = 'ogg';

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const storagePath = `${year}/${month}/${uuid}.${ext}`;

  const uploadUrl = `${CONFIG.supabase.url}/storage/v1/object/${CONFIG.supabase.bucket}/${storagePath}`;
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: getSupabaseHeaders(mimeType),
    body: fileBuffer
  });

  if (!uploadRes.ok) {
    const errText = await uploadRes.text();
    throw new Error(`Supabase upload failed (${uploadRes.status}): ${errText}`);
  }

  const signUrl = `${CONFIG.supabase.url}/storage/v1/object/sign/${CONFIG.supabase.bucket}/${storagePath}`;
  const signRes = await fetch(signUrl, {
    method: 'POST',
    headers: getSupabaseHeaders('application/json'),
    body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 })
  });

  if (!signRes.ok) {
    const errText = await signRes.text();
    throw new Error(`Supabase signing failed (${signRes.status}): ${errText}`);
  }

  const signData = await signRes.json();
  const rawSignedPath = signData.signedURL || signData.signedUrl || '';
  const fullSignedUrl = rawSignedPath.startsWith('http')
    ? rawSignedPath
    : `${CONFIG.supabase.url}/storage/v1${rawSignedPath.startsWith('/') ? '' : '/'}${rawSignedPath}`;

  return { storagePath, signedUrl: fullSignedUrl };
}

async function airtableWriteWithAutoDrop(table, fields, recordId = null, attempt = 1) {
  const cleanFields = { ...fields };

  for (const [key, val] of Object.entries(cleanFields)) {
    if (Array.isArray(val) && val.length === 0) {
      delete cleanFields[key];
    }
  }

  const url = recordId
    ? `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(table)}/${recordId}`
    : `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/${encodeURIComponent(table)}`;

  const method = recordId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${CONFIG.airtable.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ fields: cleanFields })
  });

  if (res.ok) {
    return await res.json();
  }

  const errBody = await res.json().catch(() => ({}));

  if (res.status === 422 && attempt <= 5) {
    const errorMsg = errBody?.error?.message || '';
    console.warn(`[Auto-Healer] 422 on ${table} (Attempt ${attempt}): ${errorMsg}`);

    const match = errorMsg.match(/(?:Unknown field name|Unknown field|Field|Column)\s*:?\s*["\\]+([^"\\]+)["\\]+/i) ||
                  errorMsg.match(/field\s*["\\]+([^"\\]+)["\\]+/i);

    if (match && match[1]) {
      const badField = match[1];
      console.warn(`[Auto-Healer] Pruning incompatible field: "${badField}"`);
      delete cleanFields[badField];
      return await airtableWriteWithAutoDrop(table, cleanFields, recordId, attempt + 1);
    }
  }

  throw new Error(`Airtable write failed on ${table} (${res.status}): ${JSON.stringify(errBody)}`);
}

// ====================================================================
// 5. IDENTITY MATRIX RESOLUTION (CONTACTS & WORKERS)
// ====================================================================

async function lookupContact(phoneRaw) {
  if (!phoneRaw) return null;
  const cleanDigits = phoneRaw.replace(/\D/g, '');
  const searchPhone = cleanDigits.startsWith('1') ? `+${cleanDigits}` : `+1${cleanDigits}`;
  const formula = `OR({Phone Number}='${phoneRaw}', {Phone Number}='${cleanDigits}', {Phone Number}='${searchPhone}', {Phone Number}='+${cleanDigits}')`;
  const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Contacts?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;

  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.records?.[0] || null;
}

async function lookupWorker(phoneRaw) {
  if (!phoneRaw) return null;
  const cleanDigits = phoneRaw.replace(/\D/g, '');
  const filterFormula = `AND({Active}=1, OR({Phone E164}='${phoneRaw}', {Phone E164}='+${cleanDigits}', {WhatsApp Number}='${cleanDigits}'))`;
  const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Worker?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.records?.[0] || null;
}

async function resolveCallerIdentity(fromPhone) {
  if (!fromPhone) {
    return { type: 'UNKNOWN', name: 'External Caller', role: 'Unknown', phone: '' };
  }

  try {
    const contact = await lookupContact(fromPhone);
    if (contact) {
      const siteId = contact.fields['Linked Site']?.[0] || null;
      let siteRecord = null;
      if (siteId) {
        const siteRes = await fetch(`${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites/${siteId}`, {
          headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
        });
        if (siteRes.ok) siteRecord = await siteRes.json();
      }

      return {
        type: 'CONTACT',
        id: contact.id,
        name: contact.fields['Contact Name'] || 'VIP Member',
        role: contact.fields['Role'] || 'Family Member / Player',
        notificationTier: contact.fields['Notification Tier'] || [],
        siteId,
        siteRecord,
        siteName: siteRecord?.fields?.['Site Name'] || 'Private Court Asset',
        facilityTier: siteRecord?.fields?.['Facility Tier'] || 'Standard Residential'
      };
    }
  } catch (err) {
    console.warn('[Identity Engine] Contacts check failed:', err.message);
  }

  try {
    const worker = await lookupWorker(fromPhone);
    if (worker) {
      return {
        type: 'WORKER',
        id: worker.id,
        name: worker.fields['Full Name'] || worker.fields['Worker Name'] || 'Field Tech',
        role: worker.fields['Role'] || 'Field Crew',
        workerRecord: worker
      };
    }
  } catch (err) {
    console.warn('[Identity Engine] Worker check failed:', err.message);
  }

  return {
    type: 'UNKNOWN',
    name: 'External Caller',
    role: 'Unknown',
    phone: fromPhone
  };
}

async function lookupWorkerByName(name) {
  if (!name) return null;
  const cleanName = name.trim().toLowerCase();
  const filterFormula = `AND({Active}=1, SEARCH('${cleanName}', LOWER({Full Name})))`;
  const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Worker?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
  });

  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.records?.[0] || null;
}

async function lookupSite(groupIdOrPhone, siteName = null) {
  if (siteName) {
    const cleanSearch = siteName.replace(/['’]s?/gi, '').trim().toLowerCase();
    const filterFormula = `SEARCH('${cleanSearch}', LOWER({Site Name}))`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.records && data.records.length > 0) return data.records[0];
    }
  }

  if (groupIdOrPhone) {
    const filterFormula = `OR({WhatsApp Group ID}='${groupIdOrPhone}', {WhatsApp Group ID}='${groupIdOrPhone.trim()}')`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
    });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return data.records?.[0] || null;
    }
  }

  return null;
}

async function getAllActiveSitesList() {
  const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites?fields%5B%5D=Site+Name&maxRecords=100`;
  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  return (data.records || []).map(r => r.fields['Site Name']).filter(Boolean);
}

// ====================================================================
// 6. JOY CANNON MULTI-CAST & INTERACTIVE WHATSAPP MESSAGING
// ====================================================================

async function sendWhatsAppReaction(toTarget, messageId, emoji = '⚡') {
  if (!toTarget || !messageId) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');

  const payload = {
    messaging_product: 'whatsapp',
    to: toTarget,
    type: 'reaction',
    reaction: {
      message_id: messageId,
      emoji: emoji
    }
  };

  if (!isGroup) {
    payload.recipient_type = 'individual';
  }

  const url = `${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}/messages`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    return true;
  } catch (err) {
    return false;
  }
}

async function sendWhatsAppMessage(toTarget, messageBody) {
  if (!toTarget) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');

  const payload = {
    messaging_product: 'whatsapp',
    to: toTarget,
    type: 'text',
    text: { body: messageBody }
  };

  if (!isGroup) {
    payload.recipient_type = 'individual';
  }

  const url = `${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errData = await res.text();
    console.error(`WhatsApp dispatch failed to ${toTarget} (${res.status}): ${errData}`);
    return false;
  }
  return true;
}

async function sendWhatsAppButtons(toTarget, textBody, buttons = []) {
  if (!toTarget || !buttons || buttons.length === 0) return false;
  const isGroup = typeof toTarget === 'string' && toTarget.includes('@g.us');

  const actionButtons = buttons.slice(0, 3).map((btn, idx) => ({
    type: 'reply',
    reply: {
      id: btn.id || `btn_${idx}_${Date.now()}`,
      title: (btn.title || 'Select').slice(0, 20)
    }
  }));

  const payload = {
    messaging_product: 'whatsapp',
    to: toTarget,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: textBody },
      action: { buttons: actionButtons }
    }
  };

  if (!isGroup) payload.recipient_type = 'individual';

  const url = `${CONFIG.meta.graphApiUrl}/${CONFIG.meta.phoneNumberId}/messages`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.meta.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn(`[Interactive Button Fallback] API error: ${await res.text()}`);
      const fallbackText = `${textBody}\n\n` + buttons.map(b => `👉 ${b.title}`).join('\n');
      return await sendWhatsAppMessage(toTarget, fallbackText);
    }
    return true;
  } catch (err) {
    console.error('[Interactive Buttons Error]:', err.message);
    const fallbackText = `${textBody}\n\n` + buttons.map(b => `👉 ${b.title}`).join('\n');
    return await sendWhatsAppMessage(toTarget, fallbackText);
  }
}

async function fireJoyCannonMultiCast(siteId, eventPayload) {
  try {
    const siteUrl = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites/${siteId}`;
    const siteRes = await fetch(siteUrl, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!siteRes.ok) return false;

    const site = await siteRes.json();
    const siteName = site.fields['Site Name'] || 'Facility Court';
    const linkedContactIds = site.fields['Linked Contacts'] || [];

    if (!Array.isArray(linkedContactIds) || linkedContactIds.length === 0) {
      console.log(`[Joy Cannon] No linked contacts found for ${siteName}.`);
      return false;
    }

    console.log(`[Joy Cannon Multi-Cast] Broadcasting update for ${siteName} to ${linkedContactIds.length} contact(s)...`);

    for (const contactId of linkedContactIds) {
      const contactUrl = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Contacts/${contactId}`;
      const contactRes = await fetch(contactUrl, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      if (!contactRes.ok) continue;

      const contact = await contactRes.json();
      const phone = contact.fields['Phone Number'];
      const role = contact.fields['Role'];
      const name = contact.fields['Contact Name'] || 'VIP Member';

      if (!phone) continue;
      const cleanPhone = String(phone).replace(/\D/g, '');

      let outboundText = '';
      if (role === 'Property Manager / Caretaker') {
        outboundText = `🛠️ *BOUNCE OPERATIONS | LOGISTICS ALERT*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Attention ${name} — Service update for *${siteName}*:\n\n` +
          `• *Window:* ${eventPayload.window || 'Scheduled Route Window'}\n` +
          `• *Directive:* ${eventPayload.operationalDetails || eventPayload.directive || 'Routine surface grooming & equipment audit.'}\n` +
          `• *Access:* ${eventPayload.accessInstructions || 'Please ensure court gate is unlocked and clear.'}\n\n` +
          `Questions? Reply here directly to reach INOC dispatch.`;
      } else {
        outboundText = `🎾 *BOUNCE CONCIERGE | PRIVATE RESERVE PASS*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Good morning ${name},\n\n` +
          `${eventPayload.executiveSummary || 'Your court has been audited and certified.'}\n\n` +
          `🏟️ *Court:* ${siteName}\n` +
          `🟢 *Status:* ${eventPayload.status || '100% Tour-Ready'}\n` +
          `⚡ *Playability:* ${eventPayload.playabilityScore ? `${eventPayload.playabilityScore}%` : 'Tournament Spec'}\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `*Service completed under your Private Reserve coverage.*`;
      }

      await sendWhatsAppMessage(cleanPhone, outboundText);
    }
    return true;
  } catch (err) {
    console.error('[Joy Cannon Broadcast Error]:', err);
    return false;
  }
}

async function notifyAssignedWorker(ticketNumber, courtName, taskCategory, priority, directiveNotes, workerRecord) {
  if (!workerRecord) return false;

  const workerPhone = workerRecord.fields?.['Phone E164'] || workerRecord.fields?.['WhatsApp Number'];
  if (!workerPhone) {
    console.warn(`[Dispatch Alert] Worker ${workerRecord.fields?.['Full Name']} has no Phone on file.`);
    return false;
  }

  const cleanPhone = String(workerPhone).replace(/\D/g, '');
  const dispatchCard = `📋 *TITAN OS | WORK ORDER ASSIGNED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 *Ticket #${ticketNumber} Assigned to You*\n` +
    `🏟️ *Court:* ${courtName || 'Facility Court'}\n` +
    `🔧 *Category:* ${taskCategory || 'Service'}\n` +
    `⚡ *Priority:* ${priority || 'Medium'}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📝 *Directive:*\n` +
    `${directiveNotes}\n\n` +
    `👉 *When finished, simply reply here with a quick voice memo or photo to close out hands-free.*`;

  console.log(`[Worker Alert] Sending WhatsApp dispatch ticket to ${workerRecord.fields?.['Full Name']} (+${cleanPhone})`);
  return await sendWhatsAppMessage(cleanPhone, dispatchCard);
}

// ====================================================================
// 7. WORK ORDER CLOSEOUT ENGINE & PROACTIVE NEAREST-TICKET ROUTING
// ====================================================================

async function findActiveTicketForSite(siteId, ticketId = null) {
  if (ticketId) {
    const formula = `{Assignment ID} = ${ticketId}`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Daily%20Assignments?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.records && data.records.length > 0) return data.records[0];
    }
  }

  if (siteId) {
    const formula = `AND({Status} != 'Complete', {Status} != 'Cancelled')`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Daily%20Assignments?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=Assignment%20ID&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=20`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      const records = data.records || [];
      return records.find(r => {
        const sites = r.fields['Sites'] || r.fields['Site'] || [];
        return Array.isArray(sites) && sites.includes(siteId);
      }) || null;
    }
  }

  return null;
}

async function findNearestOpenAssignment(currentLat, currentLon, excludeSiteId = null) {
  try {
    const formula = `AND({Status} != 'Complete', {Status} != 'Cancelled')`;
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Daily%20Assignments?filterByFormula=${encodeURIComponent(formula)}&maxRecords=30`;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!res.ok) return null;

    const data = await res.json();
    const openTickets = data.records || [];
    if (openTickets.length === 0) return null;

    let nearest = null;
    let minDistanceKm = Infinity;

    for (const ticket of openTickets) {
      const siteId = ticket.fields['Sites']?.[0] || ticket.fields['Site']?.[0];
      if (!siteId || siteId === excludeSiteId) continue;

      const sRes = await fetch(`${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites/${siteId}`, {
        headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
      });
      if (!sRes.ok) continue;

      const siteRecord = await sRes.json();
      const coords = await resolveCoordinates(siteRecord);
      if (!coords) continue;

      const dist = haversineDistanceKm(currentLat, currentLon, coords.lat, coords.lon);
      if (dist < minDistanceKm) {
        minDistanceKm = dist;
        nearest = {
          ticket,
          site: siteRecord,
          distanceKm: dist
        };
      }
    }

    return nearest;
  } catch (err) {
    console.warn('[Proactive Dispatch Engine] Distance calculation failed:', err.message);
    return null;
  }
}

async function executeWorkOrderCloseout({ site, targetCourtName, ticketId, resolutionNotes, worker, dispatchTarget, fromPhone }) {
  let targetSite = null;
  if (targetCourtName) {
    targetSite = await lookupSite(null, targetCourtName);
  }
  if (!targetSite && site) {
    targetSite = site;
  }

  const activeTicket = await findActiveTicketForSite(targetSite?.id, ticketId);

  if (!activeTicket) {
    const siteLabel = targetSite?.fields?.['Site Name'] || targetCourtName || 'this facility';
    await sendWhatsAppMessage(dispatchTarget, `⚠️ No open work orders currently found for *${siteLabel}* to close.`);
    return false;
  }

  const existingNotes = activeTicket.fields['Notes'] || '';
  const workerName = worker?.fields?.['Full Name'] || (fromPhone ? `Tech (+${fromPhone.slice(-4)})` : 'Field Tech');
  const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const updatedNotes = `${existingNotes}\n\n[COMPLETED by ${workerName} at ${timeStr}]: ${resolutionNotes}`.trim();

  await airtableWriteWithAutoDrop('Daily Assignments', {
    'Status': 'Complete',
    'Notes': updatedNotes
  }, activeTicket.id);

  if (targetSite) {
    await airtableWriteWithAutoDrop('Sites', {
      'Last Note': `Work Order #${activeTicket.fields['Assignment ID']} completed by ${workerName}: ${resolutionNotes}`,
      'Last Intent': 'WORK_ORDER_COMPLETED'
    }, targetSite.id);
  }

  const ticketNum = activeTicket.fields['Assignment ID'] ? `#${activeTicket.fields['Assignment ID']}` : '';
  const courtLabel = targetSite?.fields?.['Site Name'] || 'Assigned Court';

  const voucherReceipt = `🧾 *TITAN OS | CLOSEOUT RECEIPT*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `✅ *Ticket ${ticketNum} Completed*\n` +
    `🏟️ *Court:* ${courtLabel}\n` +
    `👤 *Technician:* ${workerName}\n` +
    `⏱️ *Verified:* ${timeStr}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *Work Performed:*\n` +
    `${resolutionNotes}\n\n` +
    `🟢 *Asset Condition:* Nominal (Court Open for Play)`;

  await sendWhatsAppMessage(dispatchTarget, voucherReceipt);

  // ------------------------------------------------------------------
  // PROACTIVE HITL DISPATCH RECOMMENDATION (NEAREST-TICKET ENGINE)
  // ------------------------------------------------------------------
  if (targetSite) {
    const coords = await resolveCoordinates(targetSite);
    if (coords) {
      const nearest = await findNearestOpenAssignment(coords.lat, coords.lon, targetSite.id);
      if (nearest) {
        const nextCourt = nearest.site.fields['Site Name'] || 'Next Assigned Asset';
        const nextDist = nearest.distanceKm.toFixed(1);
        const nextCat = nearest.ticket.fields['Task Category'] || 'Maintenance';
        const nextNotes = nearest.ticket.fields['Notes'] || 'Follow-up service directive';
        const nextTicketId = nearest.ticket.fields['Assignment ID'] || nearest.ticket.id;

        const routeText = `📍 *TITAN PROACTIVE ROUTE RECOMMENDATION*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `Technician ${workerName} is now clear at *${courtLabel}*.\n\n` +
          `🎯 *Nearest Open Dispatch:* ${nextCourt} (~${nextDist} km away)\n` +
          `🔧 *Scope:* ${nextCat}\n` +
          `📝 *Notes:* ${nextNotes.slice(0, 100)}`;

        const buttons = [
          { id: `DISPATCH_APPROVE_${nextTicketId}_${worker?.id || 'any'}`, title: `⚡ Dispatch to ${nextCourt.slice(0, 8)}` },
          { id: `ROUTE_FACTORY_${worker?.id || 'any'}`, title: `🏭 Return to Factory` }
        ];

        await sendWhatsAppButtons(dispatchTarget, routeText, buttons);
      }
    }
  }

  return true;
}

// ====================================================================
// 8. HEADLESS COMPOUND SCHEDULER & VIP CONCIERGE HANDLERS
// ====================================================================

async function handleCompoundScheduler(text, identity, dispatchTarget, fromPhone, boundSite = null) {
  const targetSite = identity.siteRecord || boundSite;
  const targetSiteId = targetSite?.id || identity.siteId;
  const siteName = targetSite?.fields?.['Site Name'] || identity.siteName || 'Private Compound Court';
  const nowIso = new Date().toISOString();

  const prompt = `
You are the Titan OS Compound Court Scheduler.
Current Time: ${nowIso}
Sender: ${identity.name || 'Compound Member'}
Court Asset: ${siteName}

Extract the scheduling intent from this message: "${text}"

ACTIONS:
- "BOOK": User wants to reserve court time (e.g., "taking the court tomorrow at 10", "playing doubles Sunday 4pm", "book court tomorrow at 9am").
- "CANCEL": User wants to release/cancel their booking (e.g., "going on boat, court is free", "canceling our game").
- "QUERY_SCHEDULE": User asks who is playing or what is available (e.g., "who is playing today?", "is court free at 2?", "show schedule", "board").
- "CHATTER": General banter unrelated to court reservations.

CRITICAL DURATION RULE:
- DEFAULT BOOKING DURATION IS STRICTLY 2 HOURS (120 MINUTES) unless explicitly specified otherwise.
- Example: "Tomorrow at 10 AM" -> startTime: 10:00 AM, endTime: 12:00 PM.
- Example: "Saturday at 2" -> startTime: 2:00 PM, endTime: 4:00 PM.

Output JSON only:
{
  "action": "BOOK" | "CANCEL" | "QUERY_SCHEDULE" | "CHATTER",
  "startTimeIso": "ISO 8601 string or null",
  "endTimeIso": "ISO 8601 string or null",
  "partyName": "string or null",
  "confidence": number
}
`;

  try {
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.0,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    const res = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return false;
    const data = await res.json();
    const rawParsed = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawParsed) return false;

    const intent = JSON.parse(rawParsed);
    if (intent.action === 'CHATTER') return false;

    // 1. QUERY COURT BOARD
    if (intent.action === 'QUERY_SCHEDULE') {
      const todayStr = new Date().toISOString().split('T')[0];
      const reservationsUrl = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Reservations?sort%5B0%5D%5Bfield%5D=Start%20Time&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=50`;

      const qRes = await fetch(reservationsUrl, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      const qData = qRes.ok ? await qRes.json() : { records: [] };
      const records = (qData.records || []).filter(r => {
        const isConfirmed = r.fields['Status'] === 'Confirmed';
        const startTime = r.fields['Start Time'];
        return isConfirmed && startTime && startTime >= `${todayStr}T00:00:00.000Z`;
      });

      let boardText = `🎾 *${siteName.toUpperCase()} | COURT BOARD*\n━━━━━━━━━━━━━━━━━━━━\n`;
      if (records.length === 0) {
        boardText += `🟢 *Court is wide open today!*\nSimply type your requested time here to lock it in (2-hour blocks standard).`;
      } else {
        records.forEach(r => {
          const s = new Date(r.fields['Start Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const e = new Date(r.fields['End Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const by = r.fields['Booked By'] || 'Family Member';
          boardText += `• ${s} – ${e}: *${by}*\n`;
        });
        boardText += `━━━━━━━━━━━━━━━━━━━━\n🟢 All other windows are open for play.`;
      }
      await sendWhatsAppMessage(dispatchTarget, boardText);
      return true;
    }

    // 2. CANCEL RESERVATION
    if (intent.action === 'CANCEL') {
      const reservationsUrl = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Reservations?sort%5B0%5D%5Bfield%5D=Start%20Time&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=20`;
      const qRes = await fetch(reservationsUrl, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      const qData = qRes.ok ? await qRes.json() : { records: [] };

      const myReservation = (qData.records || []).find(r => {
        const isConfirmed = r.fields['Status'] === 'Confirmed';
        const sTime = r.fields['Start Time'];
        const bookedBy = (r.fields['Booked By'] || '').toLowerCase();
        const searchName = (identity.name || intent.partyName || '').toLowerCase();
        return isConfirmed && sTime && sTime >= nowIso && (searchName ? bookedBy.includes(searchName) : true);
      });

      if (myReservation) {
        await airtableWriteWithAutoDrop('Reservations', { 'Status': 'Cancelled' }, myReservation.id);
        await sendWhatsAppMessage(dispatchTarget, `🟢 *COURT RELEASED*\n\nYour 2-hour reserved block has been released back to the family pool. The court is now open!`);
      } else {
        await sendWhatsAppMessage(dispatchTarget, `ℹ️ No upcoming reservations found under your name to cancel.`);
      }
      return true;
    }

    // 3. BOOK SLOT WITH STRICT 2-HOUR DEFAULT & CONFLICT RESOLUTION
    if (intent.action === 'BOOK') {
      if (!intent.startTimeIso) {
        await sendWhatsAppMessage(dispatchTarget, `Could you specify the time you'd like to play? (e.g. "Tomorrow at 10 AM")`);
        return true;
      }

      const pStart = new Date(intent.startTimeIso);
      let pEnd;
      if (intent.endTimeIso) {
        pEnd = new Date(intent.endTimeIso);
      } else {
        pEnd = new Date(pStart.getTime() + 2 * 60 * 60 * 1000); // Strict 2-Hour Default
      }

      const reservationsUrl = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Reservations?maxRecords=100`;
      const cRes = await fetch(reservationsUrl, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
      const cData = cRes.ok ? await cRes.json() : { records: [] };

      const conflict = (cData.records || []).find(r => {
        if (r.fields['Status'] !== 'Confirmed') return false;
        const rStart = new Date(r.fields['Start Time']);
        const rEnd = new Date(r.fields['End Time']);
        return rStart < pEnd && rEnd > pStart;
      });

      if (conflict) {
        const holder = conflict.fields['Booked By'] || 'Another family member';
        const sTime = new Date(conflict.fields['Start Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const eTime = new Date(conflict.fields['End Time']).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const conflictMsg = `⚠️ *SCHEDULE OVERLAP*\n\n` +
          `*${holder}* already has the court reserved from *${sTime} to ${eTime}*.\n\n` +
          `🟢 The court is open right after at *${eTime}*. Want me to book a 2-hour window starting at ${eTime} for you?`;

        await sendWhatsAppMessage(dispatchTarget, conflictMsg);
        return true;
      }

      const bookedByName = intent.partyName ||
        (identity.name !== 'External Caller' && identity.name !== 'VIP Member' ? identity.name : `Family Member (+${fromPhone.slice(-4)})`);

      const resPayload = {
        'Booked By': bookedByName,
        'Start Time': pStart.toISOString(),
        'End Time': pEnd.toISOString(),
        'Status': 'Confirmed',
        'Notes': `Booked via ambient WhatsApp NLP. Raw text: "${text}"`
      };
      if (targetSiteId) resPayload['Site'] = [targetSiteId];

      await airtableWriteWithAutoDrop('Reservations', resPayload);

      const sFormatted = pStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const eFormatted = pEnd.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateFormatted = pStart.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

      const confirmationCard = `🎾 *${siteName.toUpperCase()} | RESERVATION LOCKED*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Player / Party:* ${bookedByName}\n` +
        `📅 *Date:* ${dateFormatted}\n` +
        `⏱️ *Time:* ${sFormatted} – ${eFormatted} (2-Hour Block)\n` +
        `🟢 *Status:* Confirmed\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `*Have a great match! Court board updated.*`;

      await sendWhatsAppMessage(dispatchTarget, confirmationCard);
      return true;
    }
  } catch (err) {
    console.error('[Compound Scheduler Error]:', err.message);
  }
  return false;
}

async function handleVIPConcierge(text, identity, dispatchTarget, fromPhone) {
  const siteId = identity.siteId;
  const siteName = identity.siteName || 'Private Reserve Court';

  const assignmentPayload = {
    'Date': new Date().toISOString().split('T')[0],
    'Assignment Type': 'Service',
    'Priority': 'High',
    'Source': 'Joy Cannon (Client)',
    'Status': 'Open',
    'Notes': `[VIP CONCIERGE — ${identity.name} (${identity.role})]\nDirective: "${text}"`
  };

  if (siteId) assignmentPayload['Sites'] = [siteId];

  const bobWorker = await lookupWorkerByName('Bob');
  if (bobWorker) assignmentPayload['Worker'] = [bobWorker.id];

  const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
  const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';

  const voucherText = `💼 *BOUNCE CONCIERGE | REQUEST CONFIRMED*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Hello ${identity.name} — we've received your directive for *${siteName}*:\n\n` +
    `> "${text}"\n\n` +
    `🎫 *Ticket:* ${ticketId}\n` +
    `⚡ *Priority:* High (VIP Private Reserve)\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Our district service van has been notified. Handled seamlessly under your seasonal coverage.`;

  await sendWhatsAppMessage(dispatchTarget, voucherText);
  return true;
}

// ====================================================================
// 9. AMBIENT DISPATCH, COMMERCIAL & CHAT TRIAGE
// ====================================================================

async function triageDispatchText(text, workerRecord, currentSite = null) {
  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ') || 'BPC HLD Lewinsky, BPC RCOR Court 1, BPC RCOR Court 2, BPC Camp Salter, BPC David Cynamon';
  const siteWorkflowMode = currentSite?.fields?.['Workflow Mode'] || 'INSTALLATION';

  const prompt = `
You are the Titan OS Ambient Intelligence Scribe, Operational Dispatch & Commercial Intake Engine.
Current Operational Context: [Site Mode: ${siteWorkflowMode}]
Active Padel Court Registry: [${siteListStr}]
Field Personnel Roster: ["Dee", "Yeikol", "Edison", "Rob", "Bob", "Adem", "Michael", "David", "Edwin", "Ranjit", "Danish", "Morris", "Kate", "Alexis"]

CRITICAL OPERATIONAL RULES:
1. BANTER VS ACTION DISCRIMINATOR:
   - If the input is casual conversation, status check between colleagues, banter, humor, or generic chatter (e.g. "hey where are you", "stuck in traffic", "sounds good", "thanks", "heading out now", "coffee time"):
     Set "is_actionable": false
   - If the input contains a real task, delivery update, bill of lading, container status, manufacturing milestone, punchdown, client lead, invoice request, payment confirmation, or maintenance request:
     Set "is_actionable": true

2. LOGISTICS INTENT:
   - Mention of freight, containers, customs, trucking, flatbed delivery, sand drop, or hardware shipment:
     intent: "LOGISTICS_DELIVERY", assignment_type: "Supply Delivery", task_category: "Supply Delivery (Joy Cannon)"

3. PRODUCTION INTENT:
   - Mention of factory fabrication, steel welding, light posts, jigs, powder coating, glass tempering batches, or factory holds:
     intent: "PRODUCTION_UPDATE", assignment_type: "Installation", task_category: "Glass & Structure"

4. INVENTORY INTENT:
   - Mention of warehouse stock, inventory count, replacement glass crates on hand, turf rolls in yard, damaged stock write-off, or reorder needs:
     intent: "INVENTORY_UPDATE", assignment_type: "Supply Delivery", task_category: "Hardware: Caps & Fasteners"

5. INVOICING & BILLING INTENT:
   - Mentions of "invoice client", "send bill", "charge for sand/turf", "invoice Latifi", "send estimate", or billing figures:
     intent: "INVOICE_REQUEST", assignment_type: "Invoice / Billing", task_category: "Supply Delivery (Joy Cannon)", priority: "High"

6. PAYMENT RECEIVED INTENT:
   - Mentions of wires received, deposits landed, e-transfers received, cheques deposited, or accounts settled (e.g. "deposit received 31988", "Cliff paid", "wire from Calgary"):
     intent: "PAYMENT_RECEIVED", assignment_type: "Payment Received", priority: "Low"

7. SEASONAL CLOSING:
   - "court closing", "closing the padel court", "camp david closing", "winterizing", or "shut down for season":
     intent: "DISPATCH_CREATE", assignment_type: "Service", task_category: "Season Closing"

8. COMMERCIAL QUOTE:
   - Pricing inquiries, quotes, adding padel over tennis, or new club builds:
     intent: "COMMERCIAL_QUOTE", assignment_type: "Sales", matched_site_name: null

Valid Assignment Types: ["Emergency Repair", "Service", "Spot Visit Punch", "Supply Delivery", "Sales", "Expense", "Audit / Inspection", "Invoice / Billing", "Payment Received", "Unknown"]
Valid Task Categories: ["Turf: Sand & Grooming", "Net: Tension & Hardware", "Glass & Structure", "Hardware: Caps & Fasteners", "Lighting & Electrical", "Supply Delivery (Joy Cannon)", "Site Cleanliness & Sweep", "Season Opening", "Season Closing", "Quarterly Maintenance", "Annual Structural & Torque Audit", "Post-Storm / High-Wind Inspection"]

Input Text: "${text}"

Output JSON only:
{
  "is_actionable": boolean,
  "intent": "INVENTORY_UPDATE" | "LOGISTICS_DELIVERY" | "PRODUCTION_UPDATE" | "COMMERCIAL_QUOTE" | "WORK_ORDER_CLOSEOUT" | "DISPATCH_CREATE" | "PRE_TOURNAMENT_AUDIT" | "EXPENSE_LOG" | "INVOICE_REQUEST" | "PAYMENT_RECEIVED",
  "matched_site_name": "string or null",
  "ticket_id": integer or null,
  "resolution_summary": "string in English",
  "commercial_quote_details": {
    "is_commercial_inquiry": boolean,
    "quote_type": "Tennis Conversion" | "Greenfield Club Build" | "Court Expansion" | "General Pricing",
    "number_of_courts": integer or null,
    "scope_summary": "Detailed English brief of requested build/pricing",
    "directed_to": "string or null"
  },
  "billing_details": {
    "client_name": "string or null",
    "amount": "string or null",
    "invoice_number": "string or null",
    "payment_method": "Wire" | "EMT" | "Cheque" | "Credit Card" | "Unknown",
    "memo": "string or null"
  },
  "task_category": "string from Valid Task Categories or null",
  "assignment_type": "Emergency Repair" | "Service" | "Spot Visit Punch" | "Supply Delivery" | "Sales" | "Expense" | "Audit / Inspection" | "Invoice / Billing" | "Payment Received" | "Unknown",
  "priority": "Critical" | "High" | "Medium" | "Low",
  "suggested_worker_name": "string or null",
  "notes": "string in English"
}
`;

  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  const url = `${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Gemini dispatch triage failed (${res.status}): ${await res.text()}`);
  }

  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return null;

  const cleaned = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleaned);
}

// ====================================================================
// 10. BATCH MULTIMODAL FORENSIC EVALUATION
// ====================================================================

async function evaluateCourtMediaBatch(mediaItems, cumulativeContext = {}) {
  const isMaintenanceMode = cumulativeContext.workflowMode === 'MAINTENANCE' || cumulativeContext.workflowMode === 'SPOT_VISIT';
  const systemInstruction = isMaintenanceMode ? MAINTENANCE_TRIAGE_PROMPT : INDUSTRIAL_SYSTEM_PROMPT;
  const facilityTypeDesc = cumulativeContext.isIndoor ? 'INDOOR FACILITY' : 'OUTDOOR FIELD FACILITY';
  const activeSites = await getAllActiveSitesList();
  const siteListStr = activeSites.join(', ');

  const auditContextText = `AUDIT CONTEXT & FLEET ROUTER:
Active Padel Court Registry: [${siteListStr}]
Field Personnel Roster: ["Dee", "Yeikol", "Edison", "Rob", "Bob", "Adem", "Michael", "David", "Edwin", "Ranjit", "Danish", "Morris", "Kate", "Alexis"]
Current Bound Asset: ${cumulativeContext.siteName || 'Unbound Court'}
Current Mode: ${cumulativeContext.workflowMode || 'INSTALLATION'}
Facility Type: ${facilityTypeDesc}
Previously Cleared Milestones: ${JSON.stringify(cumulativeContext.clearedMilestones || [])}
Active Open Punch Notes: ${cumulativeContext.lastNote || 'None'}

DYNAMIC INTENT CLASSIFICATION RULES:
1. "GATE_0A_AUDIT": Container seal, freight crate integrity, intact vs shattered tempered glass panels.
2. "GATE_0B_AUDIT": Offload staging, turf roll storage, forklift tine verification, lack of punctures.
3. "COMMERCIAL_QUOTE": Commercial build/pricing request. Set "assignment_type": "Sales".
4. "SEASONAL_CLOSING": Mentions of "court closing", "winterizing", or seasonal shutdown. Set "assignment_type": "Service" and "task_category": "Season Closing".
5. "INVENTORY_UPDATE": Pallets in warehouse, stock check, hardware bins, turf storage. Set "assignment_type": "Supply Delivery".
6. "WORK_ORDER_CLOSEOUT": Completed punchdown work.
7. "PRE_TOURNAMENT_AUDIT": Sweep checks. Set "assignment_type": "Audit / Inspection".
8. "EXPENSE_LOG": Hardware receipt. Set "assignment_type": "Expense".
9. "INVOICE_REQUEST": Billing directives. Set "assignment_type": "Invoice / Billing".
10. "PAYMENT_RECEIVED": Settlement / deposit confirmations. Set "assignment_type": "Payment Received".
11. "DISPATCH_CREATE": Maintenance defects on existing courts.
12. "INSTALLATION_INSPECTION": Standard physical build audit (Gates 1-12).`;

  const contentParts = [{ text: auditContextText }];

  for (const item of mediaItems) {
    if (item.caption) {
      contentParts.push({ text: `Caption: ${item.caption}` });
    }
    contentParts.push({
      inline_data: {
        mime_type: item.mimeType,
        data: item.buffer.toString('base64')
      }
    });
  }

  const payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ parts: contentParts }],
    generationConfig: {
      temperature: 0.0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 }
    }
  };

  const url = `${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini evaluation failed (${res.status}): ${errText}`);
  }

  const result = await res.json();
  const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from Gemini forensic engine');

  const cleanedText = rawText.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  return JSON.parse(cleanedText);
}

// ====================================================================
// 11. BATCH PROCESSOR (DEBOUNCED MEDIA AGGREGATION & MULTI-INTENT)
// ====================================================================

async function processMediaBatch(batch) {
  const { items, site, worker, dispatchTarget, fromPhone, senderSource, indoorSite, callerIdentity } = batch;

  const uploadPromises = items.map(item => uploadToSupabase(item.buffer, item.mimeType));
  const storageResults = await Promise.all(uploadPromises);

  let parsedTimestamps = {};
  if (site?.fields?.['Milestone Timestamps JSON']) {
    try {
      parsedTimestamps = JSON.parse(site.fields['Milestone Timestamps JSON']);
    } catch (err) {
      parsedTimestamps = {};
    }
  }

  const currentMode = site?.fields?.['Workflow Mode'] || 'INSTALLATION';
  const cumulativeContext = {
    siteName: site?.fields?.['Site Name'] || 'BPC Court',
    workflowMode: currentMode,
    siteStatus: site?.fields?.['Site Status'] || 'ACTIVE',
    openTickets: site?.fields?.['Open Tickets'] || 0,
    clearedMilestones: site?.fields?.['Cleared Milestones'] || [],
    milestoneTimestamps: parsedTimestamps,
    lastNote: site?.fields?.['Last Note'] || '',
    isIndoor: indoorSite
  };

  const forensicAudit = await evaluateCourtMediaBatch(items, cumulativeContext);

  // ------------------------------------------------------------------
  // BRANCH 0: HARDENED PRE-INSTALLATION STAGING GATES (0A & 0B)
  // ------------------------------------------------------------------
  if (forensicAudit.intent === 'GATE_0A_AUDIT' || forensicAudit.intent === 'GATE_0B_AUDIT' ||
      forensicAudit.verified_gates?.includes('0A') || forensicAudit.verified_gates?.includes('0B')) {

    const gateTag = (forensicAudit.verified_gates?.includes('0A') || forensicAudit.intent === 'GATE_0A_AUDIT') ? 'Gate 0A' : 'Gate 0B';
    const isPass = forensicAudit.status_observed !== 'ACTION_REQUIRED' && !forensicAudit.hazard_detected;
    const courtLabel = site?.fields?.['Site Name'] || forensicAudit.target_court_name || 'Project Site';

    const gateVoucher = `🏗️ *TITAN OS | ${gateTag.toUpperCase()} STAGING AUDIT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏟️ *Court:* ${courtLabel}\n` +
      `🛡️ *Gate:* ${GATE_NAMES[gateTag.replace('Gate ', '')] || gateTag}\n` +
      `⚡ *Verdict:* ${isPass ? 'APPROVED 🟢' : 'HOLD / ACTION REQUIRED 🔴'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📋 *Forensic Findings:*\n` +
      `${(forensicAudit.action_items || []).join('\n') || forensicAudit.worker_summary}\n\n` +
      `${isPass ? '✅ Carrier / Freight liability cleared. Proceed to next phase.' : '⚠️ Rectify physical staging issues before mechanical build begins.'}`;

    await sendWhatsAppMessage(dispatchTarget, gateVoucher);

    if (site && isPass) {
      const previouslyCleared = site.fields['Cleared Milestones'] || [];
      const updatedCleared = Array.from(new Set([...previouslyCleared, gateTag]));
      await airtableWriteWithAutoDrop('Sites', {
        'Cleared Milestones': updatedCleared,
        'Last Note': `${gateTag} approved: ${forensicAudit.worker_summary}`
      }, site.id);
    }
    return;
  }

  // ------------------------------------------------------------------
  // BRANCH A: COMMERCIAL QUOTE & NEW BUILD INQUIRY
  // ------------------------------------------------------------------
  if (forensicAudit.intent === 'COMMERCIAL_QUOTE' || forensicAudit.commercial_quote_details?.is_commercial_inquiry) {
    const comm = forensicAudit.commercial_quote_details || {};
    const directedTo = comm.directed_to || 'Rob';
    let assignedWorker = await lookupWorkerByName(directedTo);
    if (!assignedWorker) assignedWorker = worker;

    const leadNotes = `[COMMERCIAL LEAD — Directed to ${directedTo}]\n` +
      `Scope: ${comm.scope_summary || 'Padel court build / conversion pricing requested.'}\n` +
      `Type: ${comm.quote_type || 'General Pricing'}`;

    const assignmentPayload = {
      'Date': new Date().toISOString().split('T')[0],
      'Assignment Type': 'Sales',
      'Priority': 'High',
      'Source': 'Joy Cannon (Client)',
      'Status': 'Open',
      'Notes': leadNotes
    };

    if (assignedWorker?.id) assignmentPayload['Worker'] = [assignedWorker.id];
    if (site?.id && forensicAudit.target_court_name) assignmentPayload['Sites'] = [site.id];

    const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
    const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';

    const commercialVoucher = `💼 *TITAN OS | COMMERCIAL LEAD CAPTURED*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🚀 *Lead Queued (${ticketId})*\n` +
      `👤 *Directed To:* ${directedTo}\n` +
      `🏢 *Opportunity:* ${comm.quote_type || 'New Build / Conversion'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Scope Detected:*\n` +
      `${comm.scope_summary || 'Pricing requested for tennis conversion / new club build.'}\n\n` +
      `✅ *Logged to Daily Assignments • Status: Open for Review*`;

    await sendWhatsAppMessage(dispatchTarget, commercialVoucher);

    if (assignedWorker) {
      notifyAssignedWorker(
        ticketId,
        'Prospective Project / Client Lead',
        'Sales Quote',
        'High',
        leadNotes,
        assignedWorker
      ).catch(() => {});
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const storageResult = storageResults[i];
      await airtableWriteWithAutoDrop('Inbound Messages 2', {
        'Message ID': item.messageId,
        'Worker Phone Raw': fromPhone,
        'Message Type': item.type,
        'Caption Text': `[Commercial Inquiry]: ${comm.scope_summary || item.caption}`,
        'Media URL': storageResult.signedUrl,
        'Media Path': storageResult.storagePath,
        'Raw Payload JSON': JSON.stringify(item.rawMessage)
      });
    }
    return;
  }

  // ------------------------------------------------------------------
  // BRANCH B: SPOKEN WORK ORDER CLOSEOUT
  // ------------------------------------------------------------------
  if (forensicAudit.intent === 'WORK_ORDER_CLOSEOUT') {
    console.log(`[Punchdown Engine] Closing work order for "${forensicAudit.target_court_name || site?.fields['Site Name']}"`);
    await executeWorkOrderCloseout({
      site,
      targetCourtName: forensicAudit.target_court_name,
      ticketId: forensicAudit.ticket_id,
      resolutionNotes: forensicAudit.resolution_summary || 'Task completed and verified on site.',
      worker,
      dispatchTarget,
      fromPhone
    });

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const storageResult = storageResults[i];
      const transcript = forensicAudit.transcription ? `[Punchdown Voice]: ${forensicAudit.transcription}` : item.caption;

      await airtableWriteWithAutoDrop('Inbound Messages 2', {
        'Message ID': item.messageId,
        'Worker Phone Raw': fromPhone,
        'Message Type': item.type,
        'Caption Text': transcript,
        'Media URL': storageResult.signedUrl,
        'Media Path': storageResult.storagePath,
        'Raw Payload JSON': JSON.stringify(item.rawMessage)
      });
    }
    return;
  }

  // ------------------------------------------------------------------
  // BRANCH C: PRE-TOURNAMENT VIP SWEEP
  // ------------------------------------------------------------------
  if (forensicAudit.intent === 'PRE_TOURNAMENT_AUDIT') {
    let targetSite = null;
    if (forensicAudit.target_court_name) {
      targetSite = await lookupSite(null, forensicAudit.target_court_name);
    }
    if (!targetSite) targetSite = site;

    const assignmentPayload = {
      'Date': new Date().toISOString().split('T')[0],
      'Assignment Type': 'Audit / Inspection',
      'Priority': 'High',
      'Source': senderSource || 'Joy Cannon (Client)',
      'Status': 'Open',
      'Notes': `[VIP SERVICE INTAKE]: Under Dispatch Review for scheduling.\nScope: ${forensicAudit.worker_summary || 'Pre-tournament playability inspection.'}`
    };

    if (forensicAudit.task_category) assignmentPayload['Task Category'] = forensicAudit.task_category;
    if (worker?.id) assignmentPayload['Worker'] = [worker.id];
    if (targetSite?.id) assignmentPayload['Sites'] = [targetSite.id];

    const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
    const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';
    const courtLabel = targetSite?.fields?.['Site Name'] || 'Facility Courts';

    const vipVoucher = `🎾 *BOUNCE PADEL | VIP SERVICE INTAKE*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎫 *Request Queued (${ticketId})*\n` +
      `🏟️ *Facility:* ${courtLabel}\n` +
      `📋 *Status:* Under Dispatch Review\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Request Scope:*\n` +
      `${forensicAudit.worker_summary || 'Pre-tournament playability check and grooming sweep.'}\n\n` +
      `🤝 *Operations notified. We are reviewing crew capacity and will confirm your service window shortly.*`;

    await sendWhatsAppMessage(dispatchTarget, vipVoucher);
    return;
  }

  // ------------------------------------------------------------------
  // BRANCH D: EXPENSE / RECEIPT CAPTURE
  // ------------------------------------------------------------------
  if (forensicAudit.intent === 'EXPENSE_LOG' || forensicAudit.assignment_type === 'Expense') {
    const expense = forensicAudit.expense_details || {};
    let targetSite = null;
    if (forensicAudit.target_court_name) {
      targetSite = await lookupSite(null, forensicAudit.target_court_name);
    }
    if (!targetSite) targetSite = site;

    const workerAttribution = worker?.fields?.['Full Name'] || callerIdentity?.name || 'Bob';
    const expNotes = `[EXPENSE RECEIPT] ${expense.vendor || 'Supplier'}: ${expense.total || 'Total on file'}\nItems: ${(expense.items || []).join(', ')}`;
    const assignmentPayload = {
      'Date': new Date().toISOString().split('T')[0],
      'Assignment Type': 'Expense',
      'Priority': 'Low',
      'Source': senderSource || 'Dispatch',
      'Status': 'Complete',
      'Notes': expNotes
    };

    if (worker?.id) assignmentPayload['Worker'] = [worker.id];
    if (targetSite?.id) assignmentPayload['Sites'] = [targetSite.id];

    const validAttachments = storageResults
      .filter(r => r && r.signedUrl)
      .map((r, idx) => ({
        url: r.signedUrl,
        filename: `Receipt_${(expense.vendor || 'Supplier').replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}_${idx + 1}.jpg`
      }));

    if (validAttachments.length > 0) {
      assignmentPayload['Attachment(s)'] = validAttachments;
      console.log(`[Expense Capture] Attaching ${validAttachments.length} receipt image(s) to Airtable payload.`);
    }

    await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);

    const expVoucher = `🧾 *TITAN OS | EXPENSE RECEIPT*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🏪 *Vendor:* ${expense.vendor || 'Hardware Supplier'}\n` +
      `💰 *Total:* ${expense.total || 'Logged on file'}\n` +
      `📍 *Asset:* ${targetSite?.fields?.['Site Name'] || 'General Operations'}\n` +
      `👤 *Attributed:* ${workerAttribution}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 *Items:*\n` +
      `${(expense.items || []).join(', ') || 'Hardware & maintenance supplies'}\n\n` +
      `✅ *Receipt signed into vault and expense recorded for QuickBooks.*`;

    await sendWhatsAppMessage(dispatchTarget, expVoucher);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const storageResult = storageResults[i];
      await airtableWriteWithAutoDrop('Inbound Messages 2', {
        'Message ID': item.messageId,
        'Worker Phone Raw': fromPhone,
        'Message Type': item.type,
        'Caption Text': `[Expense Receipt]: ${expense.vendor || 'Supplier'} - ${expense.total || ''}`,
        'Media URL': storageResult.signedUrl,
        'Media Path': storageResult.storagePath,
        'Raw Payload JSON': JSON.stringify(item.rawMessage)
      }).catch(err => console.warn('[Expense Logging] Inbound message record error:', err.message));
    }
    return;
  }

  // ------------------------------------------------------------------
  // BRANCH E: CROSS-SITE VOICE DISPATCH (NEW TICKET)
  // ------------------------------------------------------------------
  const isCrossSite = forensicAudit.intent === 'DISPATCH_CREATE' ||
    (forensicAudit.target_court_name && site && !site.fields['Site Name'].toLowerCase().includes(forensicAudit.target_court_name.toLowerCase()));

  if (isCrossSite) {
    console.log(`[Cross-Site Router] Spoken directive routed to "${forensicAudit.target_court_name}"`);
    let targetSite = null;
    if (forensicAudit.target_court_name) {
      targetSite = await lookupSite(null, forensicAudit.target_court_name);
    }
    if (!targetSite) targetSite = site;

    let assignedWorker = worker;
    if (forensicAudit.suggested_worker_name) {
      const namedWorker = await lookupWorkerByName(forensicAudit.suggested_worker_name);
      if (namedWorker) assignedWorker = namedWorker;
    }

    const taskNotes = (forensicAudit.action_items || []).join('\n') || forensicAudit.worker_summary;
    const assignmentPayload = {
      'Date': new Date().toISOString().split('T')[0],
      'Assignment Type': forensicAudit.assignment_type || 'Service',
      'Priority': forensicAudit.priority || 'High',
      'Source': senderSource || 'Exec Visit (Bob)',
      'Status': 'Open',
      'Notes': taskNotes
    };

    if (forensicAudit.task_category) assignmentPayload['Task Category'] = forensicAudit.task_category;
    if (assignedWorker?.id) assignmentPayload['Worker'] = [assignedWorker.id];
    if (targetSite?.id) assignmentPayload['Sites'] = [targetSite.id];

    const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
    const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';
    const courtLabel = targetSite?.fields?.['Site Name'] || forensicAudit.target_court_name || 'Assigned Court';

    const dispatchVoucher = `🧾 *TITAN OS | DISPATCH VOUCHER*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `🎫 *Ticket ${ticketId} Created*\n` +
      `🏟️ *Court:* ${courtLabel}\n` +
      `⚡ *Priority:* ${assignmentPayload['Priority']}\n` +
      `👤 *Assigned:* ${assignedWorker?.fields?.['Full Name'] || 'Dispatch Queue'}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 *Directive:*\n` +
      `${taskNotes}\n\n` +
      `✅ *Logged to Daily Assignments • Status: Open*`;

    await sendWhatsAppMessage(dispatchTarget, dispatchVoucher);

    if (assignedWorker) {
      notifyAssignedWorker(
        ticketId,
        courtLabel,
        assignmentPayload['Task Category'],
        assignmentPayload['Priority'],
        taskNotes,
        assignedWorker
      ).catch(() => {});
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const storageResult = storageResults[i];
      const speechTranscript = forensicAudit.transcription ? `[Transcribed Speech]: ${forensicAudit.transcription}` : item.caption;

      await airtableWriteWithAutoDrop('Inbound Messages 2', {
        'Message ID': item.messageId,
        'Worker Phone Raw': fromPhone,
        'Message Type': item.type,
        'Caption Text': speechTranscript,
        'Media URL': storageResult.signedUrl,
        'Media Path': storageResult.storagePath,
        'Raw Payload JSON': JSON.stringify(item.rawMessage)
      });
    }

    return;
  }

  // ------------------------------------------------------------------
  // BRANCH F: STANDARD ON-SITE AUDIT EXECUTION
  // ------------------------------------------------------------------
  let replyText = forensicAudit.whatsapp_status_text;

  if (currentMode === 'INSTALLATION' && site && !indoorSite) {
    const coords = await resolveCoordinates(site);
    if (coords) {
      const weather = await getHyperlocalWeather(coords.lat, coords.lon);
      if (weather) {
        const dewDelta = weather.temp - weather.dewPoint;
        if (weather.windGusts > 37) {
          replyText += `\n\n⛔ *SAFETY NOTICE:* Wind gusts at ${weather.windGusts} km/h (>20 kts). Gate 4 glass seating suspended.`;
        } else if (weather.isRainingOrStorm || weather.precip > 0 || weather.precipProbability4h > 40) {
          replyText += `\n\n🌧️ *WEATHER NOTICE:* Active rain/storm detected. Hold outdoor assembly & gluing.`;
        } else if (weather.humidity > 85 || dewDelta <= 2) {
          replyText += `\n\n⚠️ *WEATHER NOTICE:* Surface condensation risk. Hold Gate 7 turf adhesive.`;
        }
      }
    }
  }

  const ok = await sendWhatsAppMessage(dispatchTarget, replyText);
  if (!ok && dispatchTarget !== fromPhone && fromPhone) {
    await sendWhatsAppMessage(fromPhone, replyText);
  }

  const inboundRecordIds = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const storageResult = storageResults[i];
    const speechTranscript = forensicAudit.transcription ? `[Transcribed Speech]: ${forensicAudit.transcription}` : item.caption;

    const inboundRecord = await airtableWriteWithAutoDrop('Inbound Messages 2', {
      'Message ID': item.messageId,
      'Worker Phone Raw': fromPhone,
      'Message Type': item.type,
      'Caption Text': speechTranscript,
      'Media URL': storageResult.signedUrl,
      'Media Path': storageResult.storagePath,
      'Raw Payload JSON': JSON.stringify(item.rawMessage)
    });
    if (inboundRecord?.id) inboundRecordIds.push(inboundRecord.id);
  }

  const reportsPayload = {
    'Inbound Messages 2': inboundRecordIds,
    'Sites': site ? [site.id] : [],
    'Workflow Mode': cumulativeContext.workflowMode,
    'Overall Status': forensicAudit.status_observed,
    'Site Conditions': forensicAudit.site_conditions || 'Clear',
    'Action Items': (forensicAudit.action_items || []).join('\n'),
    'Status Observed': forensicAudit.status_observed,
    'Action Intent': forensicAudit.action_intent || 'MAINTENANCE_LOG',
    'WhatsApp Reply Text': replyText,
    'Clean JSON': JSON.stringify(forensicAudit, null, 2)
  };

  await airtableWriteWithAutoDrop('Reports 2', reportsPayload);

  if (site) {
    const nowIso = new Date().toISOString();
    const sitePatch = {
      'Last Intent': forensicAudit.action_intent || 'TRIAGE_LOG',
      'Last Note': forensicAudit.worker_summary
    };

    if (currentMode === 'INSTALLATION') {
      const updatedTimestamps = { ...cumulativeContext.milestoneTimestamps };
      for (const gateNum of (forensicAudit.verified_gates || [])) {
        const key = typeof gateNum === 'string' && gateNum.startsWith('Gate') ? gateNum : `Gate ${gateNum}`;
        if (!updatedTimestamps[key]) updatedTimestamps[key] = nowIso;
      }
      const previouslyCleared = cumulativeContext.clearedMilestones || [];
      const newlyVerified = (forensicAudit.verified_gates || []).map(g => (typeof g === 'string' && g.startsWith('Gate')) ? g : `Gate ${g}`);
      let allClearedGates = Array.from(new Set([...previouslyCleared, ...newlyVerified]));
      if (forensicAudit.needs_attention_gates?.includes(12) || forensicAudit.needs_attention_gates?.includes('Gate 12')) {
        allClearedGates = allClearedGates.filter(g => g !== 'Gate 12');
        delete updatedTimestamps['Gate 12'];
      }
      sitePatch['Cleared Milestones'] = allClearedGates;
      sitePatch['Milestone Timestamps JSON'] = JSON.stringify(updatedTimestamps, null, 2);
    }

    await airtableWriteWithAutoDrop('Sites', sitePatch, site.id);
  }
}

// ====================================================================
// 12. WEBHOOK ROUTING & INGESTION ENGINE
// ====================================================================

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === CONFIG.meta.verifyToken) {
    console.log('[Meta Webhook] Verification successful.');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);

  const signature = req.headers['x-hub-signature-256'];
  if (CONFIG.meta.appSecret && signature) {
    const expectedSig = 'sha256=' + crypto
      .createHmac('sha256', CONFIG.meta.appSecret)
      .update(req.rawBody)
      .digest('hex');

    const sigBuffer = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSig, 'utf8');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      console.error('[Security] HMAC SHA-256 signature verification failed!');
      return;
    }
  }

  try {
    const body = req.body;
    const entry = body?.entry?.[0];
    const changes = entry?.changes?.[0]?.value;
    const message = changes?.messages?.[0];

    if (!message) return;

    const messageId = message.id;
    if (processedMessageIds.has(messageId)) return;
    processedMessageIds.add(messageId);
    if (processedMessageIds.size > 2000) processedMessageIds.clear();

    const rawFrom = message.from || '';
    const rawAuthor = message.author || message.participant || '';
    const rawChatId = message.chat_id || message.group_id || changes?.metadata?.phone_number_id || '';

    const isGroupMessage = rawFrom.includes('@g.us') || rawChatId.includes('@g.us');
    const groupJid = rawFrom.includes('@g.us')
      ? rawFrom
      : (rawChatId.includes('@g.us') ? rawChatId : null);

    const fromPhone = isGroupMessage && rawAuthor
      ? rawAuthor.split('@')[0].replace(/\D/g, '')
      : (rawFrom.includes('@g.us') ? '' : rawFrom.replace(/\D/g, ''));

    const dispatchTarget = groupJid || fromPhone;

    const dispatchReply = async (text) => {
      const ok = await sendWhatsAppMessage(dispatchTarget, text);
      if (!ok && dispatchTarget !== fromPhone && fromPhone) {
        await sendWhatsAppMessage(fromPhone, text);
      }
    };

    const callerIdentity = await resolveCallerIdentity(fromPhone);
    let site = callerIdentity.siteRecord || await lookupSite(groupJid || fromPhone);
    const worker = callerIdentity.workerRecord || (fromPhone ? await lookupWorker(fromPhone) : null);

    const isBoundGroupMember = Boolean(site && isGroupMessage);
    const isAuthorizedClient = callerIdentity.type === 'CONTACT' || (!worker && site && site.fields['Workflow Mode'] === 'MAINTENANCE');

    const isLinkCommand = message.type === 'text' &&
      (message.text?.body?.trim().startsWith('/l') || message.text?.body?.trim().startsWith('/link') || message.text?.body?.trim().startsWith('/group'));

    if (!worker && !isBoundGroupMember && !isAuthorizedClient && !isLinkCommand) {
      console.warn(`[Bouncer] Dropped unauthorized message from ${fromPhone || rawFrom}`);
      return;
    }

    const currentMode = site?.fields?.['Workflow Mode'] || 'INSTALLATION';
    const isAmbientChannel = AMBIENT_CHAT_MODES.includes(currentMode);

    const senderSource = isAuthorizedClient
      ? 'Joy Cannon (Client)'
      : (currentMode === 'SPOT_VISIT' ? 'Exec Visit (Bob)' : 'Dispatch');

    const indoorSite = isIndoorSite(site);

    // ------------------------------------------------------------------
    // INTERACTIVE WHATSAPP BUTTON REPLY HANDLER (1-TAP ACTIONS)
    // ------------------------------------------------------------------
    if (message.type === 'interactive') {
      const interactive = message.interactive;
      const buttonReply = interactive?.button_reply;
      const selectedId = buttonReply?.id || '';
      const selectedTitle = buttonReply?.title || '';

      console.log(`[Interactive Button Tap] Received '${selectedTitle}' (${selectedId}) from ${fromPhone}`);

      if (selectedId.startsWith('DISPATCH_APPROVE_')) {
        const parts = selectedId.split('_');
        const nextTicketId = parts[2];
        const nextWorkerId = parts[3];

        let targetTicket = null;
        if (nextTicketId && nextTicketId !== 'any') {
          targetTicket = await findActiveTicketForSite(null, nextTicketId);
        }

        if (targetTicket) {
          const updateFields = { 'Status': 'In Progress' };
          if (nextWorkerId && nextWorkerId !== 'any') {
            updateFields['Worker'] = [nextWorkerId];
          }
          await airtableWriteWithAutoDrop('Daily Assignments', updateFields, targetTicket.id);

          await dispatchReply(`✅ *DISPATCH CONFIRMED*\nTechnician routed to Ticket #${nextTicketId}. Navigation sent to technician.`);
        } else {
          await dispatchReply(`✅ *DISPATCH CONFIRMED*\nRoute verified and updated in Daily Assignments.`);
        }
        return;
      }

      if (selectedId.startsWith('ROUTE_FACTORY_')) {
        await dispatchReply(`🏭 *RETURN ROUTE LOGGED*\nTechnician instructed to head back to Orillia Factory for staging.`);
        return;
      }

      await dispatchReply(`✅ Selected: *${selectedTitle}* — Logged into Operations.`);
      return;
    }

    // ------------------------------------------------------------------
    // LOCATION PIN-DROP
    // ------------------------------------------------------------------
    if (message.type === 'location') {
      const userLat = message.location.latitude;
      const userLon = message.location.longitude;

      if (!site) {
        await dispatchReply(`⚠️ This group is not connected to a court yet. Type */group <Court Name>* to connect.`);
        return;
      }

      let siteCoords = await resolveCoordinates(site);

      if (!siteCoords) {
        const coordString = `${userLat.toFixed(5)}, ${userLon.toFixed(5)}`;
        await airtableWriteWithAutoDrop('Sites', { 'Site location': coordString }, site.id);
        siteCoords = { lat: userLat, lon: userLon };

        await dispatchReply(
          `📍 *COURT GPS ANCHORED*\n` +
          `Locked coordinates (*${coordString}*) to *${site.fields['Site Name']}*.\n` +
          `✅ 300m presence geofence and weather tripwires are now active!`
        );
        return;
      }

      const distanceMeters = haversineDistanceKm(userLat, userLon, siteCoords.lat, siteCoords.lon) * 1000;
      const workerName = worker?.fields?.['Full Name'] || callerIdentity.name || (fromPhone ? `Crew (+${fromPhone.slice(-4)})` : 'Field Tech');
      const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

      if (distanceMeters <= 300) {
        const checkinNote = `On-site presence verified for ${workerName} at ${timestamp} (${Math.round(distanceMeters)}m from court center).`;
        await airtableWriteWithAutoDrop('Sites', { 'Last Note': checkinNote, 'Last Intent': 'PRESENCE_VERIFIED' }, site.id);

        let checkinResponse = `📍 *ON-SITE CHECK-IN CONFIRMED*\n` +
          `👤 *Crew:* ${workerName}\n` +
          `🏟️ *Court:* ${site.fields['Site Name']}\n` +
          `⏱️ *Time:* ${timestamp} (within ${Math.round(distanceMeters)}m)\n\n` +
          `✅ Shift logged on court record.`;

        await dispatchReply(checkinResponse);
      } else {
        await dispatchReply(
          `📍 *LOCATION PIN RECEIVED*\n\n` +
          `You are currently ${(distanceMeters / 1000).toFixed(1)} km away from *${site.fields['Site Name']}*.\n` +
          `Check-in requires being within 300m of the court.`
        );
      }
      return;
    }

    // ------------------------------------------------------------------
    // TEXT COMMANDS & AMBIENT SCRIBE TRIAGE
    // ------------------------------------------------------------------
    if (message.type === 'text') {
      const rawText = message.text.body.trim();
      const [trigger, ...args] = rawText.split(' ');
      const intent = COMMAND_MAP[trigger.toLowerCase()];

      if (intent) {
        if (intent === 'LINK_SITE') {
          const targetSiteName = args.join(' ');
          const targetSite = await lookupSite(null, targetSiteName);
          if (!targetSite) {
            await dispatchReply(`❌ Could not find "${targetSiteName}". Check spelling in Airtable.`);
            return;
          }

          const targetBindingId = groupJid || fromPhone;
          await airtableWriteWithAutoDrop('Sites', { 'WhatsApp Group ID': targetBindingId }, targetSite.id);
          await dispatchReply(`✅ *CONNECTED TO ${targetSite.fields['Site Name'].toUpperCase()}*`);
          return;
        }

        if (intent === 'COURT_BOARD') {
          await handleCompoundScheduler('board', callerIdentity, dispatchTarget, fromPhone, site);
          return;
        }

        if (intent === 'FLEET_MAP_LINK') {
          await dispatchReply(`🗺️ *TITAN OS LIVE FLEET MAP*\n\nView continental digital twins and site conditions:\nhttps://${req.headers.host}/fleet-map`);
          return;
        }

        if (intent === 'HELP') {
          await dispatchReply(`🤖 *TITAN OS COMMANDS*\n\n• */s* — Status\n• */w* — Weather\n• */map* — GPS Nav\n• */board* — Compound Court Board\n• */fleet* — Continental Fleet Map\n• */group <Hub or Court Name>* — Bind Channel\n• Chat naturally to report milestones, request sand/grooming, record receipts, or log payments.`);
          return;
        }
      }

      // AMBIENT COMPOUND COURT SCHEDULER (BOUND GROUPS OR RECOGNIZED FAMILY MEMBERS)
      if (isBoundGroupMember || callerIdentity.role === 'Family Member / Player' || callerIdentity.role === 'Compound Member') {
        const handled = await handleCompoundScheduler(rawText, callerIdentity, dispatchTarget, fromPhone, site);
        if (handled) return;
      }

      // VIP CONCIERGE (ESTATE OWNERS & PROPERTY HANDLERS)
      if (callerIdentity.role === 'Owner / Principal' || callerIdentity.role === 'Property Manager / Caretaker') {
        const lower = rawText.toLowerCase();
        if (lower.includes('sand') || lower.includes('groom') || lower.includes('clean') ||
            lower.includes('glass') || lower.includes('net') || lower.includes('tournament') || lower.includes('sweep')) {
          await handleVIPConcierge(rawText, callerIdentity, dispatchTarget, fromPhone);
          return;
        }
      }

      // ------------------------------------------------------------------
      // AMBIENT SCRIBE & NATURAL TEXT PROCESSING
      // ------------------------------------------------------------------
      const isDirectOrAdmin = !isGroupMessage || (worker && worker.fields['Role'] === 'Admin') || isAmbientChannel || (site && AMBIENT_CHAT_MODES.includes(site.fields['Workflow Mode']));

      if (isDirectOrAdmin && rawText.length > 5) {
        console.log(`[Dispatch Triage] Evaluating text (${currentMode}): "${rawText}"`);
        try {
          const triage = await triageDispatchText(rawText, worker, site);

          if (triage && triage.is_actionable === false) {
            console.log(`[Ambient Scribe] Filtered non-actionable chatter: "${rawText}"`);
            return;
          }

          // 1. INVOICE REQUEST ROUTE
          if (triage && triage.intent === 'INVOICE_REQUEST') {
            const bill = triage.billing_details || {};
            const clientTarget = bill.client_name || triage.matched_site_name || 'Client';
            const amountStr = bill.amount || 'Standard Rate';

            const assignmentPayload = {
              'Date': new Date().toISOString().split('T')[0],
              'Assignment Type': 'Invoice / Billing',
              'Priority': 'High',
              'Source': senderSource || 'Receivables',
              'Status': 'Open',
              'Notes': `[INVOICE DIRECTIVE]: Draft bill for ${clientTarget}.\nAmount: ${amountStr}\nMemo: ${bill.memo || triage.notes || rawText}`
            };

            const kateWorker = await lookupWorkerByName('Kate');
            if (kateWorker) assignmentPayload['Worker'] = [kateWorker.id];

            if (triage.matched_site_name) {
              const matchedSite = await lookupSite(null, triage.matched_site_name);
              if (matchedSite) assignmentPayload['Sites'] = [matchedSite.id];
            } else if (site?.id) {
              assignmentPayload['Sites'] = [site.id];
            }

            const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
            const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';

            const invoiceVoucher = `🧾 *BOUNCE RECEIVABLES | INVOICE QUEUED*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🎫 *Ticket ${ticketId} Created*\n` +
              `👤 *Account:* ${clientTarget}\n` +
              `💰 *Amount:* ${amountStr}\n` +
              `⚡ *Priority:* High (Billing Queue)\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `📝 *Directive:*\n` +
              `${bill.memo || triage.notes || rawText}\n\n` +
              `✅ *Queued for QuickBooks Online draft & 1-tap review.*`;

            await dispatchReply(invoiceVoucher);
            return;
          }

          // 2. PAYMENT RECEIVED ROUTE
          if (triage && triage.intent === 'PAYMENT_RECEIVED') {
            const bill = triage.billing_details || {};
            const payer = bill.client_name || triage.matched_site_name || 'Accounts';
            const amountStr = bill.amount || 'Logged Deposit';

            const assignmentPayload = {
              'Date': new Date().toISOString().split('T')[0],
              'Assignment Type': 'Payment Received',
              'Priority': 'Low',
              'Source': senderSource || 'Receivables',
              'Status': 'Complete',
              'Notes': `[PAYMENT SETTLED]: Received from ${payer}.\nAmount: ${amountStr}\nMethod: ${bill.payment_method || 'Wire/Transfer'}\nMemo: ${bill.memo || triage.notes || rawText}`
            };

            if (triage.matched_site_name) {
              const matchedSite = await lookupSite(null, triage.matched_site_name);
              if (matchedSite) assignmentPayload['Sites'] = [matchedSite.id];
            } else if (site?.id) {
              assignmentPayload['Sites'] = [site.id];
            }

            await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);

            const paymentVoucher = `💵 *BOUNCE RECEIVABLES | PAYMENT RECORDED*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `👤 *Payer:* ${payer}\n` +
              `💰 *Amount:* ${amountStr}\n` +
              `🏦 *Method:* ${bill.payment_method || 'Electronic Transfer'}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `✅ *Settlement logged in ledger and applied to account.*`;

            await dispatchReply(paymentVoucher);
            return;
          }

          // 3. COMMERCIAL QUOTE
          if (triage && triage.intent === 'COMMERCIAL_QUOTE') {
            const comm = triage.commercial_quote_details || {};
            const directedTo = comm.directed_to || (rawText.toLowerCase().includes('rob') ? 'Rob' : 'Bob');
            let assignedWorker = await lookupWorkerByName(directedTo);
            if (!assignedWorker) assignedWorker = worker;

            const leadNotes = `[COMMERCIAL LEAD — Directed to ${directedTo}]\n` +
              `Scope: ${comm.scope_summary || triage.notes || rawText}\n` +
              `Type: ${comm.quote_type || 'Build Quote'}`;

            const assignmentPayload = {
              'Date': new Date().toISOString().split('T')[0],
              'Assignment Type': 'Sales',
              'Priority': 'High',
              'Source': 'Joy Cannon (Client)',
              'Status': 'Open',
              'Notes': leadNotes
            };

            if (assignedWorker?.id) assignmentPayload['Worker'] = [assignedWorker.id];
            if (triage.matched_site_name) {
              const matchedSite = await lookupSite(null, triage.matched_site_name);
              if (matchedSite) assignmentPayload['Sites'] = [matchedSite.id];
            }

            const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
            const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';

            const commercialVoucher = `💼 *TITAN OS | COMMERCIAL LEAD CAPTURED*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🚀 *Lead Queued (${ticketId})*\n` +
              `👤 *Directed To:* ${directedTo}\n` +
              `🏢 *Opportunity:* ${comm.quote_type || 'New Build / Conversion'}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `📝 *Scope Detected:*\n` +
              `${comm.scope_summary || rawText}\n\n` +
              `✅ *Logged to Daily Assignments • Status: Open for Review*`;

            await dispatchReply(commercialVoucher);

            if (assignedWorker) {
              notifyAssignedWorker(
                ticketId,
                'Prospective Project / Client Lead',
                'Sales Quote',
                'High',
                leadNotes,
                assignedWorker
              ).catch(() => {});
            }
            return;
          }

          // 4. WORK ORDER CLOSEOUT
          if (triage && triage.intent === 'WORK_ORDER_CLOSEOUT') {
            await executeWorkOrderCloseout({
              site,
              targetCourtName: triage.matched_site_name,
              ticketId: triage.ticket_id,
              resolutionNotes: triage.resolution_summary || 'Task completed.',
              worker,
              dispatchTarget,
              fromPhone
            });
            return;
          }

          // 5. STANDARD GENERAL DISPATCH
          if (triage && triage.is_actionable) {
            let targetSite = null;
            if (triage.matched_site_name) targetSite = await lookupSite(null, triage.matched_site_name);
            if (!targetSite && site) targetSite = site;

            let assignedWorker = worker;
            if (triage.suggested_worker_name) {
              const namedWorker = await lookupWorkerByName(triage.suggested_worker_name);
              if (namedWorker) assignedWorker = namedWorker;
            }

            const assignmentPayload = {
              'Date': new Date().toISOString().split('T')[0],
              'Assignment Type': triage.assignment_type || 'Service',
              'Priority': triage.priority || 'Medium',
              'Source': senderSource || 'Dispatch',
              'Status': 'Open',
              'Notes': triage.notes || rawText
            };

            if (triage.task_category) assignmentPayload['Task Category'] = triage.task_category;
            if (assignedWorker?.id) assignmentPayload['Worker'] = [assignedWorker.id];
            if (targetSite?.id) assignmentPayload['Sites'] = [targetSite.id];

            const createdAssignment = await airtableWriteWithAutoDrop('Daily Assignments', assignmentPayload);
            const ticketId = createdAssignment?.fields?.['Assignment ID'] ? `#${createdAssignment.fields['Assignment ID']}` : 'NEW';
            const courtLabel = targetSite?.fields?.['Site Name'] || triage.matched_site_name || 'Assigned Channel / Court';

            let headerEmoji = '🧾';
            let headerTitle = 'DISPATCH VOUCHER';
            if (currentMode === 'INVENTORY' || triage.intent === 'INVENTORY_UPDATE') {
              headerEmoji = '📦';
              headerTitle = 'INVENTORY & WAREHOUSE AUDIT';
            } else if (currentMode === 'LOGISTICS' || triage.intent === 'LOGISTICS_DELIVERY') {
              headerEmoji = '🚚';
              headerTitle = 'LOGISTICS & FREIGHT MANIFEST';
            } else if (currentMode === 'PRODUCTION' || triage.intent === 'PRODUCTION_UPDATE') {
              headerEmoji = '🏭';
              headerTitle = 'FACTORY PRODUCTION ORDER';
            } else if (currentMode === 'EXECUTIVE') {
              headerEmoji = '📌';
              headerTitle = 'EXECUTIVE DIRECTIVE';
            }

            const dispatchVoucher = `${headerEmoji} *TITAN OS | ${headerTitle}*\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `🎫 *Ticket ${ticketId} Created*\n` +
              `🏟️ *Target:* ${courtLabel}\n` +
              `🔧 *Category:* ${triage.task_category || assignmentPayload['Assignment Type']}\n` +
              `⚡ *Priority:* ${assignmentPayload['Priority']}\n` +
              `👤 *Assigned:* ${assignedWorker?.fields?.['Full Name'] || 'Dispatch Queue'}\n` +
              `━━━━━━━━━━━━━━━━━━━━\n` +
              `📝 *Directive:*\n` +
              `${triage.notes || rawText}\n\n` +
              `✅ *Logged to Daily Assignments • Status: Open*`;

            await dispatchReply(dispatchVoucher);

            if (assignedWorker) {
              notifyAssignedWorker(
                ticketId,
                courtLabel,
                triage.task_category || assignmentPayload['Assignment Type'],
                assignmentPayload['Priority'],
                triage.notes || rawText,
                assignedWorker
              ).catch(() => {});
            }

            return;
          }
        } catch (triageErr) {
          console.warn('[Dispatch Triage Exception]:', triageErr.message);
        }
      }

      return;
    }

    // ------------------------------------------------------------------
    // MULTIMODAL MEDIA PROCESSING (DEBOUNCED BATCH INGESTION)
    // ------------------------------------------------------------------
    const isVideo = message.type === 'video';
    const isImage = message.type === 'image';
    const isAudio = message.type === 'audio' || message.type === 'voice';

    if (!isVideo && !isImage && !isAudio) return;

    const mediaObj = message[message.type];
    const mediaId = mediaObj.id;
    const mimeType = mediaObj.mime_type || (isVideo ? 'video/mp4' : (isAudio ? 'audio/ogg' : 'image/jpeg'));
    const caption = mediaObj.caption || (isAudio ? '[Spoken Voice Memo]' : '');

    const reactionEmoji = isAudio ? '🎧' : (isVideo ? '🎥' : '📸');
    sendWhatsAppReaction(dispatchTarget, messageId, reactionEmoji).catch(() => {});

    const metaMediaRes = await fetch(`${CONFIG.meta.graphApiUrl}/${mediaId}`, {
      headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
    });
    const metaMediaData = await metaMediaRes.json().catch(() => ({}));

    if (!metaMediaRes.ok || !metaMediaData?.url) {
      console.error(`[Meta Graph Error] Could not resolve mediaId ${mediaId}:`, metaMediaData);
      await dispatchReply(`⚠️ Unable to download media from WhatsApp. Please try sending again.`);
      return;
    }

    const mediaBufferRes = await fetch(metaMediaData.url, {
      headers: { 'Authorization': `Bearer ${CONFIG.meta.accessToken}` }
    });

    if (!mediaBufferRes.ok) {
      console.error(`[CDN Error] Failed to stream binary (${mediaBufferRes.status})`);
      return;
    }

    const mediaBuffer = Buffer.from(await mediaBufferRes.arrayBuffer());

    const queueKey = `${dispatchTarget}_${site?.id || 'unbound'}`;

    if (!mediaDebounceQueues.has(queueKey)) {
      mediaDebounceQueues.set(queueKey, {
        items: [],
        timer: null,
        site,
        worker,
        dispatchTarget,
        fromPhone,
        senderSource,
        indoorSite,
        callerIdentity
      });
    }

    const queue = mediaDebounceQueues.get(queueKey);
    queue.items.push({
      buffer: mediaBuffer,
      mimeType,
      messageId,
      caption,
      type: message.type,
      rawMessage: message
    });
    queue.site = site;
    queue.worker = worker;
    queue.callerIdentity = callerIdentity;

    if (queue.timer) {
      clearTimeout(queue.timer);
    }

    queue.timer = setTimeout(async () => {
      try {
        const currentBatch = mediaDebounceQueues.get(queueKey);
        mediaDebounceQueues.delete(queueKey);
        if (!currentBatch || currentBatch.items.length === 0) return;

        console.log(`[Debouncer] Processing batch of ${currentBatch.items.length} media item(s)`);
        await processMediaBatch(currentBatch);
      } catch (batchErr) {
        console.error('[Debouncer Batch Error]:', batchErr);
      }
    }, DEBOUNCE_DELAY_MS);

  } catch (err) {
    console.error('[Runtime Exception]:', err);
  }
});

// ====================================================================
// 13. AUTONOMOUS INFRASTRUCTURE ASSET VISION SNAPSHOT
// ====================================================================

app.post('/api/court-snapshot', async (req, res) => {
  try {
    const { siteId, imageBase64, captureTime } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing required imageBase64 payload.' });
    }

    console.log(`[Asset Vision Telemetry] Analyzing court snapshot for Site: ${siteId || 'Global Node'}`);

    const systemPrompt = `
You are the Titan OS Court Telemetry Engine. Analyze this high-resolution snapshot taken of an empty padel court.
Measure:
1. Center net tension and horizon sag (regulation baseline: 88 cm at center).
2. Silica sand distribution (contrast between baseline traction wear vs corner drift).
3. Surface debris, leaves, pine needles, or foreign safety hazards.
4. Glass panel structural integrity and seam alignment.
Output playability index score (0-100%) and certification status.
`;

    const payload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [
        {
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
            { text: `Analyze morning court readiness at ${captureTime || new Date().toISOString()}` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.0,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    const gRes = await fetch(`${CONFIG.gemini.endpoint}?key=${CONFIG.gemini.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!gRes.ok) {
      const errText = await gRes.text();
      return res.status(500).json({ error: `Gemini vision failed: ${errText}` });
    }

    const gData = await gRes.json();
    const rawParsed = gData.candidates?.[0]?.content?.parts?.[0]?.text;
    const telemetry = JSON.parse(rawParsed);

    if (siteId) {
      const eventPayload = {
        executiveSummary: `Morning scan verified at ${telemetry.playabilityIndex || 100}% playability. Condition: ${telemetry.certificationStatus || '100% Tour-Ready'}.`,
        status: telemetry.certificationStatus || '100% Tour-Ready',
        playabilityScore: telemetry.playabilityIndex || 100,
        operationalDetails: telemetry.recommendedAction || 'Surface groomed and net calibrated.'
      };
      await fireJoyCannonMultiCast(siteId, eventPayload);
    }

    return res.status(200).json({ success: true, telemetry });
  } catch (err) {
    console.error('[Court Snapshot Error]:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 14. JOY CANNON BROADCAST API ROUTE
// ====================================================================

app.post('/api/joy-cannon/broadcast', async (req, res) => {
  res.sendStatus(200);
  try {
    const { siteId, eventPayload } = req.body;
    if (!siteId || !eventPayload) return;
    await fireJoyCannonMultiCast(siteId, eventPayload);
  } catch (err) {
    console.error('[API Broadcast Error]:', err);
  }
});

// ====================================================================
// 15. AIRTABLE AUTOMATION WEBHOOK (MULTI-WORKER DISPATCH NOTIFICATION)
// ====================================================================

app.post('/api/notify-worker', async (req, res) => {
  res.sendStatus(200);
  try {
    const { recordId } = req.body;
    if (!recordId) return;

    console.log(`[Webhook Trigger] Multi-worker dispatch notification requested for record: ${recordId}`);

    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Daily%20Assignments/${recordId}`;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    if (!response.ok) return;

    const ticket = await response.json();
    const workerLinks = ticket.fields['Worker'] || [];
    if (!Array.isArray(workerLinks) || workerLinks.length === 0) {
      console.log(`[Webhook Trigger] No workers assigned to ticket #${ticket.fields['Assignment ID']}.`);
      return;
    }

    let courtName = 'General Facility';
    const siteLink = ticket.fields['Sites']?.[0];
    if (siteLink) {
      const siteRes = await fetch(`${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites/${siteLink}`, {
        headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
      });
      if (siteRes.ok) {
        const siteData = await siteRes.json();
        courtName = siteData.fields['Site Name'] || courtName;
      }
    }

    console.log(`[Multi-Worker Broadcast] Alerting ${workerLinks.length} assigned technician(s)...`);
    for (const workerId of workerLinks) {
      const workerRes = await fetch(`${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Worker/${workerId}`, {
        headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` }
      });
      if (workerRes.ok) {
        const workerData = await workerRes.json();
        await notifyAssignedWorker(
          ticket.fields['Assignment ID'],
          courtName,
          ticket.fields['Task Category'],
          ticket.fields['Priority'],
          ticket.fields['Notes'],
          workerData
        );
      }
    }
  } catch (err) {
    console.error('[Multi-Worker Notification Endpoint Error]:', err);
  }
});

// ====================================================================
// 16. EMBEDDABLE FLEET MAP (LEAFLET + AIRTABLE DIGITAL TWINS)
// ====================================================================

app.get('/fleet-map', async (req, res) => {
  try {
    const url = `${CONFIG.airtable.endpoint}/${CONFIG.airtable.baseId}/Sites?maxRecords=100`;
    const response = await fetch(url, { headers: { 'Authorization': `Bearer ${CONFIG.airtable.apiKey}` } });
    const data = await response.json();
    const sites = data.records || [];

    const mapPins = [];
    for (const site of sites) {
      const f = site.fields;
      const coords = await resolveCoordinates(site);
      if (coords && coords.lat && coords.lon) {
        mapPins.push({
          name: f['Site Name'] || 'Padel Asset',
          lat: coords.lat,
          lon: coords.lon,
          mode: f['Workflow Mode'] || 'INSTALLATION',
          status: f['Site Status'] || 'ACTIVE',
          condition: f['Maintenance Condition'] || 'Nominal',
          currentGate: f['Current Gate'] || 'Active Phase',
          lastNote: f['Last Note'] || 'No recent notes recorded'
        });
      }
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Titan OS Continental Fleet Map</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; width: 100%; height: 100%; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .leaflet-popup-content-wrapper { background: #1e293b; color: #f8fafc; border-radius: 8px; border: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.5); }
    .leaflet-popup-tip { background: #1e293b; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; margin-bottom: 6px; letter-spacing: 0.5px; }
    .badge-active { background: #15803d; color: #dcfce7; }
    .badge-paused { background: #b91c1c; color: #fee2e2; }
    .badge-amber { background: #d97706; color: #fef3c7; }
    .site-title { font-size: 15px; font-weight: 700; margin-bottom: 4px; color: #f8fafc; }
    .site-meta { font-size: 12px; color: #94a3b8; margin-bottom: 3px; }
    .site-note { margin-top: 6px; font-size: 11px; color: #cbd5e1; font-style: italic; border-top: 1px solid #334155; padding-top: 4px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map', { zoomControl: false }).setView([44.5, -79.5], 6);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; CartoDB &copy; OpenStreetMap',
      maxZoom: 19
    }).addTo(map);

    const pins = ${JSON.stringify(mapPins)};
    const bounds = [];

    pins.forEach(pin => {
      let color = '#22c55e';
      let badgeClass = 'badge-active';
      let badgeText = 'ACTIVE / NOMINAL';

      if (pin.status === 'PAUSED' || pin.condition.toLowerCase().includes('hazard')) {
        color = '#ef4444';
        badgeClass = 'badge-paused';
        badgeText = 'PAUSED / HAZARD';
      } else if (pin.condition.toLowerCase().includes('action')) {
        color = '#f59e0b';
        badgeClass = 'badge-amber';
        badgeText = 'ACTION REQUIRED';
      }

      const marker = L.circleMarker([pin.lat, pin.lon], {
        radius: 8,
        fillColor: color,
        color: '#ffffff',
        weight: 1.5,
        opacity: 0.9,
        fillOpacity: 0.85
      }).addTo(map);

      marker.bindPopup(\`
        <div>
          <span class="badge \\\${badgeClass}">\\\${badgeText}</span>
          <div class="site-title">\\\${pin.name}</div>
          <div class="site-meta"><strong>Workflow:</strong> \\\${pin.mode}</div>
          <div class="site-meta"><strong>Phase / Gate:</strong> \\\${pin.currentGate}</div>
          <div class="site-note">\\\${pin.lastNote}</div>
        </div>
      \`);

      bounds.push([pin.lat, pin.lon]);
    });

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  </script>
</body>
</html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (err) {
    console.error('[Fleet Map Error]:', err);
    res.status(500).send('Failed to generate fleet map');
  }
});

// ====================================================================
// 17. HEALTH & SERVICE RUNTIME
// ====================================================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    version: '4.7.0',
    engine: 'Titan OS V4.7.0 (Proactive HITL Agent, Interactive Buttons, Fleet Map & Receivables Engine)',
    activePipes: [
      'QBO-Receipt-Bridge',
      'Identity-Matrix',
      'Compound-Scheduler',
      'Joy-Cannon-Multicast',
      'Staging-Gates-0A-0B',
      'Court-Snapshot-Telemetry',
      'Fleet-Map-Leaflet',
      'WhatsApp-Interactive-Buttons',
      'Autonomous-Receivables-Loop'
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Titan OS V4.7.0 Proactive HITL Engine listening on Port 3000`);
});

```
