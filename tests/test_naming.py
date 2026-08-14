import ast
from pathlib import Path


FORBIDDEN_ABBREVIATIONS = {
    "app",
    "ctx",
    "db",
    "dst",
    "id",
    "img",
    "src",
}


def identifier_parts(identifier: str) -> set[str]:
    return {part.lower() for part in identifier.strip("_").split("_")}


def test_backend_does_not_use_forbidden_abbreviations():
    violations: list[str] = []
    for source_path in sorted(Path("backend").rglob("*.py")):
        syntax_tree = ast.parse(source_path.read_text(encoding="utf-8"))
        for syntax_node in ast.walk(syntax_tree):
            identifiers: list[str] = []
            if isinstance(syntax_node, ast.Name):
                identifiers.append(syntax_node.id)
            elif isinstance(syntax_node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                identifiers.append(syntax_node.name)
            elif isinstance(syntax_node, ast.arg):
                identifiers.append(syntax_node.arg)
            for identifier in identifiers:
                forbidden = identifier_parts(identifier) & FORBIDDEN_ABBREVIATIONS
                if forbidden:
                    violations.append(
                        f"{source_path}:{syntax_node.lineno} {identifier}"
                    )

    assert not violations, "Forbidden abbreviations:\n" + "\n".join(violations)
