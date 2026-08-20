import ast
import operator
from datetime import datetime

from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field

_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


class _EmptyArgs(BaseModel):
    pass


class _CalculatorArgs(BaseModel):
    expression: str = Field(description="Math expression using numbers and + - * / ( )")


def _eval_node(node: ast.AST) -> float:
    if isinstance(node, ast.Expression):
        return _eval_node(node.body)
    if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
        return float(node.value)
    if isinstance(node, ast.UnaryOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval_node(node.operand))
    if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
        return _OPS[type(node.op)](_eval_node(node.left), _eval_node(node.right))
    if isinstance(node, ast.Call):
        raise ValueError("functions are not allowed")
    raise ValueError("unsupported expression")


def get_current_time() -> str:
    return datetime.now().isoformat(timespec="seconds")


def calculator(expression: str) -> str:
    try:
        tree = ast.parse(expression, mode="eval")
        result = _eval_node(tree)
    except (SyntaxError, ValueError, ZeroDivisionError) as exc:
        return f"Tool error: {exc}"
    if result == int(result):
        return str(int(result))
    return str(result)


SYSTEM_TOOLS = [
    StructuredTool.from_function(
        func=get_current_time,
        name="get_current_time",
        description=(
            "Return the current local date and time in ISO format. "
            "Use this when the user asks what time or date it is."
        ),
        args_schema=_EmptyArgs,
        handle_validation_error=True,
    ),
    StructuredTool.from_function(
        func=calculator,
        name="calculator",
        description=(
            "Evaluate a basic arithmetic expression such as 12*8+3. "
            "Use this for math instead of guessing."
        ),
        args_schema=_CalculatorArgs,
        handle_validation_error=True,
    ),
]

SYSTEM_TOOL_NAMES = {item.name for item in SYSTEM_TOOLS}


def list_system_tools() -> list[StructuredTool]:
    return list(SYSTEM_TOOLS)
