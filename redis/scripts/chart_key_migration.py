from redis_client import redis_client as r


# delete all charts
chart_keys = r.keys('chart:*')
for chart_key in chart_keys:
    r.delete(chart_key)

# get user playlists keys
user_playlists_keys = r.keys('playlists:*')

for key in user_playlists_keys:
    for chart_key, playlist_id in r.hgetall(key).items():
        if not b'-' in chart_key:  # old chart key
            r.hdel(key, chart_key)
            r.hset(key, chart_key + b'-regional-daily', playlist_id)
