set -a # export environment variables for subprocess
source ./env/local.env
set +a # disable
exec > run.log # redirect output
cd redis && redis-server ./redis.conf &
cd app && npm install && npx nodemon app.js