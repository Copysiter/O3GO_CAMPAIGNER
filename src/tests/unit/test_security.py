
from core.security import get_password_hash, verify_password  # noqa
from tests.utils.utils import random_lower_string  # noqa


def test_verify_password():
    password = random_lower_string()
    hashed_password = get_password_hash(password)
    assert password != hashed_password
    assert verify_password(password, hashed_password)
