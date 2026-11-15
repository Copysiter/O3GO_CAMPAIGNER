from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ImportMapping(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_id: str
    data_fields: dict[str, Optional[int]] = Field(default_factory=lambda: {"dst_addr": 0})
    skip_rows: int = Field(default=0, ge=0)
    delimiter: Optional[str] = None

    @field_validator("data_fields")
    @classmethod
    def validate_fields(cls, value):
        allowed = {"dst_addr", *(f"field_{i}" for i in range(1, 6))}
        if set(value) - allowed:
            raise ValueError("Неизвестное поле сопоставления")
        if any(index is not None and (index < 0 or index >= 100) for index in value.values()):
            raise ValueError("Номер колонки должен быть от 0 до 99")
        return value

    @field_validator("delimiter")
    @classmethod
    def validate_delimiter(cls, value):
        if value not in (None, ";", ",", "\t", "|"):
            raise ValueError("Допустимые разделители: ; , табуляция |")
        return value


class ImportPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    mappings: list[ImportMapping] = Field(default_factory=list)
    default_region: Optional[str] = Field(default=None, max_length=2)
    exclude_invalid: bool = False
