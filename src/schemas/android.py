from typing import Optional, List, Dict
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

from .user import User


# Shared properties
class AndroidBase(BaseModel):
    type: Optional[str] = Field(None, description="Тип устройства (1 - WhatsApp, 2 - WhatsApp бизнес)")
    device: Optional[str] = Field(None, description="Уникальный ID устройства ")
    device_origin: Optional[str] = Field(None, description="Уникальный ID для данного приложения")
    device_name: Optional[str] = Field(None, description="Название устройства")
    manufacturer: Optional[str] = Field(None, description="Производитель телефона")
    version: Optional[str] = Field(None, description="Версия приложения")
    android_version: Optional[str] = Field(None, description="Версия Android")
    operator_name: Optional[str] = Field(None, description="Оператор")
    bat: Optional[str] = Field(None, description="Уровень заряда")
    charging: Optional[str] = Field(None, description="Статус зарядки (1 - заряжается)")
    push_id: Optional[str] = Field(None, description="Push ID")
    info_data: Optional[str] = Field(None, description="Подробна информация")
    user_id: Optional[int] = Field(None, description="ID учетной записи")
    auth_code: Optional[str] = Field(None, description="Код авторизации")
    is_active: Optional[bool] = Field(None, description="Активность девайса")
    model_config = ConfigDict(
        json_schema_extra={
            'example': {
                "manufacturer": "Google",
                "device_name": "sdk_gphone64_arm64 [WhatsApp]",
                "dop_name": "",
                "device": "3df3bda5-7fbd-400c-901b-7baccb875bd8-WA",
                "device_origin": "3df3bda5-7fbd-400c-901b-7baccb875bd8",
                "domain": "",
                "version": "1",
                "android_version": "14",
                "operator_name": "WhatsApp",
                "bat": "100",
                "charging": "0",
                "push_id": "cL_yw9zgL9slLrwLocguti",
                "info_data": "",
                "type": "1"
            }
        }
    )


# Properties to receive on item creation
class AndroidCreate(AndroidBase):
    device: str = Field(None, description="Уникальный ID устройства ")
    device_origin: str = Field(None, description="Уникальный ID для данного приложения")
    type: str = Field(None, description="Тип устройства (1 - WhatsApp, 2 - WhatsApp бизнес)")


# Properties to receive on item update
class AndroidUpdate(AndroidBase):
    pass


# Properties shared by models stored in DB
class AndroidInDBBase(AndroidBase):
    id: int = Field(None, description="Уникальный идентификатор")

    class Config:
        from_attributes = True


# Properties to return to client
class Android(AndroidInDBBase):
    user: User


# Properties stored in DB
class AndroidInDB(AndroidInDBBase):
    pass


# List to return to client
class AndroidRows(BaseModel):
    data: List[Android]
    total: int = 0


class AndroidMessage(BaseModel):
    id: int = Field(None, description="Идентификатор сообщения")
    phone: str = Field(None, description="Номер телефона получателя")
    msg: str = Field(None, description="Текст сообщения")
    is_send_to_phone: Optional[int] = Field(0, description="")
    is_deliv: Optional[int] = Field(0, description="")


class AndroidPowerRequest(BaseModel):
    device: str = Field(None, description="Уникальный ID устройства")
    power: int = Field(1, description="Флаг включения")

    model_config = ConfigDict(
        json_schema_extra={
            'example': {
                "device": "3df3bda5-7fbd-400c-901b-7baccb875bd8-WA",
                "power": 1
            }
        }
    )


class AndroidMessageRequest(BaseModel):
    device: str = Field("", description="Уникальный ID устройства")
    bat: Optional[int] = Field(1, description="Заряд батареи в процентах")
    charging: Optional[int] = Field(0, description="Признак зарядки устройства")

    model_config = ConfigDict(
        json_schema_extra={
            'example': {
                "device": "23ec1f50-8ad5-47a5-b719-daa6223427c8-WA",
                "bat": "10",
                "charging": "1"
            }
        }
    )


class AndroidMessageWebhook(BaseModel):
    device: str = Field("", description="Уникальный ID устройства")
    param_json: List[Dict] = Field(0, description="Признак зарядки устройства")

    model_config = ConfigDict(
        json_schema_extra = {
            "examples": {
                "example1": {
                    "summary": "Подтверждение получение сообщение",
                    "value": [{
                        "device": "23ec1f50-8ad5-47a5-b719-daa6223427c8-WA",
                        "param_json": '[{"id":85224329}]'
                    }]
                },
                "example2": {
                    "summary": "Изменение статуса сообщения",
                    "value": [
                        {
                            "date_create": "2025-06-10 19:21:43",
                            "date_deliv": "2025-06-10 19:21:51",
                            "date_error": "",
                            "date_send": "2025-06-10 19:21:51",
                            "id": 85224329,
                            "id_from_app": "",
                            "is_deliv": 1,
                            "is_read": False,
                            "msg": "вамвамв",
                            "parts": 1,
                            "phone": "+79204800058",
                            "priority": 0,
                            "slotsim": 1,
                            "status": 2,
                            "status_app": 0,
                            "tip_send": 1
                        }
                    ]
                }
            }
        }
    )

# Response with code
class AndroidCodeResponse(BaseModel):
    code: str = Field(0, description="Код успешности операции")


# Response for android device register
class AndroidRegResponse(AndroidCodeResponse):
    auth_code: str = Field("", description="Код привязки устройства")
    is_socket: int = Field(0, description="")
    version: int = Field(1, description="")
    id_device: int = Field(0, description="ID зарегистрированного устройства в БД")


class AndroidMessageResponse(AndroidCodeResponse):
    limit: str = Field("", description="")
    limit_date: Optional[datetime] = Field(None, description="")
    limit_use: int = Field(0, description="")
    is_limit: bool = Field(False, description="")
    ost: Optional[int] = Field(None, description="")
    is_log: Optional[int] = Field(0, description="")
    dop_name: str = Field("", description="")
    is_socket: str = Field(0, description="")
    data: List[AndroidMessage]

