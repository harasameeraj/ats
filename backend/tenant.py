from contextvars import ContextVar
from typing import Optional

current_company_id: ContextVar[Optional[int]] = ContextVar("current_company_id", default=None)
