# Jua 를 구글 폰트에서 받아 화면에 쓰인 글자만 남긴 뒤 파일 하나로 굳힙니다.
# 밖으로 나가는 요청이 0 이어야 링크로 넘겨도 그대로 뜹니다.
import base64, glob, io, os, re, sys, urllib.request
from fontTools.subset import main as subset_main

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '.jua')
UA = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                    '(KHTML, like Gecko) Chrome/120 Safari/537.36'}

def used():
    cps = set()
    for path in glob.glob(os.path.join(HERE, '*.dc.html')):
        if os.path.basename(path) == 'Font.dc.html':
            continue
        src = re.sub(r'@font-face\{.*?\}', '', open(path, encoding='utf-8').read(), flags=re.S)
        cps.update(ord(c) for c in src)
    for ch in '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:%/·—…()▲▼':
        cps.add(ord(ch))
    return cps

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40).read()

def main():
    os.makedirs(OUT, exist_ok=True)
    css = get('https://fonts.googleapis.com/css2?family=Jua&display=swap').decode('utf-8')
    faces = re.findall(r'src: url\((https://fonts\.gstatic\.com[^)]+)\)[\s\S]*?unicode-range: ([^;]+);', css)
    cps, rules, total = used(), [], 0
    for i, (url, rng) in enumerate(faces):
        spans = []
        for part in rng.split(','):
            part = part.strip().replace('U+', '')
            a, b = (part.split('-') + [part])[:2]
            spans.append((int(a, 16), int(b, 16)))
        keep = sorted(c for c in cps if any(a <= c <= b for a, b in spans))
        if not keep:
            continue
        raw = os.path.join(OUT, 'jua-%d.woff2' % i)
        open(raw, 'wb').write(get(url))
        dst = os.path.join(OUT, 'jua-%d.sub.woff2' % i)
        argv = sys.argv[:]
        sys.argv = ['pyftsubset', raw, '--output-file=' + dst, '--flavor=woff2',
                    '--layout-features=*', '--no-hinting',
                    '--unicodes=' + ','.join('U+%04X' % c for c in keep)]
        try:
            subset_main()
        finally:
            sys.argv = argv
        data = open(dst, 'rb').read()
        total += len(data)
        rules.append('@font-face{font-family:"Jua";font-style:normal;font-weight:400;font-display:block;'
                     'src:url(data:font/woff2;base64,%s) format("woff2");unicode-range:%s}'
                     % (base64.b64encode(data).decode('ascii'), rng.strip()))
    open(os.path.join(HERE, 'jua.css'), 'w', encoding='utf-8', newline='').write('\n'.join(rules))
    print('jua %d벌 %.1f KB' % (len(rules), total / 1024))

main()
