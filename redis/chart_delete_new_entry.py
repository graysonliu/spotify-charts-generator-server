import os
import sys

from dotenv import load_dotenv

import redis

project_dir = os.path.split(os.path.realpath(sys.argv[0]))[0]
os.chdir(project_dir)

load_dotenv('../env/redis.env')

r = redis.Redis(
    host='localhost',
    port=os.getenv('REDIS_PORT'),
    username=os.getenv('REDIS_USERNAME'),
    password=os.getenv('REDIS_PASSWORD'))


# delete all new entry charts
chart_keys = r.keys('chart:*-new')
for chart_key in chart_keys:
    r.delete(chart_key)

# get user playlists keys
user_playlists_keys = r.keys('playlists:*')

for key in user_playlists_keys:
    for chart_key, playlist_id in r.hgetall(key).items():
        if not b'-new' in chart_key:  # new entry chart key
            r.hdel(key, chart_key)
