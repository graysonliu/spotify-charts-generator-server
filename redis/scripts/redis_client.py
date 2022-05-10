import os
import sys

from dotenv import load_dotenv

import redis

project_dir = os.path.split(os.path.realpath(sys.argv[0]))[0]
os.chdir(project_dir)

load_dotenv('../env/redis.env')

redis_client = redis.Redis(
    host='localhost',
    port=os.getenv('REDIS_PORT'),
    username=os.getenv('REDIS_USERNAME'),
    password=os.getenv('REDIS_PASSWORD'))