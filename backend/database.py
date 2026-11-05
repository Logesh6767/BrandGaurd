"""
SQLite Database Layer & Schema Initialization for BrandGuard.
Provides connection management, schema creation, and helper query utilities.
"""

import os
import sqlite3
import json
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import tempfile


def _resolve_db_path() -> str:
    env_path = os.environ.get("BRANDGUARD_DB_PATH")
    if env_path:
        return env_path
    default_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    # On Vercel or read-only serverless filesystems, use /tmp/brandguard.db
    if os.environ.get("VERCEL") or not os.access(default_dir, os.W_OK):
        return os.path.join(tempfile.gettempdir(), "brandguard.db")
    return os.path.join(default_dir, "brandguard.db")


DB_PATH = _resolve_db_path()


def now_iso() -> str:
    """Return current UTC timestamp in ISO-8601 format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_connection() -> sqlite3.Connection:
    """Create a configured SQLite connection with Row factory."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


@contextmanager
def db_session():
    """Context manager for transactional database operations."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def row_to_dict(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
    """Convert sqlite3.Row to a standard Python dictionary."""
    if row is None:
        return None
    return dict(row)


def rows_to_dicts(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    """Convert a list of sqlite3.Row objects to dictionaries."""
    return [dict(r) for r in rows]


def init_db() -> None:
    """Initialize all database tables for the 9-step BrandGuard governance workflow."""
    with db_session() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                display_name TEXT NOT NULL,
                role TEXT NOT NULL,
                team TEXT NOT NULL,
                password_hash TEXT NOT NULL,
                salt TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS brand_kits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                version INTEGER UNIQUE NOT NULL,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',
                voice_descriptors_json TEXT NOT NULL DEFAULT '[]',
                target_reading_grade REAL NOT NULL DEFAULT 10.0,
                min_contrast_normal REAL NOT NULL DEFAULT 4.5,
                min_contrast_large REAL NOT NULL DEFAULT 3.0,
                created_by TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS brand_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                kit_version INTEGER NOT NULL,
                rule_id TEXT NOT NULL,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                source_doc TEXT NOT NULL,
                owner TEXT NOT NULL,
                doc_version TEXT NOT NULL,
                severity TEXT NOT NULL,
                exact_quote TEXT NOT NULL,
                pattern TEXT NOT NULL DEFAULT '',
                disallow_terms_json TEXT NOT NULL DEFAULT '[]',
                preferred_replacement TEXT NOT NULL DEFAULT '',
                preserved_intent TEXT NOT NULL DEFAULT '',
                expiry_date TEXT DEFAULT NULL,
                metadata_json TEXT NOT NULL DEFAULT '{}',
                UNIQUE(kit_version, rule_id)
            );

            CREATE TABLE IF NOT EXISTS submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content_type TEXT NOT NULL DEFAULT 'product_copy',
                team TEXT NOT NULL DEFAULT 'Marketing',
                author_name TEXT NOT NULL,
                author_role TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'DRAFT',
                kit_version INTEGER NOT NULL DEFAULT 3,
                current_version INTEGER NOT NULL DEFAULT 1,
                current_content TEXT NOT NULL,
                fg_color TEXT NOT NULL DEFAULT '#0F172A',
                bg_color TEXT NOT NULL DEFAULT '#FFFFFF',
                accent_color TEXT NOT NULL DEFAULT '#0F62FE',
                image_name TEXT NOT NULL DEFAULT '',
                image_alt TEXT NOT NULL DEFAULT '',
                image_colors_json TEXT NOT NULL DEFAULT '[]',
                cta_link_text TEXT NOT NULL DEFAULT '',
                cta_link_url TEXT NOT NULL DEFAULT '',
                last_reviewed_version INTEGER NOT NULL DEFAULT 0,
                reviewer_notes TEXT NOT NULL DEFAULT '',
                approved_by TEXT NOT NULL DEFAULT '',
                approved_at TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS submission_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER NOT NULL,
                version_number INTEGER NOT NULL,
                content TEXT NOT NULL,
                fg_color TEXT NOT NULL DEFAULT '#0F172A',
                bg_color TEXT NOT NULL DEFAULT '#FFFFFF',
                accent_color TEXT NOT NULL DEFAULT '#0F62FE',
                image_alt TEXT NOT NULL DEFAULT '',
                cta_link_text TEXT NOT NULL DEFAULT '',
                change_summary TEXT NOT NULL,
                diff_html TEXT NOT NULL DEFAULT '',
                diff_stats_json TEXT NOT NULL DEFAULT '{}',
                created_by TEXT NOT NULL,
                created_role TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS findings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER NOT NULL,
                version_number INTEGER NOT NULL,
                issue_code TEXT NOT NULL,
                rule_id TEXT NOT NULL,
                category TEXT NOT NULL,
                severity TEXT NOT NULL,
                detected_text TEXT NOT NULL,
                start_idx INTEGER NOT NULL DEFAULT -1,
                end_idx INTEGER NOT NULL DEFAULT -1,
                source_doc TEXT NOT NULL,
                owner TEXT NOT NULL,
                doc_version TEXT NOT NULL,
                source_quote TEXT NOT NULL,
                evidence_verified INTEGER NOT NULL DEFAULT 1,
                why_flagged TEXT NOT NULL,
                suggested_fix TEXT NOT NULL,
                preserved_intent TEXT NOT NULL,
                confidence TEXT NOT NULL,
                needs_human_judgment INTEGER NOT NULL DEFAULT 0,
                engine_source TEXT NOT NULL DEFAULT 'deterministic',
                status TEXT NOT NULL DEFAULT 'OPEN',
                dismiss_reason TEXT NOT NULL DEFAULT '',
                dismissed_by TEXT NOT NULL DEFAULT '',
                reviewer_decision_note TEXT NOT NULL DEFAULT '',
                resolved_by TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS finding_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                finding_id INTEGER NOT NULL,
                submission_id INTEGER NOT NULL,
                author_name TEXT NOT NULL,
                author_role TEXT NOT NULL,
                comment_text TEXT NOT NULL,
                action_type TEXT NOT NULL DEFAULT 'COMMENT',
                created_at TEXT NOT NULL,
                FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS ai_disclosure_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER NOT NULL,
                version_number INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                provider TEXT NOT NULL,
                model_name TEXT NOT NULL,
                confidential_spans_redacted INTEGER NOT NULL DEFAULT 0,
                redacted_placeholders_json TEXT NOT NULL DEFAULT '[]',
                prompt_hash TEXT NOT NULL,
                findings_returned INTEGER NOT NULL DEFAULT 0,
                findings_validated INTEGER NOT NULL DEFAULT 0,
                latency_ms INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                actor_name TEXT NOT NULL,
                actor_role TEXT NOT NULL,
                action TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                details TEXT NOT NULL
            );
            """
        )


def log_audit(
    conn: sqlite3.Connection,
    actor_name: str,
    actor_role: str,
    action: str,
    target_type: str,
    target_id: str,
    details: str,
) -> None:
    """Record an immutable audit log entry inside an active transaction."""
    conn.execute(
        """
        INSERT INTO audit_logs (timestamp, actor_name, actor_role, action, target_type, target_id, details)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (now_iso(), actor_name, actor_role, action, target_type, str(target_id), details),
    )
