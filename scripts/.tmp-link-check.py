import os, re, urllib.parse

root = os.getcwd()
targets = []
for base in [
    'docs', '.claude', '.agents', 'browser_tests', 'src', 'packages',
    'tools', '.storybook', 'comfyui_frontend_package'
]:
    for dp, dn, fn in os.walk(base):
        if 'node_modules' in dp:
            continue
        for f in fn:
            if f.endswith('.md'):
                targets.append(os.path.join(dp, f))
for f in ['AGENTS.md', 'README.md', 'CONTRIBUTING.md', 'TROUBLESHOOTING.md']:
    targets.append(f)

link_re = re.compile(r'\[[^\]]*\]\(([^)\s]+)')
bad = []
for t in targets:
    try:
        text = open(t, encoding='utf-8').read()
    except Exception:
        continue
    d = os.path.dirname(t)
    for m in link_re.finditer(text):
        link = m.group(1).strip()
        if link.startswith(('http://', 'https://', 'mailto:', '#', '<')):
            continue
        path = urllib.parse.unquote(link.split('#')[0])
        if not path:
            continue
        full = os.path.normpath(os.path.join(d, path))
        if not os.path.exists(full):
            bad.append((t, link))

print('checked %d md files' % len(targets))
print('broken: %d' % len(bad))
for t, l in bad:
    print('  %s -> %s' % (t, l))
