from dataclasses import dataclass, fields


@dataclass
class Status:
    @classmethod
    def name(cls, value):
        for field in fields(cls):
            if getattr(cls, field.name) == value:
                return field.name
        return None


@dataclass
class CampaignStatus(Status):
    PAUSED: int = -1
    CREATED: int = 0
    RUNNING: int = 1
    STOPPED: int = 2
    COMPLETE: int = 3


@dataclass
class CampaignDstStatus(Status):
    WAITING: int = -1
    CREATED: int = 0
    SENT: int = 1
    DELIVERED: int = 2
    UNDELIVERED: int = 3
    FAILED: int = 4
