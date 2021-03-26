set -a # export environment variables for subprocess
source ./env/prod-docker-compose.env
set +a # disable

# run containers
docker-compose up