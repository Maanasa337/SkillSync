import urllib.request
import re

queries = ['industrial+safety', 'fire+extinguisher+pass+method', 'cnc+machine+basics', 'iso+9001+intro', 'plant+layout+manufacturing', 'lean+six+sigma+intro']
for q in queries:
    req = urllib.request.Request(f'https://www.youtube.com/results?search_query={q}', headers={'User-Agent': 'Mozilla/5.0'})
    html = urllib.request.urlopen(req).read().decode('utf-8')
    match = re.search('\"videoId\":\"([^\"]+)\"', html)
    if match:
        print(f'{q}: {match.group(1)}')
