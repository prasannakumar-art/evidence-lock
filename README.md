# EVIDENCELOCK
> **"Every File Has a History. Every Change Leaves Evidence."**

**EVIDENCELOCK** is a digital evidence integrity and chain-of-custody management system engineered for law enforcement agencies, cyber incident response teams (DFIR), forensic examiners, judicial auditors, and regulatory compliance authorities.

---

## 🛡️ Core Capabilities

1. **Chunked Streaming SHA-256 (FIPS 180-4)**
   - Streams raw file bitstreams in 64KB blocks to compute authoritative 256-bit hashes.
   - Files are quarantined in staged storage, sanitized against directory traversal attacks (`../../`), and committed to isolated private vaults with internal UUID identifiers.
   - User-supplied filenames are never trusted as disk paths.

2. **Sequential Merkle Chain-of-Custody**
   - Every evidentiary event (intake, examination, transfer request, transfer acceptance, verification) is recorded as an immutable link.
   - Event payloads are deterministically serialized per **RFC 8785 JSON Canonicalization Scheme** before hashing.
   - Each event binds to the previous event hash, forming an unbroken cryptographic timeline.
   - Real-time audit engines detect reordered, missing, or altered events immediately.

3. **Asymmetric Cryptographic Checkpoints (NIST P-256 ECDSA)**
   - Protects against the threat of administrative database rewrites.
   - Chain heads are periodically sealed with digital signatures over the secp256r1 prime256v1 elliptic curve.
   - The private signing key resides outside the database in restricted filesystem storage (`/keys/signing_private_key.pem`).
   - The public verification key is published in standard SPKI PEM format for external judicial auditors.

4. **Multi-Role RBAC (Backend Enforced)**
   - **Investigator**: Upload permitted evidence, examine case artifacts, verify files, request/accept custody transfers, generate certificates.
   - **Auditor**: Review evidence registry, verify hash-chains and signed checkpoints, inspect tamper-evident audit logs, export reports.
   - **Administrator**: Manage user accounts and roles, monitor storage and cryptographic engine health. All actions are audited.

5. **Certified PDF Verification Reports**
   - Generates court-ready PDF forensic certificates containing Report ID, Docket Number, File Metadata, Genesis SHA-256, Current Bitstream SHA-256, Merkle Chain Results, and Asymmetric Checkpoint Signatures.

6. **Interactive Tamper Demonstration Studio**
   - Includes live simulation tools for examiners and auditors to intentionally alter raw disk bytes or tamper with database event records, demonstrating that EVIDENCELOCK immediately flags failures and broken links.

---

## 🏗️ Architecture & Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend** | Express REST API (Node.js 22 & TypeScript) |
| **Database** | Relational SQL engine (SQLite WAL mode with strict foreign keys & atomic transactions) |
| **Cryptography** | `node:crypto` (FIPS 180-4 SHA-256, NIST P-256 ECDSA, RFC 8785 Canonical JSON) |
| **Authentication** | Bcrypt (work factor 12) + HMAC-SHA256 Signed HTTPOnly Session Bearer |
| **PDF Generation** | PDFKit binary document compiler |
| **Private Storage** | Quarantined Staging (`/storage/staging`) + Private Vault (`/storage/evidence`) |
| **Key Isolation** | External Filesystem Key Store (`/keys/`) |

---

## 🚀 Getting Started

### 1. Installation
```bash
# Clone repository
git clone <repo-url>
cd evidencelock

# Install dependencies
npm install
```

### 2. Run Development Server
```bash
npm run dev
# The fullstack application will start on http://localhost:3000
```

### 3. Run Automated Forensic Tests
```bash
npm test
# Or directly:
npx tsx tests/run_tests.ts
```

All 13 core integrity requirements are verified with real synthetic test vectors:
- ✅ 01: Uploading a valid evidence file
- ✅ 02: Verifying an unchanged file
- ✅ 03: Detecting a modified file (bitstream tampering)
- ✅ 04: Detecting an altered custody event
- ✅ 05: Detecting reordered events
- ✅ 06: Detecting a missing custody event
- ✅ 07: Detecting a rewritten chain that does not match a protected signed checkpoint
- ✅ 08: Rejecting unauthorized access (RBAC)
- ✅ 09: Rejecting unauthorized custody transfers
- ✅ 10: Handling incomplete uploads safely
- ✅ 11: Rejecting conflicting concurrent transfers (optimistic locking)
- ✅ 12: Handling missing or unreadable evidence
- ✅ 13: Ensuring reports accurately represent failed verification results

---

## 👥 Seed Accounts for Testing

| Role | Username | Password | Full Name & Title |
|---|---|---|---|
| **Investigator** | `investigator.chen` | `Investigate@2026!` | Special Agent Sarah Chen (DFIR Incident Response) |
| **Investigator** | `investigator.dawson` | `Investigate@2026!` | Detective Liam Dawson (Digital Forensic Laboratory) |
| **Auditor** | `auditor.reyes` | `Auditor@2026!` | Senior Auditor Marcus Reyes (Inspector General) |
| **Administrator** | `admin` | `EvidenceLock@Admin2026!` | Alex Vance (Forensic Inspection Administrator) |

*Note: The UI includes a fast one-click identity switcher in the top navigation bar to test role permissions without re-typing credentials.*

---

## 📜 Forensic Standards Alignment
- **ISO/IEC 27037:2012**: Guidelines for identification, collection, acquisition, and preservation of digital evidence.
- **NIST SP 800-86**: Guide to Integrating Forensic Techniques into Incident Response.
- **FRE Rule 902(13) & 902(14)**: Self-authenticating electronic records and certified data copies.
