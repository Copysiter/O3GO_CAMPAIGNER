from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from uuid import UUID

from .user import User


# Shared properties
class AccountBase(BaseModel):
    user_id: Optional[int] = Field(
        None, description='ID владельца кампании'
    )
    file_name: Optional[str] = Field(
        None, description='Название архива'
    )
    uuid: Optional[UUID] = Field(
        None, description='UUID файла для скачивания'
    )
    limit: Optional[int] = Field(
        -1, description='Лимит отправки сообщений подряд'
    )
    cooldown: Optional[int] = Field(
        None, description='Пауза перед повторной отправкой сообщений'
    )
    create_ts: Optional[datetime] =  Field(
        datetime.utcnow(), description='Дата добавления аккаунта'
    )
    status_ts: Optional[datetime] = Field(
        None, description='Последняя дата использования'
    )
    sent: Optional[int] = Field(
        0, description='Количество отправленных сообщений'
    )
    status: Optional[int] = Field(
        0, description='Статус аккаунта'
    )


# Properties to receive on item creation
class AccountCreate(AccountBase):
    file_name: str = Field(description='Название архива')
    uuid: Optional[UUID] = Field(description='UUID файла для скачивания')


# Properties to receive on item update
class AccountUpdate(AccountBase):
    pass


# Properties shared by models stored in DB
class AccountInDBBase(AccountBase):
    id: int = Field(escription='Уникальный идентификатор')

    class Config:
        from_attributes = True


# Properties to return to client
class Account(AccountInDBBase):
    user: Optional[User]


# Properties stored in DB
class AccountInDB(AccountInDBBase):
    pass


# List to return to client
class AccountRows(BaseModel):
    data: List[Account]
    total: int = 0


class AccountMultiCreate(BaseModel):
    files: List[str] = Field(description='Список названий файлов')
    user_id: Optional[int] = Field(
        None, description='ID владельца кампании'
    )
    limit: Optional[int] = Field(
        -1, description='Лимит отправки сообщений подряд'
    )
    cooldown: Optional[int] = Field(
        None, description='Пауза перед повторной отправкой сообщений'
    )


class AccountLinkRequest(BaseModel):
    device: str = Field(description='ID девайса')


class AccountLinkResponse(BaseModel):
    id_task: int = Field(description='ID операции')
    url: str = Field(description='Ссылка на скачивание архива')
    cnt_msg_iteration: Optional[int] = Field(
        -1, description='Лимит отправок сообщений до смены аккаунта'
    )
    status: int = Field(description='Статус задачи / аккаунта')
    code: str = Field('0', description='Код успешности операции')


class AccountUnlinkRequest(BaseModel):
    id_task: int = Field(description='ID операции')
    device: Optional[str] = Field(None, description='ID девайса,')
    sent: Optional[int] = Field(
        0, description='Количество отправленных сообщений'
    )