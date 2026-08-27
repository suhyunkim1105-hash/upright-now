# Pretendard 를 아트보드마다 심습니다. 화면에 쓰인 글자만 남겨 서브셋하고,
# 실제로 쓰는 굵기(750·800)만 싣습니다. 밖으로 나가는 요청은 0 입니다.
import base64, glob, os, re, sys
from fontTools.subset import main as subset_main

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.normpath(os.path.join(HERE, '..', 'public', 'fonts'))
OUT = os.path.join(HERE, '.fontcache')
MARKER = '/* DESKFIT-FACES */'
WEIGHTS = [('SemiBold', 750), ('ExtraBold', 800)]

BOARDS = [p for p in sorted(glob.glob(os.path.join(HERE, '*.dc.html')))
          if os.path.basename(p) != 'Font.dc.html']

def used_codepoints():
    cps = set()
    for path in BOARDS:
        src = open(path, encoding='utf-8').read()
        src = re.sub(r'@font-face\{.*?\}', '', src, flags=re.S)   # 지난번 base64 는 빼고 셉니다
        cps.update(ord(c) for c in src)
    for ch in '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz.,:%/·—…()':
        cps.add(ord(ch))
    return cps

def main():
    os.makedirs(OUT, exist_ok=True)
    keep = ','.join('U+%04X' % c for c in sorted(used_codepoints()))
    rules, total = [], 0
    for name, wght in WEIGHTS:
        src = os.path.join(FONT_DIR, 'Pretendard-%s.woff2' % name)
        dst = os.path.join(OUT, 'pd-%d.woff2' % wght)
        argv = sys.argv[:]
        sys.argv = ['pyftsubset', src, '--output-file=' + dst, '--flavor=woff2',
                    '--layout-features=*', '--no-hinting', '--desubroutinize', '--unicodes=' + keep]
        try:
            subset_main()
        finally:
            sys.argv = argv
        data = open(dst, 'rb').read()
        total += len(data)
        rules.append('@font-face{font-family:"Pretendard Deskfit";font-style:normal;font-weight:%d;'
                     'font-display:block;src:url(data:font/woff2;base64,%s) format("woff2")}'
                     % (wght, base64.b64encode(data).decode('ascii')))

    css = MARKER + '\n' + '\n'.join(rules)

    for path in BOARDS:
        s = open(path, encoding='utf-8').read()
        # 지난 판(Wanted Sans · Jua) 의 흔적을 지웁니다
        s = re.sub(r"\s*@import url\('https://fonts\.googleapis\.com/css2\?family=Jua[^']*'\);", '', s)
        s = re.sub(r'/\* WANTED-SANS-FACE \*/(\n@font-face\{.*?\})*', MARKER, s, flags=re.S)
        s = re.sub(re.escape(MARKER) + r'(\n@import[^\n]*)?(\n@font-face\{.*?\})*'
                   r'(\n\[style\*="font-weight: 820"\]\{[^}]*\})?',
                   lambda _: css, s, count=1, flags=re.S)
        s = s.replace('font-family: "Jua", "Wanted Sans Variable", "Wanted Sans", system-ui, sans-serif;',
                      'font-family: "Pretendard Deskfit", "Pretendard", system-ui, sans-serif;')
        s = s.replace('font-family: "Wanted Sans Variable", "Wanted Sans", "Pretendard", system-ui, sans-serif;',
                      'font-family: "Pretendard Deskfit", "Pretendard", system-ui, sans-serif;')
        open(path, 'w', encoding='utf-8', newline='').write(s)

    print('pretendard %d벌 %.1f KB · 아트보드 %d장' % (len(rules), total / 1024, len(BOARDS)))

main()
