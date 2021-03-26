set -a # export environment variables for subprocess
source ./env/local-docker-compose.env
set +a # disable

# redirect output
exec > run.log
# run containers
docker-compose up --no-color