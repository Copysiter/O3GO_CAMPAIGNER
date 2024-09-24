import time
import logging

from datetime import timedelta

from . import aioudp

# import config


# logging.basicConfig(level=logging.DEBUG, format=config.LOG_FORMAT)


class StatsTimer:
    """A context manager for keysd.timing()."""
    def __init__(
        self, client: 'StatsClient', key: str | None = None,
        rate: int | float = 1
    ) -> None:
        self.client = client
        self.key = key
        self.value = None
        self.rate = rate
        self._sent = False
        self._start_time = None

    async def __aenter__(self) -> 'StatsTimer':
        return self.start()

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.stop()

    def start(self) -> 'StatsTimer':
        self.value = None
        self._sent = False
        self._start_time = time.monotonic()
        return self

    async def stop(self, key: str | None = None, send: bool = True) -> None:
        if self._start_time is None:
            raise RuntimeError('Timer has not started.')
        self.value = int(1000 * (time.monotonic() - self._start_time))
        if send:
            await self.send(key)

    async def send(self, key: str | None) -> None:
        if self.value is None:
            raise RuntimeError('No data recorded.')
        if self._sent:
            raise RuntimeError('Already sent data.')
        self._sent = True
        if not key:
            key = self.key
        await self.client.timing(key, self.value, self.rate)


class StatsClient:
    ENCODING = 'ascii'

    def __init__(
        self, host: str = 'localhost', port: int = 8125, prefix: str = None,
        logger: logging.Logger = logging.getLogger(__name__)
    ) -> None:
        """
        Sends keyistics to the keys daemon over UDP
        """
        self.logger = logger
        self.addr = (host, port)
        self._prefix = prefix

    def __await__(self) -> 'StatsClient':
        return self.async_init().__await__()

    async def async_init(self) -> 'StatsClient':
        self.client = await aioudp.connect(self.addr)
        return self

    def timer(
        self, key: str | None = None, rate: int | float = 1
    ) -> 'StatsTimer':
        return StatsTimer(self, key, rate)

    async def timing(
        self, key: str, delta: int | timedelta, rate: int | float = 1
    ) -> None:
        """
        Send new timing information.
        `delta` can be either a number of milliseconds or a timedelta.
        """
        if isinstance(delta, timedelta):
            delta = delta.total_seconds() * 1000.
        await self._send_key(key, f'{delta}|ms', rate)

    async def set(self, key: str, value, rate: int | float = 1) -> None:
        """Set a set value."""
        await self._send_key(key, f'{value}|s', rate)

    async def incr(
        self, key: str, count: int = 1, rate: int | float = 1
    ) -> None:
        """Increment a key by `count`."""
        await self._send_key(key, f'{count}|c', rate)

    async def decr(
        self, key: str, count: int = 1, rate: int | float = 1
    ) -> None:
        """Decrement a key by `count`."""
        await self.incr(key, -count, rate)

    async def gauge(
        self, key: str, value: int | float,
        rate: int | float = 1, delta: bool = False
    ) -> None:
        """Set a gauge value."""
        if value < 0 and not delta:
            data = '\n'.join([
                self._prepare(key, '0|g', rate),
                self._prepare(key, f'{value}|g', rate)
            ])
        else:
            prefix = '+' if delta and value >= 0 else ''
            data = self._prepare('{}{}|g'.format(prefix, value))
        await self._after(key, data, rate)

    async def _send_key(self, key: str, value, rate: int | float) -> None:
        await self._after(self._prepare(key, value, rate))

    def _prepare(self, key: str, value, rate: int | float) -> str:
        if rate < 1:
            value = '{}|@{}'.format(value, rate)
        if self._prefix:
            key = '{}.{}'.format(self._prefix, key)
        return '{}:{}'.format(key, value)

    async def _after(self, data) -> None:
        if data:
            await self._send(bytes(data.encode(self.ENCODING)))

    async def _send(self, data) -> None:
        """Sends data via UDP."""
        try:
            await self.client.send(data)
        except Exception:
            self.logger.error(
                'Connection refused (%s:%d)', *self.addr
            )
