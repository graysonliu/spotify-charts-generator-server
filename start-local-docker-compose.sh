set -a # export environment variables for subprocess
source ./env/local-docker-compose.env
set +a # disable
exec > run.log
docker-compose up