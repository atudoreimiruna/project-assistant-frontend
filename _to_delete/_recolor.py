import re, sys

mapping = {
    "#0c3b2e": "#1A2B3C",
    "#0a2e23": "#111c27",
    "#0a3226": "#121e2a",
    "#0a3227": "#121e2a",
    "#0a3228": "#121e2a",
    "#0f4d3c": "#1c2e40",
    "#164d3a": "#1e3145",
    "#6d9773": "#64748B",
    "#a8c8b0": "#acb6c4",
    "#c5d8c9": "#c7cdd6",
    "#dceee2": "#e1e4e9",
    "#f0f5f1": "#f0f2f5",
    "#bb8a52": "#38260B",
    "#fff8e5": "#fbf4e9",
    "#fffbf0": "#fdf9f2",
    "#f4f7f5": "#F8FAFC",
}

pattern = re.compile(r'#[0-9a-fA-F]{6}')

def replace_in_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    def repl(m):
        key = m.group(0).lower()
        return mapping.get(key, m.group(0))

    new_content = pattern.sub(repl, content)
    if new_content != content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"updated: {path}")
    else:
        print(f"no change: {path}")

for path in sys.argv[1:]:
    replace_in_file(path)
