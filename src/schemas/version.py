from typing import Optional, List
from pydantic import BaseModel, Field


# Shared properties
class VersionBase(BaseModel):
    file_name: Optional[str] = Field(None, description="Название APK файла")
    description: Optional[str] = Field(None, description="Описание версии APK ")


# Properties to receive on item creation
class VersionCreate(VersionBase):
    file_name: str = Field(None, description="Название APK файла")


# Properties to receive on item update
class VersionUpdate(VersionBase):
    pass


# Properties shared by models stored in DB
class VersionInDBBase(VersionBase):
    id: int = Field(None, description="Уникальный идентификатор")

    class Config:
        from_attributes = True


# Properties to return to client
class Version(VersionInDBBase):
    pass


# Properties stored in DB
class VersionInDB(VersionInDBBase):
    pass


# List to return to client
class VersionRows(BaseModel):
    data: List[Version]
    total: int = 0