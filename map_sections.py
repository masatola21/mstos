with open(r"C:\Users\masat\.gemini\antigravity\scratch\mstos\hp\src\pages\index.astro", "r", encoding="utf-8") as f:
    lines = f.readlines()

with open(r"C:\Users\masat\.gemini\antigravity\scratch\mstos\sections_map.txt", "w", encoding="utf-8") as out:
    for i, l in enumerate(lines):
        if "<section" in l or ("<!--" in l and any(k in l for k in ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "診断", "サービス", "実績", "代表", "CTA", "FLOW", "PRICE", "FAQ"])):
            out.write(f"Line {i+1}: {l.strip()}\n")
print("Dumped sections_map.txt")
