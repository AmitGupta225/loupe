"""Pydantic schemas for contract structure."""

from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ClauseNode(BaseModel):
    """Hierarchical legal clause with exact character offsets."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(..., description="Unique clause identifier e.g. clause-1")
    title: str = Field(..., description="Clause heading text")
    content: str = Field(..., description="Full clause text including heading")
    char_start: int = Field(..., ge=0, description="Start offset in normalized document")
    char_end: int = Field(..., ge=0, description="End offset in normalized document")
    level: int = Field(default=1, ge=1, description="Hierarchy level")
    section_number: str = Field(default="", description="Section number like 1.1 or 8.2")
    clause_type: str = Field(default="general", description="Legal category")

    @field_validator("char_end")
    @classmethod
    def validate_offsets(cls, v: int, info) -> int:
        """Ensure char_end >= char_start."""
        char_start = info.data.get("char_start")
        if char_start is not None and v < char_start:
            raise ValueError("char_end must be >= char_start")
        return v


class DefinedTerm(BaseModel):
    """A defined term and its definition location."""

    model_config = ConfigDict(extra="forbid")

    term: str = Field(..., min_length=1)
    definition: str = Field(..., min_length=1)
    clause_id: str = Field(..., min_length=1)
    char_start: int = Field(..., ge=0)
    char_end: int = Field(..., ge=0)


class DocumentMetadata(BaseModel):
    """Document-level metadata extracted from contract."""

    model_config = ConfigDict(extra="forbid")

    document_id: str = Field(..., min_length=1)
    title: str = Field(default="")
    parties: List[str] = Field(default_factory=list)
    effective_date: Optional[str] = None
    governing_law: Optional[str] = None
    total_clauses: int = Field(default=0, ge=0)
    total_defined_terms: int = Field(default=0, ge=0)
    char_count: int = Field(default=0, ge=0)
    source_filename: Optional[str] = None


class ParsedDocument(BaseModel):
    """Fully parsed contract with clauses and defined terms."""

    model_config = ConfigDict(extra="forbid")

    raw_text: str = Field(..., min_length=1)
    clauses: List[ClauseNode] = Field(default_factory=list)
    defined_terms: Dict[str, str] = Field(default_factory=dict)
    metadata: DocumentMetadata
