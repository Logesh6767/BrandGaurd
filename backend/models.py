"""
Pydantic Request & Response Schemas for BrandGuard API.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    password: str


class RoleSwitchRequest(BaseModel):
    role: str = Field(..., description="One of: creator, reviewer, manager, admin")


class RuleCreateRequest(BaseModel):
    rule_id: str
    category: str = Field(..., description="fact, terminology, claim, tone, visual, accessibility")
    title: str
    source_doc: str
    owner: str
    doc_version: str = "v3.0"
    severity: str = "MEDIUM"
    exact_quote: str
    pattern: str = ""
    disallow_terms: List[str] = Field(default_factory=list)
    preferred_replacement: str = ""
    preserved_intent: str = "Preserves: brand consistency and factual accuracy."
    expiry_date: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class BrandKitVersionRequest(BaseModel):
    name: str = "ABC SmartFlow Global Brand Kit"
    description: str = "Updated brand governance rules, facts, and visual standards."
    voice_descriptors: List[str] = Field(
        default_factory=lambda: ["Clear", "Evidence-based", "Helpful", "Enterprise-ready"]
    )
    target_reading_grade: float = 10.0
    min_contrast_normal: float = 4.5
    min_contrast_large: float = 3.0


class SubmissionCreateRequest(BaseModel):
    title: str
    content_type: str = "product_copy"
    team: str = "Product Marketing"
    content: str
    fg_color: str = "#0F172A"
    bg_color: str = "#FFFFFF"
    accent_color: str = "#0F62FE"
    image_name: str = ""
    image_alt: str = ""
    image_colors: List[str] = Field(default_factory=list)
    cta_link_text: str = ""
    cta_link_url: str = ""
    auto_review: bool = True


class SubmissionUpdateRequest(BaseModel):
    title: Optional[str] = None
    content: str
    fg_color: Optional[str] = None
    bg_color: Optional[str] = None
    accent_color: Optional[str] = None
    image_name: Optional[str] = None
    image_alt: Optional[str] = None
    image_colors: Optional[List[str]] = None
    cta_link_text: Optional[str] = None
    cta_link_url: Optional[str] = None
    change_summary: str = "Manual content edit by creator"
    auto_review: bool = True


class FindingActionRequest(BaseModel):
    action: str = Field(
        ...,
        description="accept, dismiss, comment, reviewer_override, reviewer_uphold",
    )
    reason: str = ""
    custom_replacement: Optional[str] = None


class WorkflowDecisionRequest(BaseModel):
    decision: str = Field(
        ...,
        description="submit_for_approval, approve, request_changes, reject",
    )
    notes: str = ""


class ClarifyRuleRequest(BaseModel):
    rule_id: str
    updated_exact_quote: str
    updated_preferred_replacement: Optional[str] = None
    clarification_note: str = "Clarified ambiguous rule based on governance dismissal patterns."
