import glob

def replace_in_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return
    
    replacements = [
        ("label: 'Center'", "label: 'Centre'"),
        ('label: "Center"', 'label: "Centre"'),
        ('placeholder="Filter by Center"', 'placeholder="Filter by Centre"'),
        (">Center<", ">Centre<"),
        ("title: 'Center'", "title: 'Centre'"),
        ('title: "Center"', 'title: "Centre"'),
        ("Center Filter", "Centre Filter"),
        ("'Center'", "'Centre'")
    ]
    
    new_content = content
    for old, new in replacements:
        new_content = new_content.replace(old, new)
        
    if content != new_content:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated {path}')

for path in glob.glob('src/pages/*.jsx', recursive=True):
    replace_in_file(path)
for path in glob.glob('src/components/*.jsx', recursive=True):
    replace_in_file(path)
