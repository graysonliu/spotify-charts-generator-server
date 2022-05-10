from redis_client import redis_client as r

# get user playlists keys
user_playlists_keys = r.keys('playlists:*')

for key in user_playlists_keys:
    if b'playlists:' in key:
        r.delete(key)
