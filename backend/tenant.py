from contextvars import ContextVar

current_company_id: ContextVar[int | None] = ContextVar("current_company_id", default=None)
