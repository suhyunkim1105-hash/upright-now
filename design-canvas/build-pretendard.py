# Font.dc.html 의 서체 시안에 Pretendard 를 실제로 태워 보기 위한 서브셋.
# 시안에 쓰인 글자만 남겨서 다섯 굵기를 통째로 인라인합니다.
import base64, os, re, sys
from fontTools.subset import main as subset_main

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.normpath(os.path.join(HERE, '..', 'public', 'fonts'))
TARGET = os.path.join(HERE, 'Font.dc.html')
OUT = os.path.join(HERE, '.pretendard')
MARKER = '/* PRETENDARD-FACE */'
WEIGHTS = [('Regular', 400), ('Medium', 500), ('SemiBold', 600), ('Bold', 700), ('ExtraBold', 800)]

src = open(TARGET, encoding='utf-8').read()
cps = {ord(c) for c in src}
for ch in '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:%/·—…()':
    cps.add(ord(ch))
keep = ','.join('U+%04X' % c for c in sorted(cps))

os.makedirs(OUT, exist_ok=True)
rules, total = [], 0
for name, wght in WEIGHTS:
    inp = os.path.join(FONT_DIR, 'Pretendard-%s.woff2' % name)
    dst = os.path.join(OUT, 'p-%d.woff2' % wght)
    argv = sys.argv[:]
    sys.argv = ['pyftsubset', inp, '--output-file=' + dst, '--flavor=woff2',
                '--layout-features=*', '--no-hinting', '--desubroutinize', '--unicodes=' + keep]
    try:
        subset_main()
    finally:
        sys.argv = argv
    data = open(dst, 'rb').read()
    total += len(data)
    rules.append('@font-face{font-family:"Pretendard Spec";font-style:normal;font-weight:%d;'
                 'font-display:block;src:url(data:font/woff2;base64,%s) format("woff2")}'
                 % (wght, base64.b64encode(data).decode('ascii')))

css = MARKER + '\n' + '\n'.join(rules)
src = re.sub(re.escape(MARKER) + r'(\n@font-face\{.*?\})*', lambda _: css, src, count=1, flags=re.S)
open(TARGET, 'w', encoding='utf-8', newline='').write(src)
print('pretendard %d faces  woff2 %.1f KB' % (len(rules), total / 1024))
